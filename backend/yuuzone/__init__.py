import os
import logging
from flask import Flask, jsonify, request
from flask_sqlalchemy import SQLAlchemy
from flask_marshmallow import Marshmallow
from marshmallow import ValidationError
import cloudinary
from flask_login import LoginManager
from flask_cors import CORS
from datetime import datetime
from yuuzone.config import (
    DATABASE_URI,
    SECRET_KEY,
    CLOUDINARY_API_SECRET,
    CLOUDINARY_API_KEY,
    CLOUDINARY_NAME,
    DEFAULT_AVATAR_URL,
    SEPAY_API_KEY,
    TRANSLATE_URL,
)

app = Flask(
    __name__,
    static_folder="static" if os.path.exists(os.path.join(os.path.dirname(__file__), "static")) else None,
    static_url_path="/",
)

# Configure CORS for all routes
CORS(app,
     origins=["*"],  # Allow all origins for development/deployment flexibility
     methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
     allow_headers=["Content-Type", "Authorization", "X-Requested-With"],
     supports_credentials=True,  # Enable credentials to allow session cookies
     expose_headers=["Content-Type", "Authorization", "X-Requested-With"],
     credentials=True)  # Explicitly enable credentials

cloudinary.config(
    cloud_name=CLOUDINARY_NAME,
    api_key=CLOUDINARY_API_KEY,
    api_secret=CLOUDINARY_API_SECRET,
)
app.config["CLOUDINARY_NAME"] = CLOUDINARY_NAME
app.config["SQLALCHEMY_DATABASE_URI"] = DATABASE_URI
app.config["SECRET_KEY"] = SECRET_KEY
app.config["DEFAULT_AVATAR_URL"] = DEFAULT_AVATAR_URL
app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
    'pool_pre_ping': True,
    'pool_recycle': 1800
}

# Configure session settings for Flask-Login
app.config['SESSION_COOKIE_SECURE'] = False  # Allow HTTP for development
app.config['SESSION_COOKIE_HTTPONLY'] = False  # Allow JavaScript access for debugging
app.config['SESSION_COOKIE_SAMESITE'] = None  # Allow cross-site requests for development
app.config['PERMANENT_SESSION_LIFETIME'] = 86400  # 24 hours
app.config['SESSION_COOKIE_NAME'] = 'yuuzone_session'
app.config['SESSION_COOKIE_PATH'] = '/'  # Ensure cookie is available for all paths
app.config['SESSION_COOKIE_DOMAIN'] = None  # Use current domain
db = SQLAlchemy(app)
login_manager = LoginManager(app)
ma = Marshmallow(app)

# Initialize email system
from yuuzone.utils.email import init_mail
init_mail(app)

# Initialize Socket.IO with the app
try:
    from yuuzone.socketio_app import socketio
    socketio.init_app(app)
except ImportError:
    socketio = None
except Exception:
    socketio = None

# Export socketio for use in other modules
__all__ = ['app', 'db', 'socketio']

# Initialize connection management system
try:
    from yuuzone.utils.connection_manager import connection_manager
    from yuuzone.utils.system_monitor import system_monitor
    
    # Start connection health checker
    connection_manager.start_health_checker()
    
    # Add cleanup on app shutdown
    import atexit
    atexit.register(connection_manager.stop_health_checker)
    
    print("✅ Connection management system initialized")
except Exception as e:
    print(f"❌ Failed to initialize connection management: {e}")

# Initialize materialized view refresher
try:
    from yuuzone.utils.materialized_view_refresher import init_materialized_view_refresher
    
    # Start materialized view refresher (refresh every 5 minutes)
    init_materialized_view_refresher(app, db, refresh_interval_minutes=5)
    
    print("✅ Materialized view refresher initialized")
except Exception as e:
    print(f"❌ Failed to initialize materialized view refresher: {e}")


@login_manager.unauthorized_handler
def callback():
    return jsonify({"message": "Unauthorized"}), 401


@app.route("/healthz")
def health_check():
    """Health check endpoint for Render deployment"""
    try:
        # Test database connection using SQLAlchemy text()
        from sqlalchemy import text
        db.session.execute(text("SELECT 1")).scalar()
        
        # Get connection stats if available
        connection_stats = {}
        try:
            from yuuzone.utils.connection_manager import connection_manager
            from yuuzone.utils.system_monitor import system_monitor
            connection_stats = connection_manager.get_connection_stats()
        except:
            pass
        
        return jsonify({
            "status": "healthy",
            "database": "connected",
            "service": "yuuzone",
            "connections": connection_stats
        }), 200
    except Exception as e:
        return jsonify({
            "status": "unhealthy",
            "database": "disconnected",
            "error": str(e)
        }), 503

@app.route("/api/system/stats")
def system_stats():
    """System statistics endpoint for monitoring"""
    try:
        from yuuzone.utils.connection_manager import connection_manager
        from yuuzone.utils.system_monitor import system_monitor
        from yuuzone.utils.materialized_view_refresher import get_materialized_view_refresher
        
        stats = {
            "system": system_monitor.get_system_stats(),
            "connections": connection_manager.get_connection_stats(),
            "materialized_view_refresher": get_materialized_view_refresher().get_status() if get_materialized_view_refresher() else None,
            "timestamp": datetime.now().isoformat()
        }
        
        return jsonify(stats), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/system/materialized-view/refresh", methods=["POST"])
def manual_materialized_view_refresh():
    """Manually trigger materialized view refresh (for testing/debugging)"""
    try:
        from yuuzone.utils.materialized_view_refresher import get_materialized_view_refresher
        
        refresher = get_materialized_view_refresher()
        if refresher:
            refresher.manual_refresh()
            return jsonify({
                "message": "Materialized view refresh triggered successfully",
                "status": refresher.get_status()
            }), 200
        else:
            return jsonify({"error": "Materialized view refresher not available"}), 503
            
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# noqa
from yuuzone.users.routes import user
from yuuzone.subthreads.routes import threads
from yuuzone.posts.routes import posts
from yuuzone.comments.routes import comments
from yuuzone.reactions.routes import reactions
from yuuzone.messages.routes import messages
from yuuzone.translation.routes import translation
from yuuzone.subscriptions import init_subscription_routes
from yuuzone.coins.routes import coins_bp

app.register_blueprint(user)
app.register_blueprint(threads)
app.register_blueprint(posts)
app.register_blueprint(comments)
app.register_blueprint(reactions)
app.register_blueprint(messages)
app.register_blueprint(translation)
app.register_blueprint(coins_bp, url_prefix='/api/coins')
init_subscription_routes(app)

# Register catch-all route AFTER all API routes
def register_catch_all_route():
    @app.route("/", defaults={"path": ""})
    @app.route("/<path:path>")
    def catch_all(path):
        # Don't interfere with API routes - let them be handled by their specific handlers
        if path.startswith('api/'):
            # Let Flask handle this as a 404 for API routes
            return None
        
        # Handle Socket.IO requests - don't interfere with them
        if path.startswith('socket.io/'):
            return jsonify({"error": "Socket.IO endpoint not found"}), 404

        # For all other routes, try to serve the React app
        try:
            # Check if it's a static asset request (has file extension)
            if path and ('.' in path.split('/')[-1]):
                # Try to serve static file first
                try:
                    static_file = app.send_static_file(path)
                    # Set proper MIME types for JavaScript and CSS files
                    if path.endswith('.js'):
                        return static_file, 200, {'Content-Type': 'application/javascript'}
                    elif path.endswith('.css'):
                        return static_file, 200, {'Content-Type': 'text/css'}
                    elif path.endswith('.png') or path.endswith('.jpg') or path.endswith('.jpeg') or path.endswith('.gif') or path.endswith('.svg'):
                        return static_file, 200, {'Content-Type': 'image/' + path.split('.')[-1]}
                    else:
                        return static_file
                except Exception as static_error:
                    # If static file not found, fall back to index.html
                    logging.warning(f"Static file not found: {path}, falling back to index.html")
                    return app.send_static_file("index.html")
            else:
                # For all other routes, serve index.html (React Router will handle routing)
                return app.send_static_file("index.html")
        except Exception as e:
            # Fallback if static files are not available
            return jsonify({
                "message": "YuuZone API is running",
                "status": "backend-only",
                "note": "Frontend files not found - check build process",
                "error": str(e)
            }), 200

# Register the catch-all route after all blueprints
register_catch_all_route()


@app.errorhandler(ValidationError)
def handle_marshmallow_validation(err):
    return jsonify({"errors": err.messages}), 400


@app.errorhandler(404)
def not_found(error):
    # If it's an API request, return JSON error
    if request.path.startswith('/api/'):
        return jsonify({
            "error": "API endpoint not found",
            "path": request.path,
            "method": request.method
        }), 404

    # For non-API requests, try to serve the React app
    try:
        return app.send_static_file("index.html")
    except Exception:
        # Fallback if static files are not available
        return jsonify({"message": "Not found", "status": "backend-only"}), 404


@app.errorhandler(500)
def handle_internal_error(error):
    import logging
    logging.error(f"Internal server error: {error}")
    return jsonify({
        "error": "Internal server error",
        "message": "Something went wrong on the server"
    }), 500


@app.teardown_appcontext
def shutdown_session(exception=None):
    db.session.remove()
