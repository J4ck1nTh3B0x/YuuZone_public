from yuuzone.comments.models import Comments, CommentInfo
from yuuzone import db, app
from yuuzone.posts.models import PostInfo
from flask import Blueprint, jsonify, request
from flask_login import login_required, current_user
from yuuzone.comments.utils import create_comment_tree
# Socket.IO will be handled in WSGI - use try/except for graceful fallback
try:
    from yuuzone.socketio_app import socketio
except ImportError:
    socketio = None

# Import rate limiting utilities
from yuuzone.utils.rate_limiter import combined_protection, rate_limit

comments = Blueprint("comments", __name__, url_prefix="/api")


@comments.route("/comments/post/<pid>", methods=["GET"])
def get_comments(pid):
    import logging
    
    try:
        # Check if current user is banned from the subthread of this post
        if current_user.is_authenticated:
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

        comments = (
            CommentInfo.query.filter_by(post_id=pid).order_by(CommentInfo.created_at.asc()).all()
        )
        
        cur_user = current_user.id if current_user.is_authenticated else None
        post_info = PostInfo.query.filter_by(post_id=pid).first()
        
        if not post_info:
            return jsonify({"message": "Invalid Post ID"}), 400
        
        # Handle case where there are no comments (empty list is valid)
        comment_info = create_comment_tree(comments=comments, cur_user=cur_user) if comments else []
        
        return (
            jsonify(
                {
                    "post_info": post_info.as_dict(cur_user),
                    "comment_info": comment_info,
                }
            ),
            200,
        )
    except Exception as e:
        logging.error(f"Error in get_comments for post {pid}: {e}")
        return jsonify({"message": "Internal server error", "error": str(e)}), 500


@comments.route("/comments/<cid>", methods=["PATCH"])
@login_required
def update_comment(cid):
    comment = Comments.query.filter_by(id=cid).first()
    if not comment:
        return jsonify({"message": "Invalid Comment"}), 400

    # Check if user is banned from the subthread of this comment's post
    from yuuzone.posts.models import Posts
    post = Posts.query.filter_by(id=comment.post_id).first()
    if post:
        from yuuzone.subthreads.models import SubthreadBan
        banned = SubthreadBan.query.filter_by(user_id=current_user.id, subthread_id=post.subthread_id).first()
        if banned:
            return jsonify({
                "message": "You are banned from this subthread",
                "banned": True,
                "redirect": f"/banned/{post.subthread_id}"
            }), 403

    if comment.user_id == current_user.id and request.json:
        new_content = request.json.get("content")
        comment.patch(new_content)

        # Emit real-time comment edit
        if socketio:
            try:
                socketio.emit('comment_edited', {
                    'comment_id': cid,
                    'post_id': comment.post_id,
                    'content': new_content,
                    'edited_by': current_user.username,
                    'edited_at': comment.updated_at.isoformat() if comment.updated_at else None
                }, room=f'{comment.post_id}')
            except Exception as e:
                import logging
                logging.error(f"Failed to emit comment edit: {e}")

        return jsonify({"message": "Comment updated"}), 200
    return jsonify({"message": "Unauthorized"}), 401


@comments.route("/comments/<cid>", methods=["DELETE"])
@login_required
def delete_comment(cid):
    comment = Comments.query.filter_by(id=cid).first()
    if not comment:
        return jsonify({"message": "Invalid Comment"}), 400

    # Check if user is banned from the subthread of this comment's post
    from yuuzone.posts.models import Posts
    post = Posts.query.filter_by(id=comment.post_id).first()
    if post:
        from yuuzone.subthreads.models import SubthreadBan
        banned = SubthreadBan.query.filter_by(user_id=current_user.id, subthread_id=post.subthread_id).first()
        if banned:
            return jsonify({
                "message": "You are banned from this subthread",
                "banned": True,
                "redirect": f"/banned/{post.subthread_id}"
            }), 403

    # Check if user is the comment owner
    if comment.user_id == current_user.id:
        post_id = comment.post_id
        Comments.query.filter_by(id=cid).delete()
        db.session.commit()

        # Emit real-time comment deletion
        if socketio:
            try:
                socketio.emit('comment_deleted', {
                    'comment_id': cid,
                    'post_id': post_id,
                    'deleted_by': current_user.username
                }, room=f'{post_id}')
            except Exception as e:
                import logging
                logging.error(f"Failed to emit comment deletion: {e}")

        return jsonify({"message": "Comment deleted"}), 200

    # Check if user is mod or admin of the subthread where the comment was made
    from yuuzone.models import UserRole
    user_role = UserRole.query.filter_by(
        user_id=current_user.id,
        subthread_id=comment.post.subthread_id
    ).join(UserRole.role).filter(
        UserRole.role.has(slug="mod") | UserRole.role.has(slug="admin")
    ).first()

    if user_role:
        post_id = comment.post_id
        Comments.query.filter_by(id=cid).delete()
        db.session.commit()

        # Emit real-time comment deletion (by mod/admin)
        if socketio:
            try:
                socketio.emit('comment_deleted', {
                    'comment_id': cid,
                    'post_id': post_id,
                    'deleted_by': current_user.username
                }, room=f'{post_id}')
            except Exception as e:
                import logging
                logging.error(f"Failed to emit comment deletion: {e}")

        return jsonify({"message": "Comment deleted"}), 200

    return jsonify({"message": "Unauthorized"}), 401


@comments.route("/comments", methods=["POST"])
@login_required
@combined_protection("comment")
def new_comment():
    form_data = request.json if request.is_json else request.form.to_dict()
    if not form_data:
        return jsonify({"message": "No input data provided"}), 400
    
    content = form_data.get("content")
    post_id = form_data.get("post_id")
    if not content or not post_id:
        return jsonify({"message": "Content and post_id are required"}), 400

    # Check if user is banned from the subthread where this post belongs
    from yuuzone.posts.models import Posts
    post = Posts.query.filter_by(id=post_id).first()
    if post:
        from yuuzone.subthreads.models import SubthreadBan
        banned = SubthreadBan.query.filter_by(user_id=current_user.id, subthread_id=post.subthread_id).first()
        if banned:
            return jsonify({
                "message": "You are banned from this subthread",
                "banned": True,
                "redirect": f"/banned/{post.subthread_id}"
            }), 403

    # Handle media uploads for comments
    media_list = []
    if request.files:
        images = request.files.getlist("media")
        if images and len(images) > 4:
            return jsonify({"message": "Maximum 4 images allowed per comment"}), 400
        
        # Process uploaded images
        for image in images:
            if image and image.filename:
                try:
                    from yuuzone.posts.models import Media
                    import cloudinary.uploader as uploader
                    import uuid
                    from werkzeug.utils import secure_filename
                    
                    filename = secure_filename(image.filename)
                    media_type = 'image' if image.content_type.startswith("image/") else 'video'
                    
                    if image.content_type.startswith("image/"):
                        image_data = uploader.upload(
                            image,
                            public_id=f"{uuid.uuid4().hex}_{filename.rsplit('.')[0]}",
                        )
                        if not image_data or not image_data.get('public_id'):
                            raise ValueError("Cloudinary upload failed: no public_id returned")
                        url = f"https://res.cloudinary.com/{app.config['CLOUDINARY_NAME']}/image/upload/c_auto,g_auto/{image_data.get('public_id')}"
                        media_list.append({
                            'url': url,
                            'type': media_type
                        })
                    elif image.content_type.startswith("video/"):
                        video_data = uploader.upload(
                            image,
                            resource_type="video",
                            public_id=f"{uuid.uuid4().hex}_{filename.rsplit('.')[0]}",
                        )
                        if not video_data or not video_data.get('playback_url'):
                            raise ValueError("Cloudinary video upload failed: no playback_url returned")
                        url = video_data.get("playback_url")
                        media_list.append({
                            'url': url,
                            'type': media_type
                        })
                except Exception as e:
                    return jsonify({"message": f"Failed to upload media: {str(e)}"}), 400

    # Fix: Extract string content if content is a dict
    if isinstance(content, dict) and "content" in content:
        form_data["content"] = content["content"]

    # Add media list to form data
    if media_list:
        form_data["media_list"] = media_list

    try:
        new_comment = Comments.add(form_data, current_user.id)
        # Prepare the response data structure - wrap the comment in the expected format
        response_data = {"comment": new_comment, "children": []}

        # Emit socket event for new comment (if Socket.IO available)
        if socketio:
            try:
                # Validate the data structure before emitting
                if response_data and 'comment' in response_data:
                    socketio.emit('new_comment', response_data, room=f'{post_id}')
                else:
                    import logging
                    logging.warning(f"Invalid comment data structure for Socket.IO emission: {response_data}")
            except Exception as e:
                import logging
                logging.error(f"Failed to emit new_comment event: {e}")
                # Don't re-raise the exception to prevent API failure
        return (
            jsonify(
                {
                    "message": "Comment created",
                    "new_comment": response_data,
                }
            ),
            200,
        )
    except Exception as e:
        return jsonify({"message": f"Failed to create comment: {str(e)}"}), 500
