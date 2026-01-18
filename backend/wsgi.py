#!/usr/bin/env python3
"""
WSGI entry point for YuuZone production deployment with Gunicorn
This file provides the WSGI application object that Gunicorn can use
"""

import sys
import os
import logging

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)

# Set environment variables BEFORE any imports to prevent initialization errors
logger.info("Setting up environment variables...")

# Ensure required environment variables are set before importing yuuzone
if not os.environ.get('DATABASE_URI'):
    os.environ['DATABASE_URI'] = 'sqlite:///fallback.db'
    logger.warning("DATABASE_URI not set, using fallback SQLite database")

if not os.environ.get('SECRET_KEY'):
    os.environ['SECRET_KEY'] = 'fallback-secret-key-for-development'
    logger.warning("SECRET_KEY not set, using fallback secret key")

# Set Cloudinary fallbacks to prevent import errors
if not os.environ.get('CLOUDINARY_NAME'):
    os.environ['CLOUDINARY_NAME'] = 'fallback'
if not os.environ.get('CLOUDINARY_API_KEY'):
    os.environ['CLOUDINARY_API_KEY'] = 'fallback'
if not os.environ.get('CLOUDINARY_API_SECRET'):
    os.environ['CLOUDINARY_API_SECRET'] = 'fallback'

# Try to create the application
try:
    logger.info("Importing YuuZone application...")

    # Import the Flask app
    from yuuzone import app
    from yuuzone.config import SECRET_KEY

    # Configure the app
    app.secret_key = SECRET_KEY

    # Check if static folder exists and handle gracefully
    if hasattr(app, 'static_folder') and app.static_folder:
        if not os.path.exists(app.static_folder):
            logger.warning(f"Static folder not found: {app.static_folder}")
            app.static_folder = None

    logger.info("✅ Flask app imported successfully")

    # Socket.IO is already initialized in __init__.py, just use the app
    try:
        # Import to verify Socket.IO is available
        from yuuzone.socketio_app import socketio

        logger.info("✅ Socket.IO already initialized in app")
        logger.info(f"Socket.IO type: {type(socketio)}")
        logger.info(f"Socket.IO server: {socketio.server}")

        # For Gunicorn with eventlet worker, Flask-SocketIO becomes the WSGI app
        # when properly initialized with the Flask app
        application = app

        logger.info("🚀 Using Flask app with integrated Socket.IO for production")

    except Exception as socketio_error:
        logger.warning(f"Socket.IO setup failed: {socketio_error}")
        logger.info("Falling back to Flask app without Socket.IO")
        application = app

    logger.info(f"Final application type: {type(application)}")
    logger.info(f"Final application callable: {callable(application)}")

except Exception as e:
    logger.error(f"❌ Failed to import YuuZone application: {e}")
    import traceback
    traceback.print_exc()

    # Create a minimal fallback WSGI application
    from flask import Flask, jsonify

    fallback_app = Flask(__name__)
    fallback_app.config['SECRET_KEY'] = 'fallback-key'

    @fallback_app.route('/')
    def hello():
        return jsonify({"message": "YuuZone fallback application", "status": "limited"})

    @fallback_app.route('/health')
    @fallback_app.route('/healthz')
    def health():
        return jsonify({"status": "fallback", "message": "Running in fallback mode"})

    application = fallback_app
    logger.info("🚨 Using fallback Flask application")
