from flask import Blueprint
from .routes import subscription

def init_subscription_routes(app):
    """Initialize subscription routes"""
    app.register_blueprint(subscription, url_prefix='/api/subscriptions') 