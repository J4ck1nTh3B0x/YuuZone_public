import logging
import time
from yuuzone.subthreads.models import Subthread, SubthreadInfo, Subscription
# Socket.IO will be handled in WSGI - use try/except for graceful fallback
try:
    from yuuzone.socketio_app import socketio
except ImportError:
    socketio = None
from flask_login import current_user, login_required
import re
from yuuzone.users.models import User
from flask import Blueprint, jsonify, request
from yuuzone.models import UserRole
from yuuzone import db
from yuuzone.auth.decorators import auth_role

# Import rate limiting utilities
from yuuzone.utils.rate_limiter import rate_limit, combined_protection

threads = Blueprint("threads", __name__, url_prefix="/api")
thread_name_regex = re.compile(r"^\w{3,}$")


def check_user_banned(user_id, subthread_id):
    """Helper function to check if a user is banned from a subthread"""
    from yuuzone.subthreads.models import SubthreadBan
    return SubthreadBan.query.filter_by(user_id=user_id, subthread_id=subthread_id).first()


def create_ban_response(subthread_id):
    """Helper function to create a standardized ban response"""
    return jsonify({
        "message": "You are banned from this subthread",
        "banned": True,
        "redirect": f"/banned/{subthread_id}"
    }), 403

@threads.route("/threads/subscription/<int:tid>", methods=["POST"])
@login_required
@rate_limit("join_subthread")
def new_subscription(tid):
    # Check if user is banned from this subthread
    banned = check_user_banned(current_user.id, tid)
    if banned:
        return create_ban_response(tid)

    # Check if user already subscribed to avoid duplicate key error
    existing_sub = Subscription.query.filter_by(user_id=current_user.id, subthread_id=tid).first()
    if existing_sub:
        return jsonify({"message": "Already subscribed"}), 200

    Subscription.add(tid, current_user.id)

    # Commit the subscription to the database
    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        logging.error(f"Failed to save subscription: {e}")
        return jsonify({"message": "Failed to join subthread. Please try again."}), 500

    # Emit socket event for join (if Socket.IO available)
    if socketio:
        try:
            logging.info(f"📡 Emitting internal_subthread_update event: type=joined, subthreadId={tid}, userId={current_user.id}")
            # Emit internal update event that will be processed and broadcasted by socket handlers
            socketio.emit('internal_subthread_update', {
                'type': 'joined',
                'subthreadId': tid,
                'userId': current_user.id,
                'username': current_user.username
            })
            
            # Emit enhanced real-time events
            socketio.emit('subthread_stats_update', {
                'subthread_id': tid,
                'stats_type': 'subscriber_count',
                'new_value': 1,  # Increment by 1
                'updated_by': current_user.username
            }, room=f'{tid}')
            
            socketio.emit('user_activity', {
                'username': current_user.username,
                'activity_type': 'joining',
                'subthread_id': tid,
                'timestamp': None
            }, room=f'{tid}')
            
        except Exception as e:
            logging.error(f"Failed to emit internal_subthread_update event: {e}")

    return jsonify({"message": "Subscribed"}), 200

@threads.route("/threads/subscription/<int:tid>", methods=["DELETE"])
@login_required
def del_subscription(tid):
    subscription = Subscription.query.filter_by(user_id=current_user.id, subthread_id=tid).first()
    if not subscription:
        return jsonify({"message": "Invalid Subscription"}), 400

    # Check user roles in the subthread
    mod_role = UserRole.query.filter_by(user_id=current_user.id, subthread_id=tid, role_id=1).first()
    admin_role = UserRole.query.filter_by(user_id=current_user.id, subthread_id=tid, role_id=2).first()

    # If user is admin, check if they are the only admin/mod in the subthread
    if admin_role:
        # Count number of admins and mods in the subthread
        admin_count = UserRole.query.filter_by(subthread_id=tid, role_id=2).count()
        mod_count = UserRole.query.filter_by(subthread_id=tid, role_id=1).count()
        total_mod_admin = admin_count + mod_count

        # If only one admin/mod (the current user), prevent leaving
        if total_mod_admin <= 1:
            return jsonify({"message": "You are the only admin/mod in this subthread. Transfer admin rights before leaving."}), 400

        # If more than one, check if admin rights have been transferred (i.e., current user no longer admin)
        # But since admin_role exists, means not transferred yet, so prevent leaving
        return jsonify({"message": "Transfer admin rights to another mod before leaving this subthread."}), 400

    # If user is mod, remove mod rights immediately
    if mod_role:
        db.session.delete(mod_role)

    # Remove subscription
    db.session.delete(subscription)
    db.session.commit()

    # Emit socket event for leave (if Socket.IO available)
    if socketio:
        try:
            logging.info(f"📡 Emitting internal_subthread_update event: type=left, subthreadId={tid}, userId={current_user.id}")
            # Emit internal update event that will be processed and broadcasted by socket handlers
            socketio.emit('internal_subthread_update', {
                'type': 'left',
                'subthreadId': tid,
                'userId': current_user.id,
                'username': current_user.username
            })
            
        except Exception as e:
            logging.error(f"Failed to emit internal_subthread_update event: {e}")

    return jsonify({"message": "Unsubscribed and mod rights removed if applicable"}), 200


@threads.route("/threads", methods=["GET"])
def get_subthreads():
    try:
        limit = request.args.get("limit", default=10, type=int)
        offset = request.args.get("offset", default=0, type=int)
        cur_user = current_user.id if current_user.is_authenticated else None
        
        # Add connection management
        connection_id = f"threads_api_{int(time.time() * 1000)}"
        try:
            from yuuzone.utils.connection_manager import connection_manager
            from yuuzone.utils.system_monitor import system_monitor
            
            # Check if system can handle request
            if not system_monitor.should_accept_connections():
                return jsonify({"error": "System overloaded"}), 503
            
            # Register connection
            if not connection_manager.register_connection(connection_id, "api_threads"):
                return jsonify({"error": "Connection limit reached"}), 503
                
        except ImportError:
            # Connection management not available, continue without it
            pass
        
        subscribed_threads = []
        if current_user.is_authenticated:
            try:
                # Check if the function exists first (functions are stored differently)
                function_exists = db.session.execute(
                    db.text("SELECT 1 FROM information_schema.routines WHERE routine_name = 'get_user_subscriptions'")
                ).scalar()
                
                if function_exists:
                    # Use optimized function for user subscriptions
                    result = db.session.execute(
                        db.text("SELECT * FROM get_user_subscriptions(:user_id, :limit, :offset)"),
                        {"user_id": cur_user, "limit": limit, "offset": offset}
                    ).fetchall()
                    
                    subscribed_threads = []
                    for row in result:
                        subthread_data = {
                            "id": row.id,
                            "name": row.name,
                            "logo": row.logo,
                            "description": row.description,
                            "created_at": row.created_at,
                            "created_by": row.created_by,
                            "subscriberCount": row.members_count,
                            "PostsCount": row.posts_count,
                            "CommentsCount": row.comments_count,
                            "has_subscribed": True
                        }
                        subscribed_threads.append(subthread_data)
                else:
                    # Function doesn't exist, use fallback
                    raise Exception("Function not found")
                    
            except Exception as e:
                logging.error(f"Error fetching user subscriptions: {e}")
                # Rollback any failed transaction
                try:
                    db.session.rollback()
                except:
                    pass
                # Fallback to original query
                subscribed_threads = [
                    subscription.subthread.as_dict(cur_user)
                    for subscription in Subscription.query.filter_by(user_id=current_user.id).limit(limit).offset(offset).all()
                ]
        
        # Use materialized view for better performance
        try:
            # Check if the materialized view exists first (materialized views are in pg_matviews)
            view_exists = db.session.execute(
                db.text("SELECT 1 FROM pg_matviews WHERE matviewname = 'subthread_stats_mv'")
            ).scalar()
            
            if view_exists:
                all_threads_result = db.session.execute(
                    db.text("""
                        SELECT * FROM subthread_stats_mv 
                        WHERE members_count > 0 
                        ORDER BY members_count DESC 
                        LIMIT :limit OFFSET :offset
                    """),
                    {"limit": limit, "offset": offset}
                ).fetchall()
                
                all_threads = []
                for row in all_threads_result:
                    subthread_data = {
                        "id": row.id,
                        "name": row.name,
                        "logo": row.logo,
                        "description": row.description,
                        "created_at": row.created_at,
                        "created_by": row.created_by,
                        "subscriberCount": row.members_count,
                        "PostsCount": row.posts_count,
                        "CommentsCount": row.comments_count
                    }
                    all_threads.append(subthread_data)
            else:
                # View doesn't exist, use fallback
                raise Exception("Materialized view not found")
                
        except Exception as e:
            logging.error(f"Error fetching all threads: {e}")
            # Rollback any failed transaction
            try:
                db.session.rollback()
            except:
                pass
            # Fallback to original query
            all_threads = [
                subinfo.as_dict()
                for subinfo in SubthreadInfo.query.filter(SubthreadInfo.members_count.is_not(None))
                .order_by(SubthreadInfo.members_count.desc())
                .limit(limit)
                .offset(offset)
                .all()
            ]
        
        try:
            # Check if the materialized view exists first (materialized views are in pg_matviews)
            view_exists = db.session.execute(
                db.text("SELECT 1 FROM pg_matviews WHERE matviewname = 'subthread_stats_mv'")
            ).scalar()
            
            if view_exists:
                popular_threads_result = db.session.execute(
                    db.text("""
                        SELECT * FROM subthread_stats_mv 
                        WHERE posts_count > 0 
                        ORDER BY posts_count DESC 
                        LIMIT :limit OFFSET :offset
                    """),
                    {"limit": limit, "offset": offset}
                ).fetchall()
                
                popular_threads = []
                for row in popular_threads_result:
                    subthread_data = {
                        "id": row.id,
                        "name": row.name,
                        "logo": row.logo,
                        "description": row.description,
                        "created_at": row.created_at,
                        "created_by": row.created_by,
                        "subscriberCount": row.members_count,
                        "PostsCount": row.posts_count,
                        "CommentsCount": row.comments_count
                    }
                    popular_threads.append(subthread_data)
            else:
                # View doesn't exist, use fallback
                raise Exception("Materialized view not found")
                
        except Exception as e:
            logging.error(f"Error fetching popular threads: {e}")
            # Rollback any failed transaction
            try:
                db.session.rollback()
            except:
                pass
            # Fallback to original query
            popular_threads = [
                subinfo.as_dict()
                for subinfo in SubthreadInfo.query.filter(SubthreadInfo.posts_count.is_not(None))
                .order_by(SubthreadInfo.posts_count.desc())
                .limit(limit)
                .offset(offset)
                .all()
            ]
        
        # Cleanup connection
        try:
            if 'connection_id' in locals():
                from yuuzone.utils.connection_manager import connection_manager
                connection_manager.remove_connection(connection_id, "api_complete")
        except:
            pass
        
        return (
            jsonify(
                {
                    "subscribed": subscribed_threads,
                    "all": all_threads,
                    "popular": popular_threads,
                }
            ),
            200,
        )
    except Exception as e:
        logging.error(f"Error in get_subthreads: {e}")
        # Cleanup connection on error
        try:
            if 'connection_id' in locals():
                from yuuzone.utils.connection_manager import connection_manager
                connection_manager.remove_connection(connection_id, "api_error")
        except:
            pass
        return jsonify({"error": "Failed to get subthreads"}), 500


@threads.route("/threads/search", methods=["GET"])
def subthread_search():
    thread_name = request.args.get("name", default="", type=str)
    # Remove any leading "t/" prefix for consistent search
    if thread_name.startswith("t/"):
        thread_name = thread_name[2:]
    thread_name = f"%t/{thread_name}%"
    subthread_list = [
        subthread.as_dict() for subthread in SubthreadInfo.query.filter(SubthreadInfo.name.ilike(thread_name)).all()
    ]
    return jsonify(subthread_list), 200


@threads.route("/search", methods=["GET"])
def combined_search():
    query = request.args.get("q", default="", type=str)
    if not query:
        return jsonify([]), 200

    # Handle "t/" prefix for subthread search
    search_query = query
    if not search_query.startswith("t/"):
        search_query = f"t/{search_query}"

    combined_results = []
    
    try:
        # Check if the function exists first
        function_exists = db.session.execute(
            db.text("SELECT 1 FROM information_schema.routines WHERE routine_name = 'search_subthreads'")
        ).scalar()
        
        if function_exists:
            # Use optimized subthread search function
            subthreads_result = db.session.execute(
                db.text("SELECT * FROM search_subthreads(:search_query, 10)"),
                {"search_query": search_query}
            ).fetchall()
            
            subthread_results = []
            for row in subthreads_result:
                subthread_data = {
                    "id": row.id,
                    "name": row.name,
                    "logo": row.logo,
                    "description": row.description,
                    "created_at": row.created_at,
                    "created_by": row.created_by,
                    "subscriberCount": row.members_count,
                    "PostsCount": row.posts_count,
                    "CommentsCount": row.comments_count,
                    "type": "subthread"
                }
                subthread_results.append(subthread_data)
            
            combined_results.extend(subthread_results)
        else:
            # Function doesn't exist, use fallback
            raise Exception("Search function not found")
            
    except Exception as e:
        logging.error(f"Error in optimized subthread search: {e}")
        # Rollback any failed transaction
        try:
            db.session.rollback()
        except:
            pass
        # Fallback to original query
        subthread_query = f"%{search_query}%"
        subthreads = SubthreadInfo.query.filter(SubthreadInfo.name.ilike(subthread_query)).all()
        subthread_results = [sub.as_dict() | {"type": "subthread"} for sub in subthreads]
        combined_results.extend(subthread_results)

    try:
        # Check if the function exists first
        function_exists = db.session.execute(
            db.text("SELECT 1 FROM information_schema.routines WHERE routine_name = 'search_users'")
        ).scalar()
        
        if function_exists:
            # Use optimized user search function
            users_result = db.session.execute(
                db.text("SELECT * FROM search_users(:search_query, 10)"),
                {"search_query": query}
            ).fetchall()
            
            user_results = []
            for row in users_result:
                user_data = {
                    "id": row.id,
                    "username": row.username,
                    "avatar": row.avatar,
                    "bio": row.bio,
                    "registration_date": row.registration_date,
                    "type": "user"
                }
                user_results.append(user_data)
            
            combined_results.extend(user_results)
        else:
            # Function doesn't exist, use fallback
            raise Exception("Search function not found")
            
    except Exception as e:
        logging.error(f"Error in optimized user search: {e}")
        # Rollback any failed transaction
        try:
            db.session.rollback()
        except:
            pass
        # Fallback to original query
        users = User.query.filter(
            User.username.ilike(f"%{query}%"), 
            User.is_email_verified == True,
            User.deleted == False,
            ~User.username.startswith("del_")  # Exclude deleted accounts
        ).all()
        user_results = [user.as_dict() | {"type": "user"} for user in users]
        combined_results.extend(user_results)

    return jsonify(combined_results), 200


@threads.route("/threads/get/all")
def get_all_thread():
    threads = Subthread.query.order_by(Subthread.name).all()
    return jsonify([t.as_dict() for t in threads]), 200


@threads.route("/threads/<thread_name>")
def get_thread_by_name(thread_name):
    thread_info = SubthreadInfo.query.filter_by(name=f"t/{thread_name}").first()
    subthread = Subthread.query.filter_by(name=f"t/{thread_name}").first()
    if not thread_info or not subthread:
        return jsonify({"message": "Thread not found"}), 404
    thread_info_dict = thread_info.as_dict(current_user.id if current_user.is_authenticated else None)
    subthread_dict = subthread.as_dict(current_user.id if current_user.is_authenticated else None)

    # Fetch detailed mod/admin roles for this subthread
    from yuuzone.models import UserRole
    try:
        mod_roles = UserRole.query.filter(
            UserRole.subthread_id == subthread.id,
            UserRole.role.has(slug="mod") | UserRole.role.has(slug="admin")
        ).all()
    except Exception as e:
        logging.error(f"Error fetching mod roles for subthread {subthread.id}: {e}")
        mod_roles = []

    # Create detailed mod list with role information, consolidating users with multiple roles
    user_roles_dict = {}
    for role in mod_roles:
        try:
            if role.user and role.role:  # Ensure both user and role exist
                username = role.user.username
                if username not in user_roles_dict:
                    user_roles_dict[username] = {
                        "username": username,
                        "isMod": False,
                        "isAdmin": False,
                        "avatar": role.user.avatar if role.user.avatar else None
                    }

                # Set role flags
                if role.role.slug == "mod":
                    user_roles_dict[username]["isMod"] = True
                elif role.role.slug == "admin":
                    user_roles_dict[username]["isAdmin"] = True
        except Exception as e:
            logging.error(f"Error processing mod role {role.id}: {e}")
            continue

    mod_list = list(user_roles_dict.values())

    # Get current user's roles in this subthread (can have multiple roles)
    current_user_roles = []
    current_user_role = None  # Keep for backward compatibility
    if current_user.is_authenticated:
        user_roles = UserRole.query.filter_by(
            user_id=current_user.id,
            subthread_id=subthread.id
        ).join(UserRole.role).all()

        for user_role in user_roles:
            if user_role.role.slug == "admin":
                current_user_roles.append("admin")
                current_user_role = "admin"  # Admin takes precedence for backward compatibility
            elif user_role.role.slug == "mod":
                current_user_roles.append("mod")
                if current_user_role != "admin":  # Only set if not already admin
                    current_user_role = "mod"

    # Add created_by_username for frontend admin display
    created_by_user = User.query.filter_by(id=subthread.created_by, is_email_verified=True).first()
    created_by_username = created_by_user.username if created_by_user else None

    # Enhanced thread data with detailed mod information
    combined_dict = {
        **thread_info_dict,
        **subthread_dict,
        "modList": mod_list,  # Detailed mod list with roles
        "currentUserRole": current_user_role,  # Keep for backward compatibility
        "currentUserRoles": current_user_roles,  # New: all roles for the user
        "created_by_username": created_by_username,
        "isOwner": current_user.is_authenticated and subthread.created_by == current_user.id
    }
    return jsonify({"threadData": combined_dict}), 200


@threads.route("/thread/<int:thread_id>", methods=["GET"])
def get_thread_by_id(thread_id):
    """Get thread data by ID with detailed mod list and current user role"""
    subthread = Subthread.query.filter_by(id=thread_id).first()
    if not subthread:
        return jsonify({"message": "Thread not found"}), 404

    # Check if current user is banned from this subthread
    if current_user.is_authenticated:
        banned = check_user_banned(current_user.id, thread_id)
        if banned:
            return create_ban_response(thread_id)

    # Get basic thread data
    thread_data = subthread.as_dict(current_user.id if current_user.is_authenticated else None)

    # Fetch detailed mod/admin roles for this subthread
    from yuuzone.models import UserRole
    try:
        mod_roles = UserRole.query.filter(
            UserRole.subthread_id == thread_id,
            UserRole.role.has(slug="mod") | UserRole.role.has(slug="admin")
        ).all()
    except Exception as e:
        logging.error(f"Error fetching mod roles for subthread {thread_id}: {e}")
        mod_roles = []

    # Create detailed mod list with role information, consolidating users with multiple roles
    user_roles_dict = {}
    for role in mod_roles:
        try:
            if role.user and role.role:  # Ensure both user and role exist
                username = role.user.username
                if username not in user_roles_dict:
                    user_roles_dict[username] = {
                        "username": username,
                        "isMod": False,
                        "isAdmin": False,
                        "avatar": role.user.avatar if role.user.avatar else None
                    }

                # Set role flags
                if role.role.slug == "mod":
                    user_roles_dict[username]["isMod"] = True
                elif role.role.slug == "admin":
                    user_roles_dict[username]["isAdmin"] = True
        except Exception as e:
            logging.error(f"Error processing mod role {role.id}: {e}")
            continue

    mod_list = list(user_roles_dict.values())

    # Get current user's roles in this subthread (can have multiple roles)
    current_user_roles = []
    current_user_role = None  # Keep for backward compatibility
    if current_user.is_authenticated:
        user_roles = UserRole.query.filter_by(
            user_id=current_user.id,
            subthread_id=thread_id
        ).join(UserRole.role).all()

        for user_role in user_roles:
            if user_role.role.slug == "admin":
                current_user_roles.append("admin")
                current_user_role = "admin"  # Admin takes precedence for backward compatibility
            elif user_role.role.slug == "mod":
                current_user_roles.append("mod")
                if current_user_role != "admin":  # Only set if not already admin
                    current_user_role = "mod"

    # Add created_by_username for frontend admin display
    created_by_user = User.query.filter_by(id=subthread.created_by, is_email_verified=True).first()
    created_by_username = created_by_user.username if created_by_user else None

    # Enhanced thread data with detailed mod information
    enhanced_data = {
        **thread_data,
        "modList": mod_list,  # Detailed mod list with roles
        "currentUserRole": current_user_role,  # Keep for backward compatibility
        "currentUserRoles": current_user_roles,  # New: all roles for the user
        "created_by_username": created_by_username,
        "isOwner": current_user.is_authenticated and subthread.created_by == current_user.id
    }

    return jsonify({"threadData": enhanced_data}), 200


@threads.route("/thread", methods=["POST"])
@login_required
def new_thread():
    image = request.files.get("media")
    form_data = request.form.to_dict()
    try:
        name = form_data.get("name", "").strip()
        if not name or not thread_name_regex.match(name):
            return jsonify({"message": "Subthread name is required and must be valid. Please enter a name for your subthread."}), 400

        subthread = Subthread.add(form_data, image, current_user.id)
        if subthread:
            UserRole.add_moderator(current_user.id, subthread.id)
            return jsonify({"message": "Subthread created successfully"}), 200
        return jsonify({"message": "Failed to create subthread. Please try again or contact support if the problem persists."}), 500
    except ValueError as e:
        return jsonify({"message": str(e)}), 400
    except Exception as e:
        logging.error(f"Unexpected error in new_thread: {e}")
        return jsonify({"message": "An unexpected error occurred. Please try again or contact support if the problem persists."}), 500


@threads.route("/new-subthread", methods=["POST"])
@login_required
@rate_limit("create_subthread")
def new_subthread():
    image = request.files.get("media")
    form_data = request.form.to_dict()
    try:
        # Validate required fields
        name = form_data.get("name", "").strip()
        if not name:
            return jsonify({"message": "Subthread name is required. Please enter a name for your subthread."}), 400

        # Use a database transaction to ensure all operations succeed or fail together
        try:
            #logging.info(f"Creating subthread with name: {name} for user: {current_user.id}")
            subthread = Subthread.add(form_data, image, current_user.id)
            if subthread:
                #logging.info(f"Subthread created with ID: {subthread.id}, adding roles...")
                # Add roles and subscription
                UserRole.add_moderator(current_user.id, subthread.id)
                UserRole.add_admin(current_user.id, subthread.id)
                from yuuzone.subthreads.models import Subscription
                Subscription.add(subthread.id, current_user.id)
                # Commit all changes at once
                db.session.commit()
                #logging.info(f"Subthread {subthread.name} created successfully")

                # Emit real-time subthread creation event
                if socketio:
                    try:
                        subthread_data = subthread.as_dict() if hasattr(subthread, 'as_dict') else {
                            'id': subthread.id,
                            'name': subthread.name,
                            'description': subthread.description,
                            'logo': subthread.logo,
                            'subscriberCount': 1,  # Creator is automatically subscribed
                            'PostsCount': 0,
                            'CommentsCount': 0
                        }
                        
                        # Emit the event in the format expected by the frontend
                        logging.info(f"📡 Emitting internal_subthread_update event: type=created, subthreadId={subthread.id}")
                        socketio.emit('internal_subthread_update', {
                            'type': 'created',
                            'subthreadId': subthread.id,
                            'name': subthread.name,
                            'description': subthread.description,
                            'logo': subthread.logo,
                            'created_by': current_user.username,
                            'subthread_data': {
                            'id': subthread.id,
                            'name': subthread.name,
                            'description': subthread.description,
                            'logo': subthread.logo,
                                'subscriberCount': 1,  # Creator is automatically subscribed
                                'PostsCount': 0,
                                'CommentsCount': 0
                            }
                        })
                        
                    except Exception as e:
                        logging.error(f"Failed to emit subthread creation event: {e}")

                return jsonify({"message": "Subthread created successfully"}), 200
            else:
                logging.error("Subthread.add returned None")
                return jsonify({"message": "Failed to create subthread. Please try again or contact support if the problem persists."}), 500
        except Exception as db_error:
            # Rollback any partial changes
            db.session.rollback()
            logging.error(f"Database error in new_subthread: {db_error}")

            # Check if it's a duplicate name error and provide specific feedback
            error_str = str(db_error).lower()
            if "already taken" in error_str or "duplicate" in error_str or "unique constraint" in error_str:
                # Extract the attempted name for better error message
                attempted_name = form_data.get("name", "").strip()
                if not attempted_name.startswith("t/"):
                    attempted_name = f"t/{attempted_name}"
                return jsonify({
                    "message": f"The subthread name '{attempted_name}' is already taken. Please choose a different name."
                }), 400

            return jsonify({"message": "Database error occurred while creating subthread. Please try again later."}), 500
    except ValueError as e:
        logging.error(f"ValueError in new_subthread: {e}")
        return jsonify({"message": str(e)}), 400
    except Exception as e:
        logging.error(f"Unexpected error in new_subthread: {e}")
        return jsonify({"message": "An unexpected error occurred. Please try again or contact support if the problem persists."}), 500


@threads.route("/thread/<tid>", methods=["PATCH"])
@login_required
@auth_role(["admin", "mod"])
def update_thread(tid):
    thread = Subthread.query.filter_by(id=tid).first()
    if not thread:
        return jsonify({"message": "Invalid Thread"}), 400
    image = request.files.get("media")
    form_data = request.form.to_dict()
    try:
        thread.patch(form_data, image)
        
        # Emit socket event for subthread update
        if socketio:
            try:
                updated_fields = {}
                if 'name' in form_data:
                    updated_fields['name'] = form_data['name']
                if 'description' in form_data:
                    updated_fields['description'] = form_data['description']
                if image:
                    updated_fields['logo'] = thread.logo
                
                if updated_fields:
                    logging.info(f"📡 Emitting internal_subthread_update event: type=updated, subthreadId={thread.id}")
                    socketio.emit('internal_subthread_update', {
                        'type': 'updated',
                        'subthreadId': thread.id,
                        'updated_fields': updated_fields,
                        'username': current_user.username
                    })
                    
            except Exception as e:
                logging.error(f"Failed to emit internal_subthread_update event: {e}")
                
    except ValueError as e:
        return jsonify({"message": str(e)}), 400
    return (
        jsonify(
            {
                "message": "Thread updated",
                "new_data": {"threadData": thread.as_dict(current_user.id if current_user.is_authenticated else None)},
            }
        ),
        200,
    )


@threads.route("/thread/<tid>", methods=["DELETE"])
@login_required
@auth_role(["admin", "mod"])
def delete_thread(tid):
    thread = Subthread.query.filter_by(id=tid).first()
    if not thread:
        return jsonify({"message": "Invalid Thread"}), 400
    # Allow deletion if user is owner or admin of the subthread
    is_admin = UserRole.query.filter_by(user_id=current_user.id, subthread_id=tid).join(UserRole.role).filter_by(slug="admin").first()
    if thread.created_by != current_user.id and not is_admin:
        return jsonify({"message": "Only the owner or an admin can delete this subthread"}), 403

    try:
        # Store subthread info before deletion for socket event
        subthread_info = {
            'id': thread.id,
            'name': thread.name
        }
        
        # Use raw SQL to delete the subthread and let database handle cascades
        # This avoids SQLAlchemy trying to update the subthread_info view
        db.session.execute(db.text("DELETE FROM subthreads WHERE id = :tid"), {"tid": tid})
        db.session.commit()

        # Emit socket event for subthread deletion
        if socketio:
            try:
                logging.info(f"📡 Emitting internal_subthread_update event: type=deleted, subthreadId={subthread_info['id']}")
                socketio.emit('internal_subthread_update', {
                    'type': 'deleted',
                    'subthreadId': subthread_info['id'],
                    'name': subthread_info['name']
                })
                    
            except Exception as e:
                logging.error(f"Failed to emit internal_subthread_update event: {e}")

        return jsonify({"message": "Subthread deleted successfully"}), 200

    except Exception as e:
        db.session.rollback()
        logging.error(f"Error deleting subthread {tid}: {e}")
        return jsonify({"message": "Failed to delete subthread"}), 500

@threads.route("/thread/<tid>/subscribers", methods=["GET"])
@login_required
@auth_role(["mod", "admin"])
def get_subscribers(tid):
    # Check if current user is mod or admin of the subthread
    role = UserRole.query.filter_by(user_id=current_user.id, subthread_id=tid).join(UserRole.role).filter(
        UserRole.role.has(slug="mod") | UserRole.role.has(slug="admin")
    ).first()
    if not role:
        return jsonify({"message": "Unauthorized"}), 403

    # Query subscriptions for the subthread
    subscriptions = Subscription.query.filter_by(subthread_id=tid).all()
    user_ids = [sub.user_id for sub in subscriptions]

    # Query user info for subscribed users
    users = User.query.filter(User.id.in_(user_ids), User.is_email_verified == True).all()
    user_list = [{"id": user.id, "username": user.username} for user in users]

    return jsonify(user_list), 200

@threads.route("/thread/<tid>/transfer-ownership/<username>", methods=["POST"])
@login_required
@auth_role(["admin"])
def transfer_ownership(tid, username):
    thread = Subthread.query.filter_by(id=tid).first()
    if not thread:
        return jsonify({"message": "Invalid Thread"}), 400
    if thread.created_by != current_user.id:
        return jsonify({"message": "Only the owner can transfer ownership"}), 403
    user = User.query.filter(
        User.username == username, 
        User.is_email_verified == True,
        User.deleted == False,
        ~User.username.startswith("del_")  # Exclude deleted accounts
    ).first()
    if not user:
        return jsonify({"message": "Invalid User"}), 400

    # Check if trying to transfer ownership to themselves
    if user.id == current_user.id:
        return jsonify({"message": "You cannot transfer ownership to yourself"}), 400

    # Check if user is a mod of the subthread
    mod_role = UserRole.query.filter_by(user_id=user.id, subthread_id=tid).join(UserRole.role).filter_by(slug="mod").first()
    if not mod_role:
        return jsonify({"message": "User is not a mod of this subthread"}), 400
    # Remove admin role from old owner
    old_admin_role = UserRole.query.filter_by(user_id=thread.created_by, subthread_id=tid).join(UserRole.role).filter_by(slug="admin").first()
    if old_admin_role:
        db.session.delete(old_admin_role)
    # Add admin role to new owner
    UserRole.add_admin(user.id, tid)
    # Transfer ownership
    thread.created_by = user.id
    db.session.commit()
    return jsonify({"message": f"Ownership transferred to {username}"}), 200


@threads.route("/thread/mod/<tid>/<username>", methods=["PUT"])
@login_required
@auth_role(["admin"])
def new_mod(tid, username):
    user = User.query.filter(
        User.username == username, 
        User.is_email_verified == True,
        User.deleted == False,
        ~User.username.startswith("del_")  # Exclude deleted accounts
    ).first()
    if user:
        # Check if user has joined the subthread
        from yuuzone.subthreads.models import Subscription
        subscription = Subscription.query.filter_by(user_id=user.id, subthread_id=tid).first()
        if not subscription:
            return jsonify({"message": "User must join the subthread before being added as a mod"}), 400
        UserRole.add_moderator(user.id, tid)
        # Emit socket event for mod added (if Socket.IO available)
        if socketio:
            try:
                socketio.emit('mod_added', {'thread_id': tid, 'username': username})
            except Exception as e:
                logging.error(f"Failed to emit mod_added event: {e}")
        return jsonify({"message": "Moderator added"}), 200
    return jsonify({"message": "Invalid User"}), 400


@threads.route("/thread/mod/<tid>/<username>", methods=["DELETE"])
@login_required
@auth_role(["admin"])
def delete_mod(tid, username):
    user = User.query.filter(
        User.username == username, 
        User.is_email_verified == True,
        User.deleted == False,
        ~User.username.startswith("del_")  # Exclude deleted accounts
    ).first()
    thread = Subthread.query.filter_by(id=tid).first()
    if user and thread:
        # Check if trying to remove themselves
        if user.id == current_user.id:
            return jsonify({"message": "You cannot remove yourself as a moderator"}), 400

        # Check if trying to remove the thread creator - only the owner can do this
        if thread.created_by == user.id and thread.created_by != current_user.id:
            return jsonify({"message": "Cannot Remove Thread Creator"}), 400
        UserRole.query.filter_by(user_id=user.id, subthread_id=tid).delete()
        db.session.commit()
        # Emit socket event for mod removed (if Socket.IO available)
        if socketio:
            try:
                socketio.emit('mod_removed', {'thread_id': tid, 'username': username})
                # Emit demotion event to the user
                socketio.emit('you_were_demoted', {
                    'subthread_id': tid,
                    'removed_by': current_user.username,
                    'role': 'mod'
                }, room=f'user_{username}')
            except Exception as e:
                logging.error(f"Failed to emit mod_removed or demotion event: {e}")
        return jsonify({"message": "Moderator deleted"}), 200
    return jsonify({"message": "Invalid User"}), 400


@threads.route("/threads/managed-subthread", methods=["GET"])
@login_required
def get_managed_subthreads():
    try:
        # Use the optimized database function for better performance
        result = db.session.execute(
            db.text("SELECT * FROM get_managed_subthreads(:user_id)"),
            {"user_id": current_user.id}
        ).fetchall()
        
        managed_subthreads = []
        for row in result:
            subthread_data = {
                "id": row.id,
                "name": row.name,
                "logo": row.logo,
                "description": row.description,
                "created_at": row.created_at,
                "created_by": row.created_by,
                "subscriberCount": row.members_count,
                "PostsCount": row.posts_count,
                "CommentsCount": row.comments_count,
                "isAdmin": row.is_admin,
                "isMod": row.is_mod,
                "has_subscribed": True  # If they're managing it, they're subscribed
            }
            managed_subthreads.append(subthread_data)
        
        # Emit socket event for managed subthreads fetch (optional, can be removed if not needed)
        if socketio:
            try:
                socketio.emit('managed_subthreads_fetched', {'user_id': current_user.id})
            except Exception as e:
                logging.error(f"Failed to emit managed_subthreads_fetched event: {e}")
        
        return jsonify(managed_subthreads), 200
    except Exception as e:
        logging.error(f"Error fetching managed subthreads: {e}")
        # Fallback to original query if function fails
        managed_subthreads = (
            Subthread.query.join(UserRole)
            .filter(UserRole.user_id == current_user.id)
            .filter(
                (UserRole.role.has(slug="mod")) | (UserRole.role.has(slug="admin"))
            )
            .all()
        )
        return jsonify([subthread.as_dict(current_user.id) for subthread in managed_subthreads]), 200


@threads.route("/thread/<tid>/ban/<username>", methods=["POST"])
@login_required
@auth_role(["admin", "mod"])
def ban_user(tid, username):
    try:
        # Validate subthread exists
        subthread = Subthread.query.filter_by(id=tid).first()
        if not subthread:
            return jsonify({"message": "Subthread not found"}), 404

        # Validate user exists
        user = User.query.filter(
            User.username == username, 
            User.is_email_verified == True,
            User.deleted == False,
            ~User.username.startswith("del_")  # Exclude deleted accounts
        ).first()
        if not user:
            return jsonify({"message": "User not found"}), 404

        # Check if trying to ban themselves
        if user.id == current_user.id:
            return jsonify({"message": "You cannot ban yourself"}), 400

        # Check if trying to ban the subthread owner
        if user.id == subthread.created_by:
            return jsonify({"message": "You cannot ban the subthread owner"}), 400

        # Check if user is already banned
        existing_ban = check_user_banned(user.id, tid)
        if existing_ban:
            return jsonify({"message": "User is already banned"}), 400

        # Get ban reason from request body
        data = request.get_json() or {}
        reason = data.get("reason", "Unspecific Ban Reason")

        # Validate reason length
        if len(reason.strip()) == 0:
            reason = "Unspecific Ban Reason"
        elif len(reason) > 500:
            return jsonify({"message": "Ban reason too long (max 500 characters)"}), 400

        # Create ban record
        from yuuzone.subthreads.models import SubthreadBan
        ban = SubthreadBan(user_id=user.id, subthread_id=tid, banned_by=current_user.id, reason=reason.strip())
        db.session.add(ban)

        # Remove subscription if exists
        subscription = Subscription.query.filter_by(user_id=user.id, subthread_id=tid).first()
        if subscription:
            db.session.delete(subscription)

        # Remove any mod/admin roles if exists
        UserRole.query.filter_by(user_id=user.id, subthread_id=tid).delete()

        db.session.commit()

        # Emit real-time ban event
        if socketio:
            try:
                socketio.emit('user_banned', {
                    'username': username,
                    'subthread_id': tid,
                    'banned_by': current_user.username,
                    'reason': reason.strip()
                }, room=f'{tid}')

                # Also emit to the banned user's personal room
                socketio.emit('you_were_banned', {
                    'subthread_id': tid,
                    'banned_by': current_user.username,
                    'reason': reason.strip()
                }, room=f'user_{username}')
            except Exception as e:
                logging.error(f"Failed to emit ban event: {e}")

        return jsonify({
            "message": f"User {username} has been banned from the subthread",
            "banned_user": username,
            "reason": reason.strip()
        }), 200

    except Exception as e:
        db.session.rollback()
        logging.error(f"Error banning user {username} from subthread {tid}: {e}")
        return jsonify({"message": "An error occurred while banning the user"}), 500


@threads.route("/thread/<tid>/unban/<username>", methods=["POST"])
@login_required
@auth_role(["admin", "mod"])
def unban_user(tid, username):
    try:
        # Validate subthread exists
        subthread = Subthread.query.filter_by(id=tid).first()
        if not subthread:
            return jsonify({"message": "Subthread not found"}), 404

        # Validate user exists
        user = User.query.filter(
            User.username == username, 
            User.is_email_verified == True,
            User.deleted == False,
            ~User.username.startswith("del_")  # Exclude deleted accounts
        ).first()
        if not user:
            return jsonify({"message": "User not found"}), 404

        # Check if user is banned
        ban = check_user_banned(user.id, tid)
        if not ban:
            return jsonify({"message": "User is not banned"}), 400

        # Remove ban
        db.session.delete(ban)
        db.session.commit()

        # Emit real-time unban event
        if socketio:
            try:
                socketio.emit('user_unbanned', {
                    'username': username,
                    'subthread_id': tid,
                    'unbanned_by': current_user.username
                }, room=f'{tid}')

                # Also emit to the unbanned user's personal room
                socketio.emit('you_were_unbanned', {
                    'subthread_id': tid,
                    'unbanned_by': current_user.username
                }, room=f'user_{username}')
            except Exception as e:
                logging.error(f"Failed to emit unban event: {e}")

        return jsonify({
            "message": f"User {username} has been unbanned from the subthread",
            "unbanned_user": username
        }), 200

    except Exception as e:
        db.session.rollback()
        logging.error(f"Error unbanning user {username} from subthread {tid}: {e}")
        return jsonify({"message": "An error occurred while unbanning the user"}), 500


@threads.route("/thread/<tid>/ban-status/<username>", methods=["GET"])
@login_required
def get_ban_status(tid, username):
    """Get ban status for a user in a subthread"""
    try:
        # Validate subthread exists
        subthread = Subthread.query.filter_by(id=tid).first()
        if not subthread:
            return jsonify({"message": "Subthread not found"}), 404

        # Validate user exists
        user = User.query.filter(
            User.username == username, 
            User.is_email_verified == True,
            User.deleted == False,
            ~User.username.startswith("del_")  # Exclude deleted accounts
        ).first()
        if not user:
            return jsonify({"message": "User not found"}), 404

        # Check ban status
        ban = check_user_banned(user.id, tid)

        if ban:
            banned_by_user = User.query.filter_by(id=ban.banned_by).first() if ban.banned_by else None
            return jsonify({
                "banned": True,
                "reason": ban.reason,
                "subthread_name": subthread.name,
                "banned_at": ban.banned_at.isoformat() if ban.banned_at else None,
                "banned_by": banned_by_user.username if banned_by_user else "Unknown"
            }), 200
        else:
            return jsonify({
                "banned": False,
                "subthread_name": subthread.name
            }), 200

    except Exception as e:
        logging.error(f"Error getting ban status for user {username} in subthread {tid}: {e}")
        return jsonify({"message": "An error occurred while checking ban status"}), 500


@threads.route("/thread/<tid>/banned", methods=["GET"])
@login_required
def get_ban_info(tid):
    """Get detailed ban information for current user in a subthread"""
    try:
        # Validate subthread exists
        subthread = Subthread.query.filter_by(id=tid).first()
        if not subthread:
            return jsonify({"message": "Subthread not found"}), 404

        # Check if current user is banned
        ban = check_user_banned(current_user.id, tid)

        if not ban:
            return jsonify({"message": "User is not banned from this subthread"}), 404

        # Get banned_by user info
        banned_by_user = User.query.filter_by(id=ban.banned_by).first() if ban.banned_by else None

        return jsonify({
            "banned": True,
            "reason": ban.reason,
            "subthread_name": subthread.name,
            "banned_at": ban.banned_at.isoformat() if ban.banned_at else None,
            "banned_by": banned_by_user.username if banned_by_user else "Unknown"
        }), 200

    except Exception as e:
        logging.error(f"Error getting ban info for user {current_user.id} in subthread {tid}: {e}")
        return jsonify({"message": "An error occurred while retrieving ban information"}), 500


@threads.route("/thread/<tid>/user-management", methods=["GET"])
@login_required
@auth_role(["admin", "mod"])
def get_user_management_data(tid):
    """Get comprehensive user management data for mods/admins"""
    from yuuzone.subthreads.models import SubthreadBan, Subscription
    from yuuzone.posts.models import Posts
    from yuuzone.comments.models import Comments

    # Get all banned users
    banned_users = db.session.query(SubthreadBan, User).join(User, SubthreadBan.user_id == User.id).filter(
        SubthreadBan.subthread_id == tid
    ).all()

    # Get all subscribers
    subscribers = db.session.query(Subscription, User).join(User, Subscription.user_id == User.id).filter(
        Subscription.subthread_id == tid
    ).all()

    banned_list = []
    for ban, user in banned_users:
        banned_list.append({
            "username": user.username,
            "avatar": user.avatar,
            "banned_at": ban.banned_at.isoformat() if ban.banned_at else None,
            "reason": ban.reason,
            "banned_by": ban.banned_by
        })

    subscriber_list = []
    for sub, user in subscribers:
        # Get user's post count in this subthread
        post_count = Posts.query.filter_by(user_id=user.id, subthread_id=tid).count()
        comment_count = Comments.query.join(Posts).filter(
            Comments.user_id == user.id,
            Posts.subthread_id == tid
        ).count()

        subscriber_list.append({
            "username": user.username,
            "avatar": user.avatar,
            "joined_at": sub.created_at.isoformat() if sub.created_at else None,
            "post_count": post_count,
            "comment_count": comment_count
        })

    return jsonify({
        "banned_users": banned_list,
        "subscribers": subscriber_list
    }), 200


@threads.route("/thread/<tid>/user/<username>/posts", methods=["GET"])
@login_required
@auth_role(["admin", "mod"])
def get_user_posts_in_subthread(tid, username):
    """Get all posts by a specific user in a subthread"""
    user = User.query.filter(
        User.username == username, 
        User.is_email_verified == True,
        User.deleted == False,
        ~User.username.startswith("del_")  # Exclude deleted accounts
    ).first()
    if not user:
        return jsonify({"message": "Invalid User"}), 400

    from yuuzone.posts.models import Posts
    from yuuzone.comments.models import Comments

    # Get user's posts in this subthread
    posts = Posts.query.filter_by(user_id=user.id, subthread_id=tid).order_by(Posts.created_at.desc()).all()

    # Get user's comments in this subthread
    comments = db.session.query(Comments).join(Posts).filter(
        Comments.user_id == user.id,
        Posts.subthread_id == tid
    ).order_by(Comments.created_at.desc()).all()

    posts_data = []
    for post in posts:
        posts_data.append({
            "id": post.id,
            "title": post.title,
            "content": post.content[:200] + "..." if len(post.content) > 200 else post.content,
            "created_at": post.created_at.isoformat() if post.created_at else None,
            "type": "post"
        })

    comments_data = []
    for comment in comments:
        comments_data.append({
            "id": comment.id,
            "content": comment.content[:200] + "..." if len(comment.content) > 200 else comment.content,
            "created_at": comment.created_at.isoformat() if comment.created_at else None,
            "post_id": comment.post_id,
            "type": "comment"
        })

    return jsonify({
        "username": username,
        "posts": posts_data,
        "comments": comments_data,
        "total_posts": len(posts_data),
        "total_comments": len(comments_data)
    }), 200


@threads.route("/mutual-subthreads/<username>", methods=["GET"])
@login_required
def get_mutual_subthreads(username):
    """Get subthreads that both current user and specified user are subscribed to"""
    if not current_user.is_authenticated:
        return jsonify({"message": "Authentication required"}), 401

    # Get the other user
    other_user = User.query.filter(
        User.username == username, 
        User.is_email_verified == True,
        User.deleted == False,
        ~User.username.startswith("del_")  # Exclude deleted accounts
    ).first()
    if not other_user:
        # Return empty array instead of error object to prevent frontend crashes
        return jsonify([]), 200

    # Get subthreads that current user is subscribed to
    current_user_subthreads = db.session.query(Subscription.subthread_id).filter_by(user_id=current_user.id).subquery()

    # Get subthreads that other user is subscribed to
    other_user_subthreads = db.session.query(Subscription.subthread_id).filter_by(user_id=other_user.id).subquery()

    # Find mutual subthreads
    mutual_subthread_ids = db.session.query(current_user_subthreads.c.subthread_id).intersect(
        db.session.query(other_user_subthreads.c.subthread_id)
    ).all()

    # Get the actual subthread objects
    mutual_subthreads = []
    for (subthread_id,) in mutual_subthread_ids:
        subthread = Subthread.query.get(subthread_id)
        if subthread:
            mutual_subthreads.append(subthread.as_dict(current_user.id))

    return jsonify(mutual_subthreads), 200
