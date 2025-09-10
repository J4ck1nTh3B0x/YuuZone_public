from functools import wraps
from flask import jsonify, request
from flask_login import current_user, login_user


def auth_role(role):
    def wrapper(func):
        @wraps(func)
        def decorated(*args, **kwargs):
            roles = role if isinstance(role, list) else [role]
            # Check if subthread id is passed in kwargs
            tid = kwargs.get("tid")
            if tid is not None:
                # Check if user has role for the specific subthread
                has_role_for_subthread = False
                for r in roles:
                    if any(
                        ur.role.slug == r and ur.subthread_id == int(tid)
                        for ur in current_user.user_role
                    ):
                        has_role_for_subthread = True
                        break
                if not has_role_for_subthread:
                    return jsonify({"message": "Unauthorized"}), 401
            else:
                # No fallback to global roles - subthread ID is required for authorization
                return jsonify({"message": "Unauthorized - subthread ID required"}), 401
            return func(*args, **kwargs)

        return decorated

    return wrapper


def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not current_user.is_authenticated:
            return jsonify({"message": "Login required"}), 401
        return f(*args, **kwargs)
    return decorated_function


def super_manager_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not current_user.is_authenticated:
            return jsonify({'error': 'Authentication required'}), 401
        
        # Check if user has SuperManager role
        from yuuzone.models import UserRole, Role
        super_manager_role = Role.query.filter_by(slug='SM').first()
        
        if not super_manager_role:
            return jsonify({'error': 'SuperManager role not found'}), 500
        
        user_role = UserRole.query.filter_by(
            user_id=current_user.id, 
            role_id=super_manager_role.id
        ).first()
        
        if not user_role:
            return jsonify({'error': 'SuperManager access required'}), 403
        
        return f(*args, **kwargs)
    return decorated_function
