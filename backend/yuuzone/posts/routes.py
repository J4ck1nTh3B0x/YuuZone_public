
from flask import Blueprint, jsonify, request
import logging
from datetime import datetime
from yuuzone import db
from flask_login import current_user, login_required
from yuuzone.posts.models import (
    PostInfo,
    Posts,
    PostValidator,
    get_filters,
    SavedPosts,
)
from yuuzone.subthreads.models import Subscription, SubthreadInfo
# Socket.IO will be handled in WSGI - use try/except for graceful fallback
try:
    from yuuzone.socketio_app import socketio
except ImportError:
    socketio = None

# Import rate limiting utilities
from yuuzone.utils.rate_limiter import combined_protection, rate_limit
from yuuzone.utils.giphy_service import GiphyService

posts = Blueprint("posts", __name__, url_prefix="/api")

# IMPORTANT: Boosted posts are prioritized to appear at the top of feeds
# and are EXCLUDED from regular posts to prevent duplication.
# Each post can only appear once, either as boosted or regular.


@posts.route("/posts/<feed_name>", methods=["GET"])
def get_posts(feed_name):
    try:
        limit = request.args.get("limit", default=20, type=int)
        offset = request.args.get("offset", default=0, type=int)
        sortby = request.args.get("sortby", default="top", type=str)
        duration = request.args.get("duration", default="alltime", type=str)
        try:
            sortBy, durationBy = get_filters(sortby=sortby, duration=duration)
        except Exception:
            return jsonify({"message": "Invalid Request"}), 400

        if feed_name == "home" and current_user.is_authenticated:
            threads = [subscription.subthread.id for subscription in Subscription.query.filter_by(user_id=current_user.id)]
        elif feed_name == "all":
            threads = [thread.id for thread in SubthreadInfo.query.order_by(SubthreadInfo.members_count.desc()).limit(25)]
        elif feed_name == "popular":
            threads = [thread.id for thread in SubthreadInfo.query.order_by(SubthreadInfo.posts_count.desc()).limit(25)]
        else:
            return jsonify({"message": "Invalid Request"}), 400

        # Filter out subthreads where the current user is banned
        if current_user.is_authenticated:
            from yuuzone.subthreads.models import SubthreadBan
            banned_subthreads = [ban.subthread_id for ban in SubthreadBan.query.filter_by(user_id=current_user.id).all()]
            threads = [tid for tid in threads if tid not in banned_subthreads]

        # Get ALL non-expired boosted posts (no per-user limits)
        from yuuzone.coins.models import PostBoost
        from datetime import datetime, timezone
        
        now = datetime.now(timezone.utc)
        boosted_posts = []
        
        try:
            # Get ALL currently active boosted posts (no user limits)
            boosted_query = PostBoost.query.filter(
                PostBoost.is_active == True,
                PostBoost.boost_end > now
            ).join(PostInfo, PostBoost.post_id == PostInfo.post_id).filter(
                PostInfo.thread_id.in_(threads)
            ).order_by(PostBoost.created_at.desc())
            
            # Get ALL boosted posts without any per-user limits
            all_boosted_boosts = boosted_query.all()
            
            logging.info(f"🔍 Total boosted posts found: {len(all_boosted_boosts)}")
            
            # Separate boosted posts into top 3 and index-boosted
            top_boosted_posts = []  # First 3 most recent boosted posts
            index_boosted_post_ids = set()  # Other boosted posts for index boost
            
            seen_post_ids = set()  # Track unique post IDs to prevent duplicates
            for boost in all_boosted_boosts:
                try:
                    post_info = PostInfo.query.get(boost.post_id)
                    if post_info and (durationBy is True or (hasattr(durationBy, 'filter') and durationBy.filter(post_info).scalar())):
                        # Only add if we haven't seen this post ID before
                        if post_info.post_id not in seen_post_ids:
                            post_dict = post_info.as_dict(cur_user=current_user.id if current_user.is_authenticated else None)
                            post_dict['is_boosted'] = True
                            
                            # First 3 most recent boosted posts get top seats
                            if len(top_boosted_posts) < 3:
                                top_boosted_posts.append(post_dict)
                            else:
                                # Others get index boost
                                index_boosted_post_ids.add(post_info.post_id)
                            
                            seen_post_ids.add(post_info.post_id)
                except Exception as e:
                    logging.warning(f"Error processing boosted post {boost.post_id}: {e}")
                    continue
            
            # Log the results
            logging.info(f"✅ Top boosted posts (first 3): {len(top_boosted_posts)}")
            logging.info(f"✅ Index boosted posts: {len(index_boosted_post_ids)}")
            
        except Exception as e:
            logging.warning(f"Error fetching boosted posts: {e}")
            top_boosted_posts = []
            index_boosted_post_ids = set()
        
        # Store ALL boosted post IDs for exclusion (top + index boosted)
        all_boosted_post_ids = set()
        for boost in all_boosted_boosts:
            try:
                post_info = PostInfo.query.get(boost.post_id)
                if post_info and (durationBy is True or (hasattr(durationBy, 'filter') and durationBy.filter(post_info).scalar())):
                    all_boosted_post_ids.add(post_info.post_id)
            except Exception as e:
                logging.warning(f"Error processing boosted post {boost.post_id}: {e}")
                continue
        
        # Calculate how many regular posts we need
        # For pagination, we need to consider that top boosted posts are always at the top (max 3)
        # If user requests offset=20 and limit=20, but we have 3 boosted posts:
        # - First 3 slots are boosted posts (offset 0-2)
        # - Next 17 slots are regular posts (offset 3-19)
        # - User wants offset 20-39, so we need regular posts starting from offset 17
        if offset < len(top_boosted_posts):
            # User is requesting posts within the top boosted posts range
            # Return top boosted posts for this offset, plus regular posts to fill the limit
            start_idx = offset
            end_idx = min(offset + limit, len(top_boosted_posts))
            top_boosted_posts = top_boosted_posts[start_idx:end_idx]
            remaining_limit = limit - len(top_boosted_posts)  # Fill remaining slots with regular posts
            regular_offset = 0
        else:
            # User is requesting posts beyond the top boosted posts
            # Calculate how many regular posts we need
            boosted_slots_used = len(top_boosted_posts)
            remaining_limit = limit
            regular_offset = offset - boosted_slots_used
        
        # Get regular posts with index boost for older boosted posts
        regular_posts = []
        if remaining_limit > 0:
            # Only exclude top boosted posts, NOT index boosted posts
            top_boosted_post_ids = [post.get('post_info', {}).get('id') for post in top_boosted_posts if post.get('post_info', {}).get('id') is not None]
            
            logging.info(f"🔍 Excluding {len(top_boosted_post_ids)} top boosted posts from regular posts: {top_boosted_post_ids}")
            logging.info(f"🔍 Index boosted posts will appear in regular feed: {list(index_boosted_post_ids)}")
            
            # Build the base query
            query = PostInfo.query.filter(PostInfo.thread_id.in_(threads))
            
            # Only exclude top boosted posts, allow index boosted posts to appear in regular feed
            if top_boosted_post_ids:
                query = query.filter(~PostInfo.post_id.in_(top_boosted_post_ids))
            
            # Get regular posts first
            base_regular_posts = [
                pinfo.as_dict(cur_user=current_user.id if current_user.is_authenticated else None)
                for pinfo in query
                .order_by(sortBy)
                .filter(durationBy if durationBy is not True else True)
                .limit(remaining_limit * 2)  # Get more posts to account for index boost
                .offset(regular_offset)
                .all()
            ]
            
            # Apply index boost to posts that are in index_boosted_post_ids
            if index_boosted_post_ids:
                # Calculate boost amount: +3 positions or up to 15% of total posts
                total_posts_estimate = max(100, len(base_regular_posts) * 5)  # Estimate total posts
                boost_amount = min(3, int(total_posts_estimate * 0.15))  # +3 or up to 15%
                
                logging.info(f"🔍 Applying index boost: +{boost_amount} positions to {len(index_boosted_post_ids)} posts")
                
                # Separate boosted and non-boosted posts
                boosted_regular_posts = []
                normal_regular_posts = []
                
                for post in base_regular_posts:
                    post_id = post.get('post_info', {}).get('id')
                    if post_id in index_boosted_post_ids:
                        post['is_index_boosted'] = True
                        post['is_boosted'] = True  # Keep the boosted styling!
                        boosted_regular_posts.append(post)
                    else:
                        normal_regular_posts.append(post)
                
                # Apply boost by moving boosted posts up by boost_amount positions
                final_regular_posts = []
                boost_index = 0
                normal_index = 0
                
                while len(final_regular_posts) < remaining_limit and (boost_index < len(boosted_regular_posts) or normal_index < len(normal_regular_posts)):
                    # Add boosted posts with their boost
                    if boost_index < len(boosted_regular_posts):
                        final_regular_posts.append(boosted_regular_posts[boost_index])
                        boost_index += 1
                        
                        # Skip some normal posts to create the boost effect
                        skip_count = min(boost_amount, len(normal_regular_posts) - normal_index)
                        normal_index += skip_count
                    
                    # Add normal posts
                    if normal_index < len(normal_regular_posts) and len(final_regular_posts) < remaining_limit:
                        final_regular_posts.append(normal_regular_posts[normal_index])
                        normal_index += 1
                
                regular_posts = final_regular_posts[:remaining_limit]
            else:
                regular_posts = base_regular_posts[:remaining_limit]
            
            # Final safety check: ensure no top boosted posts slipped through (index boosted posts are allowed)
            regular_post_ids = [p['post_info']['id'] for p in regular_posts if 'post_info' in p and 'id' in p['post_info'] and p['post_info']['id'] is not None]
            duplicate_ids = set(top_boosted_post_ids) & set(regular_post_ids)
            if duplicate_ids:
                logging.warning(f"⚠️ Found top boosted posts in regular posts: {duplicate_ids}")
                # Remove top boosted posts from regular posts (index boosted posts stay)
                regular_posts = [p for p in regular_posts if p.get('post_info', {}).get('id') not in duplicate_ids]
                logging.info(f"✅ Removed {len(duplicate_ids)} top boosted posts from regular posts")
        
        # Combine top boosted and regular posts
        post_list = top_boosted_posts + regular_posts
        
        # AGGRESSIVE deduplication: Always remove duplicates regardless of detection
        seen_ids = set()
        deduplicated_posts = []
        for post in post_list:
            post_id = post.get('post_info', {}).get('id')
            if post_id is not None and post_id not in seen_ids:
                seen_ids.add(post_id)
                deduplicated_posts.append(post)
            elif post_id is None:
                # Handle posts without IDs (shouldn't happen but just in case)
                deduplicated_posts.append(post)
        
        post_list = deduplicated_posts
        
        # Log the results
        final_post_ids = [p['post_info']['id'] for p in post_list if 'post_info' in p and 'id' in p['post_info'] and p['post_info']['id'] is not None]
        logging.info(f"✅ Final deduplication: {len(post_list)} unique posts (was {len(top_boosted_posts + regular_posts)} before deduplication)")
        logging.info(f"✅ Top boosted posts: {len(top_boosted_posts)}, Regular posts: {len(regular_posts)}")
        logging.info(f"✅ Index boosted posts in regular feed: {len([p for p in regular_posts if p.get('is_index_boosted')])}")
        logging.info(f"✅ Unique post IDs: {len(set(final_post_ids))}")
        
        logging.info(f"✅ Final result: {len(top_boosted_posts)} top boosted + {len(regular_posts)} regular = {len(post_list)} total posts")
        return jsonify(post_list), 200
    except Exception as e:
        logging.error(f"Error in get_posts: {e}")
        return jsonify({"error": "Failed to get posts"}), 500


@posts.route("/post/<pid>", methods=["GET"])
def get_post(pid):
    post_info = PostInfo.query.filter_by(post_id=pid).first()
    if not post_info:
        return jsonify({"message": "Invalid Post"}), 400

    # Check if current user is banned from the subthread of this post
    if current_user.is_authenticated:
        from yuuzone.subthreads.models import SubthreadBan
        banned = SubthreadBan.query.filter_by(user_id=current_user.id, subthread_id=post_info.thread_id).first()
        if banned:
            return jsonify({
                "message": "You are banned from this subthread",
                "banned": True,
                "redirect": f"/banned/{post_info.thread_id}"
            }), 403

    return (
        jsonify({"post": post_info.as_dict(current_user.id if current_user.is_authenticated else None)}),
        200,
    )


@posts.route("/post", methods=["POST"])
@login_required
@combined_protection("post")
def new_post():
    import logging
    from marshmallow.exceptions import ValidationError

    # Handle multiple images
    images = request.files.getlist("media")
    form_data = request.form.to_dict()
    subthread_id = form_data.get("subthread_id")

    # Check if user is banned from this subthread
    from yuuzone.subthreads.models import SubthreadBan
    banned = SubthreadBan.query.filter_by(user_id=current_user.id, subthread_id=subthread_id).first()
    if banned:
        return jsonify({
            "message": "You are banned from this subthread",
            "banned": True,
            "redirect": f"/banned/{subthread_id}"
        }), 403

    # Check if user is subscribed to the subthread
    subscription = Subscription.query.filter_by(user_id=current_user.id, subthread_id=subthread_id).first()
    if not subscription:
        return jsonify({"message": "You must join the subthread before posting"}), 403

    # Validate input data
    try:
        PostValidator().load(
            {
                "subthread_id": subthread_id,
                "title": form_data.get("title"),
                "content": form_data.get("content"),
            }
        )
    except ValidationError as err:
        return jsonify({"message": "Validation Error", "errors": err.messages}), 400

    # Validate number of images (max 4)
    if images and len(images) > 4:
        return jsonify({"message": "Maximum 4 images allowed per post"}), 400

    # Create the post with comprehensive error handling
    try:
        new_post = Posts.add(form_data, images, current_user.id)
        #logging.info(f"Post created successfully: ID {new_post.id}, User {current_user.id}, Subthread {subthread_id}")

        # Emit socket event for new post (if Socket.IO available)
        if socketio:
            try:
                # Get complete post data with all necessary information
                post_data = new_post.as_dict()
                
                # Emit enhanced new post event with comprehensive data
                socketio.emit('new_post', {
                    'postData': post_data,
                    'subthreadId': subthread_id,
                    'createdBy': current_user.username,
                    'timestamp': new_post.created_at.isoformat() if hasattr(new_post, 'created_at') else None,
                    'postId': new_post.id
                }, room=f'{subthread_id}')
                
                # Also emit to global room for cross-subthread updates
                socketio.emit('new_post_global', {
                    'postData': post_data,
                    'subthreadId': subthread_id,
                    'createdBy': current_user.username,
                    'timestamp': new_post.created_at.isoformat() if hasattr(new_post, 'created_at') else None,
                    'postId': new_post.id
                }, room='global')
                
                # Emit enhanced real-time events
                socketio.emit('subthread_stats_update', {
                    'subthread_id': subthread_id,
                    'stats_type': 'posts_count',
                    'new_value': 1,  # Increment by 1
                    'updated_by': current_user.username
                }, room=f'{subthread_id}')
                
                socketio.emit('user_activity', {
                    'username': current_user.username,
                    'activity_type': 'posting',
                    'subthread_id': subthread_id,
                    'post_id': new_post.id,
                    'timestamp': new_post.created_at.isoformat() if hasattr(new_post, 'created_at') else None
                }, room=f'{subthread_id}')
                
                #logging.info(f"✅ Socket event emitted for new post {new_post.id} in room {subthread_id}")
            except Exception as socket_err:
                # Log socket error but don't fail the request since post was created
                logging.error(f"❌ Failed to emit socket event for post {new_post.id}: {socket_err}")
                import traceback
                logging.error(f"Socket error traceback: {traceback.format_exc()}")
        else:
            #logging.info("⚠️ Socket.IO not available, skipping new post event emission")
            pass

        return jsonify({"message": "Post created"}), 200

    except ValueError as ve:
        # Handle validation or business logic errors
        logging.error(f"Post creation failed - validation error: {ve}")
        return jsonify({"message": str(ve)}), 400

    except Exception as e:
        # Handle database, Cloudinary, or other unexpected errors
        logging.error(f"Post creation failed - unexpected error: {e}")
        db.session.rollback()  # Ensure any partial transaction is rolled back
        return jsonify({"message": "Failed to create post. Please try again."}), 500


@posts.route("/post/<pid>", methods=["PATCH"])
@login_required
def update_post(pid):
    import logging
    from marshmallow.exceptions import ValidationError

    image = request.files.get("media")
    form_data = request.form.to_dict()

    # Validate input data
    try:
        PostValidator().load(
            {
                "subthread_id": form_data.get("subthread_id"),
                "title": form_data.get("title"),
                "content": form_data.get("content"),
            }
        )
    except ValidationError as err:
        logging.warning(f"Post update validation failed for post {pid}: {err.messages}")
        return jsonify({"message": "Validation Error", "errors": err.messages}), 400

    # Check if post exists and user has permission
    update_post = Posts.query.filter_by(id=pid).first()
    if not update_post:
        logging.warning(f"Post update failed - post not found: {pid}")
        return jsonify({"message": "Invalid Post"}), 400
    elif update_post.user_id != current_user.id:
        logging.warning(f"Post update failed - unauthorized user {current_user.id} for post {pid}")
        return jsonify({"message": "Unauthorized"}), 401

    # Check if user is banned from the subthread of this post
    from yuuzone.subthreads.models import SubthreadBan
    banned = SubthreadBan.query.filter_by(user_id=current_user.id, subthread_id=update_post.subthread_id).first()
    if banned:
        return jsonify({
            "message": "You are banned from this subthread",
            "banned": True,
            "redirect": f"/banned/{update_post.subthread_id}"
        }), 403

    # Update the post with error handling
    try:
        update_post.patch(form_data, image)
        #logging.info(f"Post updated successfully: ID {pid}, User {current_user.id}")

        # Emit socket event for post update
        if socketio:
            try:
                # Get the subthread_id for the post to emit to the correct room
                subthread_id = update_post.post_info[0].subthread_id
                socketio.emit('post_updated', {
                    'postId': pid,
                    'newData': update_post.post_info[0].as_dict(current_user.id),
                    'subthreadId': subthread_id,
                    'updatedBy': current_user.username,
                    'timestamp': update_post.updated_at.isoformat() if hasattr(update_post, 'updated_at') else None
                }, room=f'{subthread_id}')
                
                # Also emit to global room for cross-subthread updates
                socketio.emit('post_updated_global', {
                    'postId': pid,
                    'newData': update_post.post_info[0].as_dict(current_user.id),
                    'subthreadId': subthread_id,
                    'updatedBy': current_user.username,
                    'timestamp': update_post.updated_at.isoformat() if hasattr(update_post, 'updated_at') else None
                }, room='global')
                
                #logging.info(f"Socket event emitted for updated post {pid} in room {subthread_id}")
            except Exception as socket_err:
                # Log socket error but don't fail the request since post was updated
                logging.error(f"Failed to emit socket event for updated post {pid}: {socket_err}")

        return (
            jsonify(
                {
                    "message": "Post updated",
                    "new_data": update_post.post_info[0].as_dict(current_user.id),
                }
            ),
            200,
        )

    except ValueError as ve:
        logging.error(f"Post update failed - validation error for post {pid}: {ve}")
        return jsonify({"message": str(ve)}), 400

    except Exception as e:
        logging.error(f"Post update failed - unexpected error for post {pid}: {e}")
        db.session.rollback()
        return jsonify({"message": "Failed to update post. Please try again."}), 500


@posts.route("/post/<pid>", methods=["DELETE"])
@login_required
def delete_post(pid):
    import logging
    
    # Validate delete nonce to prevent CSRF attacks
    delete_nonce = request.headers.get('X-Delete-Nonce')
    if not delete_nonce:
        return jsonify({"message": "Missing delete nonce"}), 400
    
    # Basic nonce validation (in production, you might want more sophisticated validation)
    try:
        nonce_timestamp = int(delete_nonce[:13])  # First 13 digits should be timestamp
        current_time = int(datetime.now().timestamp() * 1000)
        if abs(current_time - nonce_timestamp) > 300000:  # 5 minutes expiry
            return jsonify({"message": "Delete nonce expired"}), 400
    except (ValueError, IndexError):
        return jsonify({"message": "Invalid delete nonce"}), 400
    
    post = Posts.query.filter_by(id=pid).first()
    if not post:
        return jsonify({"message": "Invalid Post"}), 400

    # Check if user is the post owner
    if post.user_id == current_user.id:
        # Check if user is banned from the subthread of this post
        from yuuzone.subthreads.models import SubthreadBan
        banned = SubthreadBan.query.filter_by(user_id=current_user.id, subthread_id=post.subthread_id).first()
        if banned:
            return jsonify({
                "message": "You are banned from this subthread",
                "banned": True,
                "redirect": f"/banned/{post.subthread_id}"
            }), 403

        # Get subthread_id before deleting the post
        subthread_id = post.subthread_id
        post.delete_media()
        Posts.query.filter_by(id=pid).delete()
        db.session.commit()
        # Emit socket event for post deletion
        if socketio:
            try:
                socketio.emit('post_deleted', {
                    'postId': pid,
                    'subthreadId': subthread_id,
                    'deletedBy': current_user.username,
                    'timestamp': None
                }, room=f'{subthread_id}')
                
                # Also emit to global room for cross-subthread updates
                socketio.emit('post_deleted_global', {
                    'postId': pid,
                    'subthreadId': subthread_id,
                    'deletedBy': current_user.username,
                    'timestamp': None
                }, room='global')
                
                # Emit enhanced real-time events
                socketio.emit('subthread_stats_update', {
                    'subthread_id': subthread_id,
                    'stats_type': 'posts_count',
                    'new_value': -1,  # Decrement by 1
                    'updated_by': current_user.username
                }, room=f'{subthread_id}')
                
                socketio.emit('user_activity', {
                    'username': current_user.username,
                    'activity_type': 'posting',
                    'subthread_id': subthread_id,
                    'post_id': pid,
                    'timestamp': None
                }, room=f'{subthread_id}')
                
                #logging.info(f"Socket event emitted for deleted post {pid} in room {subthread_id}")
            except Exception as e:
                logging.error(f"Failed to emit post_deleted event: {e}")
        return jsonify({"message": "Post deleted"}), 200

    # Check if user is mod or admin of the subthread where the post was made
    from yuuzone.models import UserRole, Role
    user_role = UserRole.query.filter_by(
        user_id=current_user.id,
        subthread_id=post.subthread_id
    ).join(Role, UserRole.role_id == Role.id).filter(
        Role.slug.in_(["mod", "admin"])
    ).first()

    # Log for debugging
    logging.info(f"User {current_user.username} (ID: {current_user.id}) attempting to delete post {pid}")
    logging.info(f"Post subthread_id: {post.subthread_id}")
    logging.info(f"User role found: {user_role.role.slug if user_role else 'None'}")

    if user_role:
        # Get subthread_id before deleting the post
        subthread_id = post.subthread_id
        post.delete_media()
        Posts.query.filter_by(id=pid).delete()
        db.session.commit()
        # Emit socket event for post deletion
        if socketio:
            try:
                socketio.emit('post_deleted', {
                    'postId': pid,
                    'subthreadId': subthread_id,
                    'deletedBy': current_user.username,
                    'timestamp': None
                }, room=f'{subthread_id}')
                
                # Also emit to global room for cross-subthread updates
                socketio.emit('post_deleted_global', {
                    'postId': pid,
                    'subthreadId': subthread_id,
                    'deletedBy': current_user.username,
                    'timestamp': None
                }, room='global')
                
                # Emit enhanced real-time events
                socketio.emit('subthread_stats_update', {
                    'subthread_id': subthread_id,
                    'stats_type': 'posts_count',
                    'new_value': -1,  # Decrement by 1
                    'updated_by': current_user.username
                }, room=f'{subthread_id}')
                
                socketio.emit('user_activity', {
                    'username': current_user.username,
                    'activity_type': 'posting',
                    'subthread_id': subthread_id,
                    'post_id': pid,
                    'timestamp': None
                }, room=f'{subthread_id}')
                
                #logging.info(f"Socket event emitted for deleted post {pid} in room {subthread_id}")
            except Exception as e:
                logging.error(f"Failed to emit post_deleted event: {e}")
        return jsonify({"message": "Post deleted"}), 200

    return jsonify({"message": "Unauthorized"}), 401


@posts.route("/posts/thread/<tid>", methods=["GET"])
def get_posts_of_thread(tid):
    # Check if current user is banned from this subthread
    if current_user.is_authenticated:
        from yuuzone.subthreads.models import SubthreadBan
        banned = SubthreadBan.query.filter_by(user_id=current_user.id, subthread_id=tid).first()
        if banned:
            return jsonify({
                "message": "You are banned from this subthread",
                "banned": True,
                "redirect": f"/banned/{tid}"
            }), 403

    limit = request.args.get("limit", default=20, type=int)
    offset = request.args.get("offset", default=0, type=int)
    sortby = request.args.get("sortby", default="top", type=str)
    duration = request.args.get("duration", default="alltime", type=str)
    try:
        sortBy, durationBy = get_filters(sortby=sortby, duration=duration)
    except Exception:
        return jsonify({"message": "Invalid Request"}), 400
    
    # Get ALL non-expired boosted posts for this specific thread (no per-user limits)
    from yuuzone.coins.models import PostBoost
    from datetime import datetime, timezone
    
    now = datetime.now(timezone.utc)
    boosted_posts = []
    
    try:
        # Get ALL currently active boosted posts for this thread (no user limits)
        boosted_query = PostBoost.query.filter(
            PostBoost.is_active == True,
            PostBoost.boost_end > now
        ).join(PostInfo, PostBoost.post_id == PostInfo.post_id).filter(
            PostInfo.thread_id == tid
        ).order_by(PostBoost.created_at.desc())
        
        # Get ALL boosted posts without any per-user limits
        all_boosted_boosts = boosted_query.all()
        
        logging.info(f"🔍 Thread {tid}: Total boosted posts found: {len(all_boosted_boosts)}")
        
        # Separate boosted posts into top 3 and index-boosted
        top_boosted_posts = []  # First 3 most recent boosted posts
        index_boosted_post_ids = set()  # Other boosted posts for index boost
        
        seen_post_ids = set()  # Track unique post IDs to prevent duplicates
        for boost in all_boosted_boosts:
            try:
                post_info = PostInfo.query.get(boost.post_id)
                if post_info and (durationBy is True or (hasattr(durationBy, 'filter') and durationBy.filter(post_info).scalar())):
                    # Only add if we haven't seen this post ID before
                    if post_info.post_id not in seen_post_ids:
                        post_dict = post_info.as_dict(current_user.id if current_user.is_authenticated else None)
                        post_dict['is_boosted'] = True
                        
                        # First 3 most recent boosted posts get top seats
                        if len(top_boosted_posts) < 3:
                            top_boosted_posts.append(post_dict)
                        else:
                            # Others get index boost
                            index_boosted_post_ids.add(post_info.post_id)
                        
                        seen_post_ids.add(post_info.post_id)
            except Exception as e:
                logging.warning(f"Error processing boosted post {boost.post_id}: {e}")
                continue
        
        # Log the results
        logging.info(f"✅ Thread {tid}: Top boosted posts (first 3): {len(top_boosted_posts)}")
        logging.info(f"✅ Thread {tid}: Index boosted posts: {len(index_boosted_post_ids)}")
        
    except Exception as e:
        logging.warning(f"Error fetching boosted posts for thread {tid}: {e}")
        top_boosted_posts = []
        index_boosted_post_ids = set()
    
    # Store ALL boosted post IDs for exclusion (top + index boosted)
    all_boosted_post_ids = set()
    for boost in all_boosted_boosts:
        try:
            post_info = PostInfo.query.get(boost.post_id)
            if post_info and (durationBy is True or (hasattr(durationBy, 'filter') and durationBy.filter(post_info).scalar())):
                all_boosted_post_ids.add(post_info.post_id)
        except Exception as e:
            logging.warning(f"Error processing boosted post {boost.post_id}: {e}")
            continue
    
    # Initialize regular_posts to prevent UnboundLocalError
    regular_posts = []
    
    # Calculate how many regular posts we need
    # For pagination, we need to consider that top boosted posts are always at the top (max 3)
    if offset < len(top_boosted_posts):
        # User is requesting posts within the top boosted posts range
        # Return top boosted posts for this offset, plus regular posts to fill the limit
        start_idx = offset
        end_idx = min(offset + limit, len(top_boosted_posts))
        top_boosted_posts = top_boosted_posts[start_idx:end_idx]
        remaining_limit = limit - len(top_boosted_posts)  # Fill remaining slots with regular posts
        regular_offset = 0
    else:
        # User is requesting posts beyond the top boosted posts
        # Calculate how many regular posts we need
        boosted_slots_used = len(top_boosted_posts)
        remaining_limit = limit
        regular_offset = offset - boosted_slots_used
    
    # Get regular posts with index boost for older boosted posts
    if remaining_limit > 0:
            # Only exclude top boosted posts, NOT index boosted posts
            top_boosted_post_ids = [post.get('post_info', {}).get('id') for post in top_boosted_posts if post.get('post_info', {}).get('id') is not None]
            
            logging.info(f"🔍 Thread {tid}: Excluding {len(top_boosted_post_ids)} top boosted posts from regular posts: {top_boosted_post_ids}")
            logging.info(f"🔍 Thread {tid}: Index boosted posts will appear in regular feed: {list(index_boosted_post_ids)}")
            
            # Build the base query
            query = PostInfo.query.filter(PostInfo.thread_id == tid)
            
            # Only exclude top boosted posts, allow index boosted posts to appear in regular feed
            if top_boosted_post_ids:
                query = query.filter(~PostInfo.post_id.in_(top_boosted_post_ids))
    
    # Get regular posts first
    base_regular_posts = [
        pinfo.as_dict(current_user.id if current_user.is_authenticated else None)
        for pinfo in query
        .order_by(sortBy)
        .filter(durationBy if durationBy is not True else True)
        .limit(remaining_limit * 2)  # Get more posts to account for index boost
        .offset(regular_offset)
        .all()
    ]
    
    # Apply index boost to posts that are in index_boosted_post_ids
    if index_boosted_post_ids:
        # Calculate boost amount: +3 positions or up to 15% of total posts
        total_posts_estimate = max(100, len(base_regular_posts) * 5)  # Estimate total posts
        boost_amount = min(3, int(total_posts_estimate * 0.15))  # +3 or up to 15%
        
        logging.info(f"🔍 Thread {tid}: Applying index boost: +{boost_amount} positions to {len(index_boosted_post_ids)} posts")
        
        # Separate boosted and non-boosted posts
        boosted_regular_posts = []
        normal_regular_posts = []
        
        for post in base_regular_posts:
            post_id = post.get('post_info', {}).get('id')
            if post_id in index_boosted_post_ids:
                post['is_index_boosted'] = True
                boosted_regular_posts.append(post)
            else:
                normal_regular_posts.append(post)
        
        # Apply boost by moving boosted posts up by boost_amount positions
        final_regular_posts = []
        boost_index = 0
        normal_index = 0
        
        while len(final_regular_posts) < remaining_limit and (boost_index < len(boosted_regular_posts) or normal_index < len(normal_regular_posts)):
            # Add boosted posts with their boost
            if boost_index < len(boosted_regular_posts):
                final_regular_posts.append(boosted_regular_posts[boost_index])
                boost_index += 1
                
                # Skip some normal posts to create the boost effect
                skip_count = min(boost_amount, len(normal_regular_posts) - normal_index)
                normal_index += skip_count
            
            # Add normal posts
            if normal_index < len(normal_regular_posts) and len(final_regular_posts) < remaining_limit:
                final_regular_posts.append(normal_regular_posts[normal_index])
                normal_index += 1
        
        regular_posts = final_regular_posts[:remaining_limit]
    else:
        regular_posts = base_regular_posts[:remaining_limit]
    
    # Final safety check: ensure no top boosted posts slipped through (index boosted posts are allowed)
    regular_post_ids = [p['post_info']['id'] for p in regular_posts if 'post_info' in p and 'id' in p['post_info'] and p['post_info']['id'] is not None]
    duplicate_ids = set(top_boosted_post_ids) & set(regular_post_ids)
    if duplicate_ids:
        logging.warning(f"⚠️ Thread {tid}: Found top boosted posts in regular posts: {duplicate_ids}")
        # Remove top boosted posts from regular posts (index boosted posts stay)
        regular_posts = [p for p in regular_posts if p.get('post_info', {}).get('id') not in duplicate_ids]
        logging.info(f"✅ Thread {tid}: Removed {len(duplicate_ids)} top boosted posts from regular posts")
    
    # Combine top boosted and regular posts
    post_list = top_boosted_posts + regular_posts
    
    # Final verification: ensure no duplicates in final result
    final_post_ids = [p['post_info']['id'] for p in post_list if 'post_info' in p and 'id' in p['post_info'] and p['post_info']['id'] is not None]
    if len(final_post_ids) != len(set(final_post_ids)):
        logging.error(f"❌ CRITICAL Thread {tid}: Duplicate posts found in final result! Total: {len(final_post_ids)}, Unique: {len(set(final_post_ids))}")
        # Remove duplicates while preserving order
        seen_ids = set()
        deduplicated_posts = []
        for post in post_list:
            post_id = post.get('post_info', {}).get('id')
            if post_id is not None and post_id not in seen_ids:
                seen_ids.add(post_id)
                deduplicated_posts.append(post)
        post_list = deduplicated_posts
        logging.info(f"✅ Thread {tid}: Final deduplication: {len(post_list)} unique posts")
    
    logging.info(f"✅ Thread {tid}: Final result: {len(top_boosted_posts)} top boosted + {len(regular_posts)} regular = {len(post_list)} total posts")
    logging.info(f"✅ Thread {tid}: Index boosted posts in regular feed: {len([p for p in regular_posts if p.get('is_index_boosted')])}")
    return jsonify(post_list), 200


@posts.route("/posts/user/<user_name>", methods=["GET"])
def get_posts_of_user(user_name):
    limit = request.args.get("limit", default=20, type=int)
    offset = request.args.get("offset", default=0, type=int)
    sortby = request.args.get("sortby", default="top", type=str)
    duration = request.args.get("duration", default="alltime", type=str)
    try:
        sortBy, durationBy = get_filters(sortby=sortby, duration=duration)
    except Exception:
        return jsonify({"message": "Invalid Request"}), 400

    # Check if current user is blocked by the profile owner
    if current_user.is_authenticated:
        from yuuzone.users.models import User, UserBlock
        profile_owner = User.query.filter_by(username=user_name, is_email_verified=True).first()
        if profile_owner:
            is_blocked = UserBlock.query.filter_by(
                blocker_id=profile_owner.id,
                blocked_id=current_user.id
            ).first()

            if is_blocked:
                # Return empty list for blocked users
                return jsonify([]), 200

    # Get ALL non-expired boosted posts for this user (no per-user limits)
    from yuuzone.coins.models import PostBoost
    from datetime import datetime, timezone
    
    now = datetime.now(timezone.utc)
    boosted_posts = []
    
    try:
        # Get ALL currently active boosted posts for this user
        boosted_query = PostBoost.query.filter(
            PostBoost.is_active == True,
            PostBoost.boost_end > now
        ).join(PostInfo, PostBoost.post_id == PostInfo.post_id).filter(
            PostInfo.user_name == user_name
        ).order_by(PostBoost.created_at.desc())
        
        all_boosted_boosts = boosted_query.all()
        logging.info(f"🔍 User {user_name}: Total boosted posts found: {len(all_boosted_boosts)}")
        
        # Separate boosted posts into top 3 and index-boosted
        top_boosted_posts = []  # First 3 most recent boosted posts
        index_boosted_post_ids = set()  # Other boosted posts for index boost
        
        seen_post_ids = set()  # Track unique post IDs to prevent duplicates
        for boost in all_boosted_boosts:
            try:
                post_info = PostInfo.query.get(boost.post_id)
                if post_info and (durationBy is True or (hasattr(durationBy, 'filter') and durationBy.filter(post_info).scalar())):
                    # Check if post is from banned subthread
                    if current_user.is_authenticated:
                        from yuuzone.subthreads.models import SubthreadBan
                        banned_subthreads = [ban.subthread_id for ban in SubthreadBan.query.filter_by(user_id=current_user.id).all()]
                        if post_info.thread_id in banned_subthreads:
                            continue  # Skip posts from banned subthreads
                    
                    # Only add if we haven't seen this post ID before
                    if post_info.post_id not in seen_post_ids:
                        post_dict = post_info.as_dict(current_user.id if current_user.is_authenticated else None)
                        post_dict['is_boosted'] = True
                        
                        # First 3 most recent boosted posts get top seats
                        if len(top_boosted_posts) < 3:
                            top_boosted_posts.append(post_dict)
                        else:
                            # Others get index boost
                            index_boosted_post_ids.add(post_info.post_id)
                        
                        seen_post_ids.add(post_info.post_id)
            except Exception as e:
                logging.warning(f"Error processing boosted post {boost.post_id}: {e}")
                continue
        
        # Log the results
        logging.info(f"✅ User {user_name}: Top boosted posts (first 3): {len(top_boosted_posts)}")
        logging.info(f"✅ User {user_name}: Index boosted posts: {len(index_boosted_post_ids)}")
        
    except Exception as e:
        logging.warning(f"Error fetching boosted posts for user {user_name}: {e}")
        top_boosted_posts = []
        index_boosted_post_ids = set()
    
    # Store ALL boosted post IDs for exclusion (top + index boosted)
    all_boosted_post_ids = set()
    for boost in all_boosted_boosts:
        try:
            post_info = PostInfo.query.get(boost.post_id)
            if post_info and (durationBy is True or (hasattr(durationBy, 'filter') and durationBy.filter(post_info).scalar())):
                all_boosted_post_ids.add(post_info.post_id)
        except Exception as e:
            logging.warning(f"Error processing boosted post {boost.post_id}: {e}")
            continue
    
    # Get base query for regular user posts
    query = PostInfo.query.filter(PostInfo.user_name == user_name)

    # Filter out posts from subthreads where the current user is banned
    if current_user.is_authenticated:
        from yuuzone.subthreads.models import SubthreadBan
        banned_subthreads = [ban.subthread_id for ban in SubthreadBan.query.filter_by(user_id=current_user.id).all()]
        if banned_subthreads:
            query = query.filter(~PostInfo.thread_id.in_(banned_subthreads))

    # Calculate how many regular posts we need
    # For pagination, we need to consider that top boosted posts are always at the top (max 3)
    if offset < len(top_boosted_posts):
        # User is requesting posts within the top boosted posts range
        # Return top boosted posts for this offset, plus regular posts to fill the limit
        start_idx = offset
        end_idx = min(offset + limit, len(top_boosted_posts))
        top_boosted_posts = top_boosted_posts[start_idx:end_idx]
        remaining_limit = limit - len(top_boosted_posts)  # Fill remaining slots with regular posts
        regular_offset = 0
    else:
        # User is requesting posts beyond the top boosted posts
        # Calculate how many regular posts we need
        boosted_slots_used = len(top_boosted_posts)
        remaining_limit = limit
        regular_offset = offset - boosted_slots_used
    
    # Get regular posts with index boost for older boosted posts
    regular_posts = []
    if remaining_limit > 0:
        # Only exclude top boosted posts, NOT index boosted posts
        top_boosted_post_ids = [post.get('post_info', {}).get('id') for post in top_boosted_posts if post.get('post_info', {}).get('id') is not None]
        
        logging.info(f"🔍 User {user_name}: Excluding {len(top_boosted_post_ids)} top boosted posts from regular posts: {top_boosted_post_ids}")
        logging.info(f"🔍 User {user_name}: Index boosted posts will appear in regular feed: {list(index_boosted_post_ids)}")
        
        if top_boosted_post_ids:
            query = query.filter(~PostInfo.post_id.in_(top_boosted_post_ids))
        
        # Get regular posts first
        base_regular_posts = [
            pinfo.as_dict(current_user.id if current_user.is_authenticated else None)
            for pinfo in query.order_by(sortBy)
            .filter(durationBy if durationBy is not True else True)
            .limit(remaining_limit * 2)  # Get more posts to account for index boost
            .offset(regular_offset)
            .all()
        ]
        
        # Apply index boost to posts that are in index_boosted_post_ids
        if index_boosted_post_ids:
            # Calculate boost amount: +3 positions or up to 15% of total posts
            total_posts_estimate = max(100, len(base_regular_posts) * 5)  # Estimate total posts
            boost_amount = min(3, int(total_posts_estimate * 0.15))  # +3 or up to 15%
            
            logging.info(f"🔍 User {user_name}: Applying index boost: +{boost_amount} positions to {len(index_boosted_post_ids)} posts")
            
            # Separate boosted and non-boosted posts
            boosted_regular_posts = []
            normal_regular_posts = []
            
            for post in base_regular_posts:
                post_id = post.get('post_info', {}).get('id')
                if post_id in index_boosted_post_ids:
                    post['is_index_boosted'] = True
                    post['is_boosted'] = True  # Keep the boosted styling!
                    boosted_regular_posts.append(post)
                else:
                    normal_regular_posts.append(post)
            
            # Apply boost by moving boosted posts up by boost_amount positions
            final_regular_posts = []
            boost_index = 0
            normal_index = 0
            
            while len(final_regular_posts) < remaining_limit and (boost_index < len(boosted_regular_posts) or normal_index < len(normal_regular_posts)):
                # Add boosted posts with their boost
                if boost_index < len(boosted_regular_posts):
                    final_regular_posts.append(boosted_regular_posts[boost_index])
                    boost_index += 1
                    
                    # Skip some normal posts to create the boost effect
                    skip_count = min(boost_amount, len(normal_regular_posts) - normal_index)
                    normal_index += skip_count
                
                # Add normal posts
                if normal_index < len(normal_regular_posts) and len(final_regular_posts) < remaining_limit:
                    final_regular_posts.append(normal_regular_posts[normal_index])
                    normal_index += 1
            
            regular_posts = final_regular_posts[:remaining_limit]
        else:
            regular_posts = base_regular_posts[:remaining_limit]
    
    # Combine top boosted and regular posts
    post_list = top_boosted_posts + regular_posts
    
    # Final verification: ensure no duplicates in final result
    final_post_ids = [p['post_info']['id'] for p in post_list if 'post_info' in p and 'id' in p['post_info'] and p['post_info']['id'] is not None]
    if len(final_post_ids) != len(set(final_post_ids)):
        logging.error(f"❌ CRITICAL User {user_name}: Duplicate posts found in final result! Total: {len(final_post_ids)}, Unique: {len(set(final_post_ids))}")
        # Remove duplicates while preserving order
        seen_ids = set()
        deduplicated_posts = []
        for post in post_list:
            post_id = post.get('post_info', {}).get('id')
            if post_id is not None and post_id not in seen_ids:
                seen_ids.add(post_id)
                deduplicated_posts.append(post)
        post_list = deduplicated_posts
        logging.info(f"✅ User {user_name}: Final deduplication: {len(post_list)} unique posts")
    
    logging.info(f"✅ User {user_name}: Final result: {len(top_boosted_posts)} top boosted + {len(regular_posts)} regular = {len(post_list)} total posts")
    logging.info(f"✅ User {user_name}: Index boosted posts in regular feed: {len([p for p in regular_posts if p.get('is_index_boosted')])}")
    return jsonify(post_list), 200


@posts.route("/posts/saved", methods=["GET"])
@login_required
def get_saved():
    limit = request.args.get("limit", default=20, type=int)
    offset = request.args.get("offset", default=0, type=int)

    # Get banned subthreads for current user
    from yuuzone.subthreads.models import SubthreadBan
    banned_subthreads = [ban.subthread_id for ban in SubthreadBan.query.filter_by(user_id=current_user.id).all()]

    saved_posts = SavedPosts.query.filter(SavedPosts.user_id == current_user.id).offset(offset).limit(limit).all()

    # Filter out posts from banned subthreads
    filtered_post_infos = []
    for saved_post in saved_posts:
        post_info = PostInfo.query.filter_by(post_id=saved_post.post_id).first()
        if post_info and post_info.thread_id not in banned_subthreads:
            filtered_post_infos.append(post_info.as_dict(current_user.id))

    return jsonify(filtered_post_infos), 200


@posts.route("/posts/saved/<pid>", methods=["DELETE"])
@login_required
def delete_saved(pid):
    # Check if user is banned from the subthread of this post
    post_info = PostInfo.query.filter_by(post_id=pid).first()
    if post_info:
        from yuuzone.subthreads.models import SubthreadBan
        banned = SubthreadBan.query.filter_by(user_id=current_user.id, subthread_id=post_info.thread_id).first()
        if banned:
            return jsonify({
                "message": "You are banned from this subthread",
                "banned": True,
                "redirect": f"/banned/{post_info.thread_id}"
            }), 403

    saved_post = SavedPosts.query.filter_by(user_id=current_user.id, post_id=pid).first()
    if not saved_post:
        return jsonify({"message": "Invalid Post ID"}), 400
    SavedPosts.query.filter_by(user_id=current_user.id, post_id=pid).delete()
    db.session.commit()
    return jsonify({"message": "Saved Post deleted"}), 200


@posts.route("/posts/saved/<pid>", methods=["PUT"])
@login_required
def new_saved(pid):
    # Check if user is banned from the subthread of this post
    post_info = PostInfo.query.filter_by(post_id=pid).first()
    if post_info:
        from yuuzone.subthreads.models import SubthreadBan
        banned = SubthreadBan.query.filter_by(user_id=current_user.id, subthread_id=post_info.thread_id).first()
        if banned:
            return jsonify({
                "message": "You are banned from this subthread",
                "banned": True,
                "redirect": f"/banned/{post_info.thread_id}"
            }), 403

    new_saved = SavedPosts(user_id=current_user.id, post_id=pid)
    db.session.add(new_saved)
    db.session.commit()
    return jsonify({"message": "Saved"}), 200


@posts.route("/giphy/search", methods=["GET"])
@login_required
def search_gifs():
    """Search for GIFs using Giphy API"""
    query = request.args.get('q', '')
    limit = int(request.args.get('limit', 20))
    offset = int(request.args.get('offset', 0))
    rating = request.args.get('rating', 'g')
    lang = request.args.get('lang', 'en')
    
    if not query:
        return jsonify({"message": "Query parameter 'q' is required"}), 400
    
    if limit > 50:
        limit = 50
    
    if offset > 499:
        offset = 499
    
    # Validate rating parameter
    valid_ratings = ['g', 'pg', 'pg-13', 'r']
    if rating not in valid_ratings:
        rating = 'g'
    
    try:
        giphy_service = GiphyService()
        gifs = giphy_service.search_gifs(query, limit, offset, rating, lang)
        
        return jsonify({
            "gifs": gifs,
            "query": query,
            "limit": limit,
            "offset": offset,
            "rating": rating,
            "lang": lang
        }), 200
        
    except Exception as e:
        logging.error(f"Giphy search failed: {e}")
        return jsonify({"message": f"Failed to search GIFs: {str(e)}"}), 500


@posts.route("/giphy/trending", methods=["GET"])
@login_required
def trending_gifs():
    """Get trending GIFs from Giphy"""
    limit = int(request.args.get('limit', 20))
    offset = int(request.args.get('offset', 0))
    rating = request.args.get('rating', 'g')
    
    if limit > 50:
        limit = 50
    
    if offset > 499:
        offset = 499
    
    # Validate rating parameter
    valid_ratings = ['g', 'pg', 'pg-13', 'r']
    if rating not in valid_ratings:
        rating = 'g'
    
    try:
        giphy_service = GiphyService()
        gifs = giphy_service.get_trending_gifs(limit, offset, rating)
        
        return jsonify({
            "gifs": gifs,
            "limit": limit,
            "offset": offset,
            "rating": rating
        }), 200
        
    except Exception as e:
        logging.error(f"Giphy trending failed: {e}")
        return jsonify({"message": f"Failed to get trending GIFs: {str(e)}"}), 500


@posts.route("/giphy/analytics", methods=["POST"])
@login_required
def register_giphy_action():
    """Register Giphy analytics action (view, click, send)"""
    try:
        data = request.get_json()
        gif_id = data.get('gif_id')
        action_type = data.get('action_type')
        
        if not gif_id or not action_type:
            return jsonify({"message": "gif_id and action_type are required"}), 400
        
        # Validate action type
        valid_actions = ['onload', 'onclick', 'onsent']
        if action_type not in valid_actions:
            return jsonify({"message": "Invalid action_type. Must be one of: onload, onclick, onsent"}), 400
        
        giphy_service = GiphyService()
        success = giphy_service.register_action(gif_id, action_type, str(current_user.id))
        
        if success:
            return jsonify({"message": "Action registered successfully"}), 200
        else:
            return jsonify({"message": "Failed to register action"}), 500
            
    except Exception as e:
        logging.error(f"Giphy analytics registration failed: {e}")
        return jsonify({"message": f"Failed to register action: {str(e)}"}), 500


@posts.route("/posts/debug-boosts", methods=["GET"])
def debug_boosts():
    """Debug endpoint to check boost status"""
    try:
        from yuuzone.coins.models import PostBoost
        from datetime import datetime, timezone
        
        now = datetime.now(timezone.utc)
        
        # Get all active boosts
        all_boosts = PostBoost.query.filter(
            PostBoost.is_active == True,
            PostBoost.boost_end > now
        ).all()
        
        # Get boost details
        boost_details = []
        for boost in all_boosts:
            post_info = PostInfo.query.get(boost.post_id)
            if post_info:
                boost_details.append({
                    'boost_id': boost.id,
                    'post_id': boost.post_id,
                    'user_id': boost.user_id,
                    'username': post_info.user_info.user_name if post_info.user_info else 'Unknown',
                    'post_title': post_info.title,
                    'boost_created': boost.created_at.isoformat(),
                    'boost_end': boost.boost_end.isoformat(),
                    'is_active': boost.is_active,
                    'thread_id': post_info.thread_id
                })
        
        return jsonify({
            'total_active_boosts': len(all_boosts),
            'current_time': now.isoformat(),
            'boost_details': boost_details
        }), 200
        
    except Exception as e:
        logging.error(f"Error in debug_boosts: {e}")
        return jsonify({"error": str(e)}), 500


@posts.route("/debug/user-roles/<user_id>/<subthread_id>", methods=["GET"])
@login_required
def debug_user_roles(user_id, subthread_id):
    """Debug endpoint to check user roles for a specific subthread"""
    try:
        from yuuzone.models import UserRole, Role
        
        # Check if current user is admin or the user being checked
        if current_user.id != int(user_id) and not current_user.is_admin:
            return jsonify({"message": "Unauthorized"}), 401
        
        user_roles = UserRole.query.filter_by(
            user_id=int(user_id),
            subthread_id=int(subthread_id)
        ).join(Role, UserRole.role_id == Role.id).all()
        
        role_data = []
        for user_role in user_roles:
            role_data.append({
                "user_id": user_role.user_id,
                "subthread_id": user_role.subthread_id,
                "role_id": user_role.role_id,
                "role_name": user_role.role.name,
                "role_slug": user_role.role.slug,
                "created_at": user_role.created_at.isoformat() if user_role.created_at else None
            })
        
        return jsonify({
            "user_id": int(user_id),
            "subthread_id": int(subthread_id),
            "roles": role_data,
            "has_mod_role": any(role["role_slug"] == "mod" for role in role_data),
            "has_admin_role": any(role["role_slug"] == "admin" for role in role_data)
        }), 200
        
    except Exception as e:
        logging.error(f"Error in debug_user_roles: {e}")
        return jsonify({"error": str(e)}), 500
