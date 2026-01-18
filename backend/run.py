import subprocess
import signal
import sys
sys.path.insert(0, '')

from yuuzone import app
# Socket.IO import for development - use try/except for graceful fallback
try:
    from yuuzone.socketio_app import socketio
except ImportError:
    print("⚠️ Socket.IO not available, running in basic Flask mode")
    socketio = None

from yuuzone.config import (
    SECRET_KEY
)

# def rebuild_frontend():
#     try:
#         subprocess.run(["npm", "install"], cwd="../frontend/yuuzone", check=True)
#         subprocess.run(["npm", "run", "build"], cwd="../frontend/yuuzone", check=True)
#         print("Frontend rebuild completed successfully.")
#     except subprocess.CalledProcessError as e:
#         # print(f"fFrontend rebuild failed: {e}")

def install_backend_dependencies():
    try:
        subprocess.run([sys.executable, "-m", "pip", "install", "-r", "requirements.txt"], cwd="../backend", check=True)
        print("Backend dependencies installed successfully.")
    except subprocess.CalledProcessError as e:
        # print(f"fBackend dependencies installation failed: {e}")
        pass

if __name__ == "__main__":
    # Rebuild frontend and install backend dependencies before starting backend
    # install_backend_dependencies()  # Commented out for Render deployment

    # Start frontend production build server (commented out for Render)
    # frontend_process = subprocess.Popen(
    #     ["npm", "run", "dev"],
    #     cwd="../frontend/yuuzone",
    #     stdout=sys.stdout,
    #     stderr=sys.stderr,
    # )

    try:
        app.secret_key = SECRET_KEY

        # Socket.IO is already initialized in __init__.py, just run the app
        if socketio:
            # Remove allow_unsafe_werkzeug to fix WSGI compatibility issues
            socketio.run(app, host="0.0.0.0", port=5000, debug=False, use_reloader=False)
        else:
            # Fallback to basic Flask for development
            print("🚀 Starting in basic Flask mode (no Socket.IO)")
            app.run(host="0.0.0.0", port=5000, debug=False)
    except Exception as e:
        # print(f"fError running app: {e}")
        pass

