from flask import Blueprint, request, jsonify, url_for, make_response, Flask, redirect, current_app, session
from yuuzone import db
from yuuzone.users.models import (
    UserLoginValidator,
    UserRegisterValidator,
    User,
)
from yuuzone.auth.decorators import auth_role
from yuuzone.utils.translations import get_translation, get_user_language
from yuuzone.utils.email import (
    send_verification_email,
    send_welcome_email,
    send_login_alert_email,
    send_password_reset_email,
    send_change_confirmation_email,
    send_account_deletion_email,
    send_account_deletion_verification_email
)
from bcrypt import hashpw, checkpw, gensalt
from flask_login import login_user, logout_user, current_user, login_required
from itsdangerous import URLSafeTimedSerializer
import requests
import logging
from datetime import datetime, timedelta, timezone
# Socket.IO will be handled in WSGI - use try/except for graceful fallback
try:
    from yuuzone.socketio_app import socketio
except ImportError:
    socketio = None

from yuuzone.config import SECRET_KEY
serializer = URLSafeTimedSerializer(SECRET_KEY)

# Import rate limiting utilities
from yuuzone.utils.rate_limiter import combined_protection, rate_limit
from sqlalchemy import func

user = Blueprint("users", __name__, url_prefix="/api")


@user.route("/user/login", methods=["POST"])
@combined_protection("login")
def user_login():
    import logging
    logger = logging.getLogger("user_login")
    
    # If user is already authenticated, log them out first to allow re-login
    if current_user.is_authenticated:
        try:
            username = getattr(current_user, 'username', 'Unknown')
            logout_user()
            logger.info(f"User {username} logged out to allow re-login")
        except Exception as e:
            logger.warning(f"Failed to logout user for re-login: {e}")
    
    if login_form := request.json:
        # Trim whitespace from email and password
        email_raw = login_form.get("email")
        password_raw = login_form.get("password")
        email_trimmed = email_raw.strip() if email_raw else None
        password_trimmed = password_raw.strip() if password_raw else None
        try:
            UserLoginValidator().load({"email": email_trimmed, "password": password_trimmed})
        except Exception as e:
            logger.warning(f"Validation error during login: {str(e)} for email: {email_trimmed}")
            # Try to get language from request headers or default to English
            lang = request.headers.get('Accept-Language', 'en')[:2] if request.headers.get('Accept-Language') else 'en'
            return jsonify({
                "user_message": get_translation("invalid_login_data", lang),
                "error_code": "VALIDATION_ERROR",
                "developer_message": str(e)
            }), 400
        email_lower = email_trimmed.lower() if email_trimmed else None
        user_info = User.query.filter_by(email=email_lower).first()
        
        # Check if user exists but is marked as deleted
        if user_info and user_info.deleted:
            logger.warning(f"Login attempt for deleted user: {email_lower}")
            lang = request.headers.get('Accept-Language', 'en')[:2] if request.headers.get('Accept-Language') else 'en'
            return jsonify({
                "user_message": get_translation("account_not_exist", lang),
                "error_code": "ACCOUNT_NOT_EXIST",
                "developer_message": "User account has been deleted."
            }), 404
        
        # Check if user exists and password is correct
        if user_info and checkpw(password_trimmed.encode(), user_info.password_hash.encode()):
            if not user_info.is_email_verified:
                if user_info.registration_date and (datetime.now(timezone.utc) - user_info.registration_date).total_seconds() > 600:
                    db.session.delete(user_info)
                    db.session.commit()
                    return jsonify({
                        "user_message": "Account does not exist.",
                        "error_code": "ACCOUNT_NOT_EXIST",
                        "developer_message": "Unverified user expired and deleted."
                    }), 404
                lang = request.headers.get('Accept-Language', 'en')[:2] if request.headers.get('Accept-Language') else 'en'
                return jsonify({
                    "user_message": get_translation("email_not_verified", lang),
                    "error_code": "EMAIL_NOT_VERIFIED",
                    "developer_message": f"User {email_lower} tried to login but is not email verified"
                }), 403
            
            # Set session as permanent and login user
            session.permanent = True
            login_user(user_info, remember=True)
            
            # Force session to be saved
            session.modified = True
            
            logger.info(f"User {user_info.username} logged in successfully")
            
            # Return user data with session info
            response = jsonify(user_info.as_dict(include_all=True))
            
            # Let Flask-Login handle the session cookie automatically
            # The session is already configured in __init__.py
            
            return response, 200
        else:
            logger.warning(f"Failed login attempt for email: {email_lower}")
            lang = request.headers.get('Accept-Language', 'en')[:2] if request.headers.get('Accept-Language') else 'en'
            return jsonify({
                "user_message": get_translation("invalid_credentials", lang),
                "error_code": "INVALID_CREDENTIALS",
                "developer_message": f"Failed login attempt for email: {email_lower}"
            }), 401
    lang = request.headers.get('Accept-Language', 'en')[:2] if request.headers.get('Accept-Language') else 'en'
    return jsonify({
        "user_message": get_translation("invalid_request", lang),
        "error_code": "INVALID_REQUEST",
        "developer_message": "No login data provided in request"
    }), 400


@user.route("/user/register", methods=["POST"])
@combined_protection("register")
def user_register():
    import logging
    logger = logging.getLogger("user_register")

    if current_user.is_authenticated:
        user_lang = get_user_language()
        return jsonify({"message": get_translation('already_logged_in', user_lang)}), 409

    if register_form := request.json:
        try:
            UserRegisterValidator().load(register_form)
        except Exception as e:
            logger.warning(f"Registration validation failed: {str(e)}")
            user_lang = get_user_language()
            return jsonify({
                "user_message": get_translation('invalid_registration_data', user_lang),
                "error_code": "VALIDATION_ERROR",
                "developer_message": str(e)
            }), 400

        try:
            email_lower = register_form.get("email").lower() if register_form.get("email") else None
            username = register_form.get("username")
            
            # Check for reserved username prefix (deleted accounts)
            if username and username.startswith("del_"):
                user_lang = get_user_language()
                return jsonify({
                    "user_message": get_translation('invalid_username_format', user_lang),
                    "error_code": "INVALID_USERNAME_FORMAT",
                    "developer_message": "Username cannot start with 'del_' prefix (reserved for deleted accounts)"
                }), 400
            
            # Check for existing user (including deleted users)
            existing_user = User.query.filter_by(email=email_lower).first()
            if existing_user:
                # If user is deleted, allow re-registration
                if existing_user.deleted:
                    # For GONE protocol, we don't delete the old user completely
                    # Instead, we allow re-registration with a new email
                    # The old user remains in database for GONE protocol
                    pass
                # If user is not verified and not expired, prevent registration
                elif not existing_user.is_email_verified:
                    if existing_user.registration_date and (datetime.now(timezone.utc) - existing_user.registration_date).total_seconds() > 600:
                        db.session.delete(existing_user)
                        db.session.commit()
                    else:
                        return jsonify({
                            "user_message": "This email is already registered, please try another email.",
                            "error_code": "EMAIL_NOT_VERIFIED",
                            "developer_message": "Unverified user exists and is not expired."
                        }), 409
                # If user is verified, prevent registration
                else:
                    return jsonify({
                        "user_message": "This email is already registered, please try another email.",
                        "error_code": "EMAIL_ALREADY_EXISTS",
                        "developer_message": "Verified user already exists."
                    }), 409
            new_user = User(
                register_form.get("username"),
                email_lower,
                hashpw(register_form.get("password").encode(), gensalt()).decode("utf-8"),
            )
            new_user.add()

            # Send verification email
            try:
                verification_token = serializer.dumps(email_lower, salt="email-verification")
                verification_url = url_for("users.verify_email", token=verification_token, _external=True)
                
                send_verification_email(
                    new_user.email,
                    new_user.username,
                    verification_url,
                    new_user
                )
            except Exception as e:
                logger.error(f"Failed to send verification email: {e}")

            # Do NOT automatically log in the user after successful registration
            # login_user(new_user)
            logger.info(f"User {new_user.username} registered successfully (verification required)")

            user_lang = get_user_language()
            return jsonify({
                "message": get_translation('registration_successful', user_lang),
                "user": new_user.as_dict(include_all=True)
            }), 201

        except Exception as e:
            logger.error(f"Registration failed for {register_form.get('username')}: {str(e)}")
            db.session.rollback()
            return jsonify({
                "user_message": "Registration failed",
                "error_code": "REGISTRATION_ERROR",
                "developer_message": str(e)
            }), 500


@user.route("/user/verify-email/<token>", methods=["GET"])
def verify_email(token):
    try:
        email = serializer.loads(token, salt="email-verification", max_age=600)  # 10 minutes
        user = User.query.filter_by(email=email).first()
        if user:
            # Check if user is already verified
            if user.is_email_verified:
                return redirect("/verify-email-success")
            # Check if registration_date is still within allowed window
            if user.registration_date and (datetime.now(timezone.utc) - user.registration_date).total_seconds() > 600:
                db.session.delete(user)
                db.session.commit()
                return redirect("/verify-email-expired")
            user.is_email_verified = True
            user.email_verification_token = None
            user.email_verification_expires_at = None
            db.session.commit()
            try:
                send_welcome_email(user.email, user.username, user)
            except Exception as e:
                import logging
                logging.error(f"Failed to send welcome email: {e}")
            return redirect("/verify-email-success")
        return redirect("/link-expired?type=email")
    except Exception:
        # If token is expired or invalid, try to delete the user if exists
        try:
            email = serializer.loads(token, salt="email-verification", max_age=None)
            user = User.query.filter_by(email=email).first()
            if user and not user.is_email_verified:
                db.session.delete(user)
                db.session.commit()
        except Exception:
            pass
        return redirect("/verify-email-expired")


@user.route("/user/forgot-password", methods=["POST"])
@rate_limit("password_reset")
def forgot_password():
    email = request.json.get("email")
    user = User.query.filter_by(email=email).first()
    if user:
        try:
            token = serializer.dumps(email, salt="password-reset")
            # Change reset_url to point to frontend route
            reset_url = f"http://localhost:5000/forgot-password?token={token}"
            send_password_reset_email(
                user.email,
                user.username,
                reset_url,
                user
            )
            return jsonify({"message": "If the email exists, a reset link has been sent."}), 200
        except Exception as e:
            import logging
            logging.error(f"Failed to send password reset email: {e}")
            return jsonify({"message": "Failed to send reset email"}), 500
    return jsonify({"message": "If the email exists, a reset link has been sent."}), 200


@user.route("/user/reset-password/<token>", methods=["POST"])
def reset_password(token):
    try:
        email = serializer.loads(token, salt="password-reset", max_age=900)  # 15 minutes
        user = User.query.filter_by(email=email).first()
        if user:
            new_password = request.json.get("password")
            user.password_hash = hashpw(new_password.encode(), gensalt()).decode("utf-8")
            db.session.commit()
            
            # Send change confirmation email
            try:
                send_change_confirmation_email(user.email, user.username, user)
            except Exception as e:
                import logging
                logging.error(f"Failed to send change confirmation email: {e}")
            
            return jsonify({"message": "Password reset successfully."}), 200
        return jsonify({"message": "Invalid token or user not found."}), 400
    except Exception:
        return jsonify({"message": "Reset link expired or invalid."}), 400


@user.route("/user", methods=["PATCH"])
@login_required
def user_patch():
    image = request.files.get("avatar")
    form_data = request.form.to_dict()
    old_data = current_user.as_dict(include_all=True)
    current_user.patch(image=image, form_data=form_data)
    new_data = current_user.as_dict(include_all=True)

    # Emit real-time profile update
    if socketio:
        try:
            # Determine what fields changed
            updated_fields = {}
            for key, new_value in new_data.items():
                if key in old_data and old_data[key] != new_value:
                    updated_fields[key] = new_value

            if updated_fields:
                socketio.emit('profile_updated', {
                    'username': current_user.username,
                    'updated_fields': updated_fields,
                    'avatar_url': new_data.get('avatar')
                }, room=f'user_{current_user.id}')
        except Exception as e:
            import logging
            logging.error(f"Failed to emit profile update: {e}")

    return jsonify(new_data), 200


@user.route("/user/logout", methods=["GET"])
@login_required
def user_logout():
    logout_user()
    user_lang = get_user_language()
    return jsonify({"message": get_translation('successfully_logged_out', user_lang)}), 200


@user.route("/user", methods=["DELETE"])
@login_required
def user_delete():
    try:
        user_id = current_user.id
        username = current_user.username
        
        # Store user info for email before deletion
        user_email = current_user.email
        user_username = current_user.username
        
        # Handle subthread ownership and mod rights before deletion
        from yuuzone.subthreads.models import Subthread
        from yuuzone.models import UserRole, Role
        
        # Get all subthreads where user is admin
        admin_subthreads = UserRole.query.filter_by(
            user_id=user_id
        ).join(UserRole.role).filter(
            UserRole.role.has(slug="admin")
        ).all()
        
        # Get all subthreads where user is mod
        mod_subthreads = UserRole.query.filter_by(
            user_id=user_id
        ).join(UserRole.role).filter(
            UserRole.role.has(slug="mod")
        ).all()
        
        # Handle admin subthreads
        for admin_role in admin_subthreads:
            subthread_id = admin_role.subthread_id
            subthread = Subthread.query.get(subthread_id)
            
            if subthread:
                # Check if there are other mods in this subthread
                other_mods = UserRole.query.filter_by(
                    subthread_id=subthread_id
                ).join(UserRole.role).filter(
                    UserRole.role.has(slug="mod")
                ).filter(
                    UserRole.user_id != user_id
                ).all()
                
                if other_mods:
                    # Transfer ownership to the first mod
                    transfer_to_user_id = other_mods[0].user_id
                    # Remove the mod role from the transfer target
                    db.session.delete(other_mods[0])
                    # Make them admin
                    admin_role_transfer = UserRole(
                        user_id=transfer_to_user_id,
                        subthread_id=subthread_id,
                        role_id=2  # admin role
                    )
                    db.session.add(admin_role_transfer)
                    # Update subthread created_by
                    subthread.created_by = transfer_to_user_id
                else:
                    # No other mods, mark as abandoned
                    subthread.created_by = None
        
        # Remove all user roles (mod and admin)
        UserRole.query.filter_by(user_id=user_id).delete()
        
        # Remove all subscriptions
        from yuuzone.subthreads.models import Subscription
        Subscription.query.filter_by(user_id=user_id).delete()
        
        # Anonymize all posts by this user
        from yuuzone.posts.models import Posts
        user_posts = Posts.query.filter_by(user_id=user_id).all()
        for post in user_posts:
            # Since PostInfo is a view, we need to update the underlying Posts table
            # The view will automatically show NULL for user info when user is deleted
            # But we need to handle the case where we want to show [deleted] instead
            # For now, we'll let the view show NULL and handle it in the frontend
            pass
        
        # Anonymize all comments by this user
        from yuuzone.comments.models import Comments
        user_comments = Comments.query.filter_by(user_id=user_id).all()
        for comment in user_comments:
            # Since CommentInfo is a view, we need to update the underlying Comments table
            # The view will automatically show NULL for user info when user is deleted
            # But we need to handle the case where we want to show [deleted] instead
            # For now, we'll let the view show NULL and handle it in the frontend
            pass
        
        # Remove all reactions by this user
        from yuuzone.reactions.models import Reactions
        Reactions.query.filter_by(user_id=user_id).delete()
        
        # Remove all saved posts by this user
        from yuuzone.posts.models import SavedPosts
        SavedPosts.query.filter_by(user_id=user_id).delete()
        
        # Remove all messages by this user
        from yuuzone.messages.models import Messages
        Messages.query.filter_by(sender_id=user_id).delete()
        Messages.query.filter_by(receiver_id=user_id).delete()
        
        # Remove all user blocks
        from yuuzone.users.models import UserBlock
        UserBlock.query.filter_by(blocker_id=user_id).delete()
        UserBlock.query.filter_by(blocked_id=user_id).delete()
        
        # Remove all subthread bans
        from yuuzone.subthreads.models import SubthreadBan
        SubthreadBan.query.filter_by(user_id=user_id).delete()
        SubthreadBan.query.filter_by(banned_by=user_id).delete()
        
        # Hard delete the user
        db.session.delete(current_user)
        db.session.commit()
        
        # Send deletion email
        try:
            send_account_deletion_email(user_email, user_username, None)
        except Exception as e:
            import logging
            logging.error(f"Failed to send account deletion email: {e}")
        
        logout_user()
        return jsonify({"message": "Account deleted successfully"}), 200
        
    except Exception as e:
        db.session.rollback()
        import logging
        logging.error(f"Failed to delete account: {e}")
        return jsonify({"message": "Failed to delete account"}), 500


@user.route("/user/username", methods=["PATCH"])
@login_required
@rate_limit("username_change")
def user_update_username():
    try:
        new_username = request.form.get("username")
        current_password = request.form.get("current_password")

        if not new_username or not current_password:
            return jsonify({"message": "Username and current password are required"}), 400

        # Validate username format and length (same as registration)
        if len(new_username) < 4 or len(new_username) > 15:
            return jsonify({"message": "Username must be between 4 and 15 characters"}), 400

        # Validate username format (must start with letter, contain only letters, numbers, underscores)
        import re
        if not re.match("^[a-zA-Z][a-zA-Z0-9_]*$", new_username):
            return jsonify({"message": "Username must start with a letter, and contain only letters, numbers, and underscores"}), 400

        # Check for reserved username prefix (deleted accounts)
        if new_username.startswith("del_"):
            return jsonify({"message": "Username cannot start with 'del_' prefix (reserved for deleted accounts)"}), 400

        # Verify current password
        if not checkpw(current_password.encode(), current_user.password_hash.encode()):
            return jsonify({"message": "Current password is incorrect"}), 400

        # Check if username already exists (case-insensitive)
        existing_user = User.query.filter(func.lower(User.username) == new_username.lower()).first()
        if existing_user and existing_user.id != current_user.id:
            return jsonify({"message": "Username already taken"}), 400

        # Update username
        current_user.username = new_username
        db.session.commit()

        # Send change confirmation email (don't let email failure break the request)
        try:
            send_change_confirmation_email(current_user.email, current_user.username, current_user)
        except Exception as e:
            import logging
            logging.error(f"Failed to send change confirmation email: {e}")
            # Don't return error, just log it and continue

        return jsonify(current_user.as_dict(include_all=True)), 200
    except Exception as e:
        import logging
        logging.error(f"Error in user_update_username: {str(e)}")
        db.session.rollback()
        return jsonify({"message": "Internal server error"}), 500


@user.route("/user/password", methods=["PATCH"])
@login_required
def user_update_password():
    try:
        new_password = request.form.get("new_password")
        current_password = request.form.get("current_password")

        if not new_password or not current_password:
            return jsonify({"message": "Both current and new passwords are required"}), 400

        # Verify current password
        if not checkpw(current_password.encode(), current_user.password_hash.encode()):
            return jsonify({"message": "Current password is incorrect"}), 400

        # Update password
        current_user.password_hash = hashpw(new_password.encode(), gensalt()).decode("utf-8")
        db.session.commit()
        
        # Send change confirmation email (don't let email failure break the request)
        try:
            send_change_confirmation_email(current_user.email, current_user.username, current_user)
        except Exception as e:
            import logging
            logging.error(f"Failed to send change confirmation email: {e}")
            # Don't return error, just log it and continue

        return jsonify({"message": "Password updated successfully"}), 200
    except Exception as e:
        import logging
        logging.error(f"Error in user_update_password: {str(e)}")
        db.session.rollback()
        return jsonify({"message": "Internal server error"}), 500


@user.route("/user/email", methods=["PATCH"])
@login_required
@rate_limit("email_change")
def user_update_email():
    try:
        new_email = request.form.get("email")
        current_password = request.form.get("current_password")

        if not new_email or not current_password:
            return jsonify({"message": "Email and current password are required"}), 400

        # Verify current password
        if not checkpw(current_password.encode(), current_user.password_hash.encode()):
            return jsonify({"message": "Current password is incorrect"}), 400

        # Check if email already exists
        existing_user = User.query.filter_by(email=new_email).first()
        if existing_user and existing_user.id != current_user.id:
            return jsonify({"message": "Email already in use"}), 400

        # Update email
        current_user.email = new_email
        db.session.commit()

        # Send change confirmation email (don't let email failure break the request)
        try:
            send_change_confirmation_email(current_user.email, current_user.username, current_user)
        except Exception as e:
            import logging
            logging.error(f"Failed to send change confirmation email: {e}")
            # Don't return error, just log it and continue

        return jsonify(current_user.as_dict(include_all=True)), 200
    except Exception as e:
        import logging
        logging.error(f"Error in user_update_email: {str(e)}")
        db.session.rollback()
        return jsonify({"message": "Internal server error"}), 500


@user.route("/user", methods=["GET"])
@login_required
def user_get():
    try:
        import logging
        logger = logging.getLogger("user_get")
        logger.info(f"User get request - Current user: {current_user.username if current_user.is_authenticated else 'Not authenticated'}")
        logger.info(f"Session cookies: {dict(request.cookies)}")
        logger.info(f"User authenticated: {current_user.is_authenticated}")
        
        return jsonify(current_user.as_dict(include_all=True)), 200
    except Exception as e:
        logging.error(f"Error in user_get: {e}")
        return jsonify({"error": "Failed to get user data"}), 500


@user.route("/user/language", methods=["PATCH"])
@login_required
def update_language_preference():
    """Update user's language preference"""
    data = request.get_json()
    language = data.get('language')

    # Validate language code
    valid_languages = ['en', 'ja', 'vi']
    if language not in valid_languages:
        user_lang = get_user_language()
        return jsonify({"error": get_translation('invalid_language_code', user_lang)}), 400

    # Update user's language preference
    current_user.language_preference = language
    db.session.commit()

    # Emit real-time event for language preference update
    if socketio:
        socketio.emit('user_preference_updated', {
            'preference_type': 'language_preference',
            'value': language
        }, room=f'user_settings_{current_user.id}')

    user_lang = get_user_language()
    return jsonify({
        "message": get_translation('language_preference_updated', user_lang),
        "language": language
    }), 200


@user.route("/user/theme", methods=["GET"])
@login_required
def get_user_theme():
    """Get user's theme preference"""
    return jsonify({"theme": current_user.theme}), 200


@user.route("/user/theme", methods=["PATCH"])
@login_required
def update_user_theme():
    try:
        data = request.get_json()
        theme = data.get("theme")
        
        if theme not in ["light", "dark"]:
            return jsonify({"error": "Invalid theme value"}), 400
        
        current_user.theme = theme
        db.session.commit()
        
        return jsonify({"success": True, "theme": theme}), 200
    except Exception as e:
        logging.error(f"Error updating user theme: {e}")
        return jsonify({"error": "Failed to update theme"}), 500

@user.route("/user/roles", methods=["GET"])
@login_required
def get_user_roles():
    """Get current user's roles"""
    try:
        from yuuzone.models import UserRole, Role
        
        user_roles = db.session.query(UserRole, Role).join(
            Role, UserRole.role_id == Role.id
        ).filter(
            UserRole.user_id == current_user.id
        ).all()
        
        roles = []
        for user_role, role in user_roles:
            roles.append({
                'id': role.id,
                'name': role.name,
                'slug': role.slug
            })
        
        return jsonify({
            "success": True,
            "roles": roles
        }), 200
    except Exception as e:
        logging.error(f"Error getting user roles: {e}")
        return jsonify({"error": "Failed to get user roles"}), 500

@user.route("/user/custom-theme", methods=["GET"])
@login_required
def get_user_custom_theme():
    """Get user's active custom theme"""
    try:
        from yuuzone.subscriptions.models import UserCustomTheme
        
        # Get user's active custom theme
        active_theme = UserCustomTheme.query.filter_by(
            user_id=current_user.id,
            is_active=True
        ).first()
        
        if active_theme:
            return jsonify({
                "has_custom_theme": True,
                "theme": active_theme.as_dict()
            }), 200
        else:
            return jsonify({
                "has_custom_theme": False,
                "theme": None
            }), 200
    except Exception as e:
        logging.error(f"Error getting user custom theme: {e}")
        return jsonify({"error": "Failed to get custom theme"}), 500


@user.route("/user/<username>", methods=["GET"])
def get_user_by_username(username):
    """Get user profile by username"""
    user = User.query.filter(
        User.username == username, 
        User.deleted == False, 
        User.is_email_verified == True,
        ~User.username.startswith("del_")  # Exclude deleted accounts
    ).first()
    if not user:
        return jsonify({"message": "User not found"}), 404

    return jsonify(user.as_dict(include_all=True)), 200


@user.route("/users", methods=["GET"])
@login_required
@auth_role(["admin"])
def users_get():
    return jsonify(User.get_all()), 200


@user.route("/user/search/<search>")
@login_required
def get_user(search):
    # Remove any leading "u/" prefix for consistent search
    if search.startswith("u/"):
        search = search[2:]
    
    try:
        # Use optimized user search function
        result = db.session.execute(
            db.text("SELECT * FROM search_users(:search_query, 20)"),
            {"search_query": search}
        ).fetchall()
        
        users = []
        for row in result:
            user_data = {
                "id": row.id,
                "username": row.username,
                "avatar": row.avatar,
                "bio": row.bio,
                "registration_date": row.registration_date,
                "user_karma": row.user_karma
            }
            users.append(user_data)
        
        return jsonify(users), 200
    except Exception as e:
        logging.error(f"Error in optimized user search: {e}")
        # Fallback to original query
        users = User.query.filter(
            User.username.ilike(f"%{search}%"), 
            User.deleted == False, 
            User.is_email_verified == True,
            ~User.username.startswith("del_")  # Exclude deleted accounts
        ).all()
        return jsonify([user.as_dict() for user in users]), 200


@user.route("/user/blocked", methods=["GET"])
@login_required
def get_blocked_users():
    """Get list of users blocked by current user"""
    from yuuzone.users.models import UserBlock
    
    blocked_users = UserBlock.query.filter_by(blocker_id=current_user.id).all()
    blocked_data = []
    
    for block in blocked_users:
        blocked_user = User.query.get(block.blocked_id)
        if blocked_user:
            blocked_data.append(blocked_user.as_dict())
    
    return jsonify(blocked_data), 200


@user.route("/user/block/<username>", methods=["POST"])
@login_required
def block_user(username):
    """Block a user"""
    from yuuzone.users.models import UserBlock
    
    if username == current_user.username:
        user_lang = get_user_language()
        return jsonify({"message": get_translation('cannot_block_yourself', user_lang)}), 400
    
    user_to_block = User.query.filter_by(username=username).first()
    if not user_to_block:
        return jsonify({"message": "User not found"}), 404
    
    # Check if already blocked
    existing_block = UserBlock.query.filter_by(
        blocker_id=current_user.id, 
        blocked_id=user_to_block.id
    ).first()
    
    if existing_block:
        user_lang = get_user_language()
        return jsonify({"message": get_translation('user_already_blocked', user_lang)}), 400

    # Create block
    new_block = UserBlock(current_user.id, user_to_block.id)
    db.session.add(new_block)
    db.session.commit()
    
    user_lang = get_user_language()
    return jsonify({
        "message": get_translation('user_blocked', user_lang, username=username)
    }), 200


@user.route("/user/unblock/<username>", methods=["DELETE"])
@login_required
def unblock_user(username):
    """Unblock a user"""
    from yuuzone.users.models import UserBlock
    
    user_to_unblock = User.query.filter_by(username=username).first()
    if not user_to_unblock:
        return jsonify({"message": "User not found"}), 404

    # Find and remove block
    block = UserBlock.query.filter_by(
        blocker_id=current_user.id, 
        blocked_id=user_to_unblock.id
    ).first()
    
    if not block:
        user_lang = get_user_language()
        return jsonify({"message": get_translation('user_not_blocked', user_lang)}), 400

    db.session.delete(block)
    db.session.commit()
    
    user_lang = get_user_language()
    return jsonify({
        "message": get_translation('user_unblocked', user_lang, username=username)
    }), 200


@user.route("/user/blocked-by/<username>", methods=["GET"])
@login_required
def get_blocked_by_status(username):
    """Check if current user is blocked by the specified user"""
    user_to_check = User.query.filter_by(username=username).first()
    if not user_to_check:
        return jsonify({"message": "User not found"}), 404

    from yuuzone.users.models import UserBlock
    # Check if the specified user has blocked the current user
    block = UserBlock.query.filter_by(blocker_id=user_to_check.id, blocked_id=current_user.id).first()

    return jsonify({"blocked": block is not None}), 200


@user.route("/internal/cleanup-unverified-users", methods=["POST"])
def cleanup_unverified_users():
    # Require a secret token for security
    secret_token = request.headers.get('X-Secret-Token')
    if secret_token != "yuuzone-cleanup-2024":
        return jsonify({"error": "Unauthorized"}), 401
    
    try:
        # Delete unverified users older than 10 minutes
        cutoff_time = datetime.now(timezone.utc) - timedelta(minutes=10)
        unverified_users = User.query.filter(
            User.is_email_verified == False,
            User.registration_date < cutoff_time
        ).all()
        
        deleted_count = 0
        for user in unverified_users:
            db.session.delete(user)
            deleted_count += 1
        
        db.session.commit()
        
        return jsonify({
            "message": f"Cleaned up {deleted_count} unverified users",
            "deleted_count": deleted_count
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@user.route("/user/request-deletion", methods=["POST"])
@login_required
@rate_limit("delete_account")
def request_account_deletion():
    """Request account deletion - sends verification email"""
    import logging
    logger = logging.getLogger("account_deletion_request")
    
    try:
        # Generate deletion token
        deletion_token = serializer.dumps(current_user.email, salt="account-deletion")
        
        # Set expiration (10 minutes)
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)
        
        # Update user with deletion request info
        current_user.account_deletion_token = deletion_token
        current_user.account_deletion_expires_at = expires_at
        current_user.account_deletion_requested_at = datetime.now(timezone.utc)
        db.session.commit()
        
        # Generate verification URL
        verification_url = f"{request.host_url.rstrip('/')}/account-deletion-verification/{deletion_token}"
        
        # Send verification email
        send_account_deletion_verification_email(
            current_user.email,
            current_user.username,
            verification_url,
            current_user
        )
        
        logger.info(f"Account deletion requested for user {current_user.username}")
        
        return jsonify({
            "message": "Account deletion verification email sent. Please check your email and click the verification link within 10 minutes.",
            "user_message": "Account deletion verification email sent. Please check your email and click the verification link within 10 minutes."
        }), 200
        
    except Exception as e:
        logger.error(f"Failed to request account deletion for user {current_user.username}: {e}")
        db.session.rollback()
        return jsonify({
            "error": "Failed to request account deletion",
            "user_message": "Failed to request account deletion. Please try again."
        }), 500


@user.route("/user/verify-deletion/<token>", methods=["GET"])
def verify_account_deletion(token):
    """Verify account deletion token and delete the account"""
    import logging
    logger = logging.getLogger("account_deletion_verification")
    
    try:
        # Verify token
        email = serializer.loads(token, salt="account-deletion", max_age=600)  # 10 minutes
        
        # Find user
        user = User.query.filter_by(email=email, deleted=False).first()
        if not user:
            return redirect("/account-deletion-verification/error?reason=invalid_token")
        
        # Check if token matches and is not expired
        if user.account_deletion_token != token:
            return redirect("/account-deletion-verification/error?reason=invalid_token")
        
        if user.account_deletion_expires_at and user.account_deletion_expires_at < datetime.now(timezone.utc):
            return redirect("/account-deletion-verification/error?reason=expired")
        
        # IMMEDIATELY invalidate the account to prevent any further access
        # Change email first to make the link unusable immediately
        original_email = user.email
        user.email = f"deleted_{user.id}_{int(datetime.now().timestamp())}@deleted.com"  # Add timestamp for uniqueness
        user.deleted = True
        user.deleted_at = datetime.now(timezone.utc)
        user.password_hash = "deleted"  # Invalidate password immediately
        user.account_deletion_token = None  # Clear token immediately
        user.account_deletion_expires_at = None  # Clear expiry immediately
        
        # Commit immediately to make changes permanent
        db.session.commit()
        
        # Now clean up all related data
        from yuuzone.models import UserRole
        from yuuzone.subthreads.models import Subscription, SubthreadBan, Subthread
        from yuuzone.posts.models import Posts, SavedPosts
        from yuuzone.comments.models import Comments
        from yuuzone.reactions.models import Reactions
        from yuuzone.messages.models import Messages
        from yuuzone.users.models import UserBlock, UsersKarma
        
        # Delete user roles
        UserRole.query.filter_by(user_id=user.id).delete()
        
        # Delete subscriptions
        Subscription.query.filter_by(user_id=user.id).delete()
        
        # Delete subthread bans
        SubthreadBan.query.filter_by(user_id=user.id).delete()
        SubthreadBan.query.filter_by(banned_by=user.id).delete()
        
        # Anonymize posts (keep them but mark as deleted)
        user_posts = Posts.query.filter_by(user_id=user.id).all()
        for post in user_posts:
            post.username = "deleted"  # Use valid characters only
        
        # Anonymize comments (keep them but mark as deleted)
        user_comments = Comments.query.filter_by(user_id=user.id).all()
        for comment in user_comments:
            comment.username = "deleted"  # Use valid characters only
        
        # Delete reactions
        Reactions.query.filter_by(user_id=user.id).delete()
        
        # Delete saved posts
        SavedPosts.query.filter_by(user_id=user.id).delete()
        
        # Delete messages
        Messages.query.filter_by(sender_id=user.id).delete()
        Messages.query.filter_by(receiver_id=user.id).delete()
        
        # Delete user blocks
        UserBlock.query.filter_by(blocker_id=user.id).delete()
        UserBlock.query.filter_by(blocked_id=user.id).delete()
        
        # Remove user from all subthreads they joined
        user_subscriptions = Subscription.query.filter_by(user_id=user.id).all()
        for subscription in user_subscriptions:
            # Remove from subthread members list
            subthread = Subthread.query.get(subscription.subthread_id)
            if subthread and subthread.members:
                # Parse members list and remove the user
                members_list = subthread.members.split(',') if subthread.members else []
                members_list = [member.strip() for member in members_list if member.strip() != user.username]
                subthread.members = ','.join(members_list) if members_list else None
                
                # Update member count
                if subthread.member_count and subthread.member_count > 0:
                    subthread.member_count -= 1
        
        # Complete the GONE protocol
        import secrets
        import hashlib
        random_hash = secrets.token_hex(4)  # Generate 8-character random hex
        user.username = f"del_{random_hash}"  # Unique random hash format
        user.password_hash = hashlib.sha512(f"deleted_{secrets.token_hex(16)}".encode()).hexdigest()  # Impossible to guess SHA-512 hash
        user.avatar = None  # Remove avatar
        user.bio = None  # Remove bio
        
        logger.info(f"GONE protocol applied: username={user.username}, password_hash length={len(user.password_hash)}")
        
        # Final commit to save all changes
        db.session.commit()
        
        # Send confirmation email to the original email (before it was changed)
        send_account_deletion_email(original_email, user.username, user)
        
        # Logout the user session if they are currently logged in
        if current_user.is_authenticated and current_user.id == user.id:
            logout_user()
        
        logger.info(f"Account deleted for user {user.username} (original email: {original_email})")
        
        # Redirect to success page without automatic login redirect
        return redirect("/account-deletion-verification/success?no_auto_redirect=true")
        
    except Exception as e:
        logger.error(f"Failed to verify account deletion: {e}")
        return redirect("/account-deletion-verification/error?reason=server_error")


@user.route("/user/test-session", methods=["GET"])
def test_session():
    """Test route to check session state without authentication"""
    import logging
    logger = logging.getLogger("test_session")
    
    session_info = {
        "cookies": dict(request.cookies),
        "current_user_authenticated": current_user.is_authenticated,
        "current_user_id": current_user.id if current_user.is_authenticated else None,
        "current_user_username": current_user.username if current_user.is_authenticated else None,
        "session_cookie": request.cookies.get('yuuzone_session'),
        "flask_session": dict(session) if hasattr(request, 'session') else "No Flask session"
    }
    
    logger.info(f"Session test: {session_info}")
    return jsonify(session_info), 200


@user.route("/user/debug-auth", methods=["GET"])
def debug_auth():
    """Debug endpoint to check authentication state"""
    import logging
    logger = logging.getLogger("debug_auth")
    
    debug_info = {
        "request_headers": dict(request.headers),
        "request_cookies": dict(request.cookies),
        "current_user_authenticated": current_user.is_authenticated,
        "current_user_id": current_user.id if current_user.is_authenticated else None,
        "current_user_username": current_user.username if current_user.is_authenticated else None,
        "session_cookie": request.cookies.get('yuuzone_session'),
        "flask_session": dict(session) if hasattr(request, 'session') else "No Flask session",
        "user_agent": request.headers.get('User-Agent'),
        "origin": request.headers.get('Origin'),
        "referer": request.headers.get('Referer')
    }
    
    logger.info(f"Debug auth: {debug_info}")
    return jsonify(debug_info), 200
