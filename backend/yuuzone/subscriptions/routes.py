from flask import Blueprint, jsonify, request
from flask_login import current_user
from yuuzone.auth.decorators import login_required
from yuuzone.subscriptions.service import SubscriptionService
from yuuzone.subscriptions.models import UserTier, UserSubscription, Payment, UserCustomTheme
from yuuzone import db, socketio
import logging
from datetime import datetime
import os

subscription = Blueprint('subscription', __name__)
subscription_service = SubscriptionService()

@subscription.route("/plans", methods=["GET"])
@login_required
def get_subscription_plans():
    """Get all available subscription plans"""
    try:
        plans = subscription_service.get_subscription_plans()
        user_subscriptions = subscription_service.get_user_subscriptions(current_user.id)
        
        # Add user's current subscriptions to response
        user_subscription_types = [sub['tier_slug'] for sub in user_subscriptions]
        
        return jsonify({
            "plans": plans,
            "user_subscriptions": user_subscriptions,
            "user_subscription_types": user_subscription_types
        }), 200
    except Exception as e:
        logging.error(f"Error getting subscription plans: {e}")
        return jsonify({"error": "Failed to get subscription plans"}), 500

@subscription.route("/user/status", methods=["GET"])
@login_required
def get_user_subscription_status():
    """Get user's current subscription status and limits"""
    try:
        subscriptions = subscription_service.get_user_subscriptions(current_user.id)
        limits = subscription_service.get_user_limits(current_user.id)
        theme_slots = subscription_service.get_theme_slots_available(current_user.id)
        
        return jsonify({
            "subscriptions": subscriptions,
            "limits": limits,
            "theme_slots_available": theme_slots
        }), 200
    except Exception as e:
        logging.error(f"Error getting user subscription status: {e}")
        return jsonify({"error": "Failed to get subscription status"}), 500

@subscription.route("/user/tier-status", methods=["GET"])
@login_required
def get_user_tier_status():
    """Get user's current tier status and purchase eligibility"""
    try:
        current_tier = subscription_service.get_user_current_tier(current_user.id)
        subscriptions = subscription_service.get_user_subscriptions(current_user.id)
        limits = subscription_service.get_user_limits(current_user.id)
        
        # Check purchase eligibility for each tier
        purchase_eligibility = {}
        for tier_slug in ['support', 'vip']:
            can_purchase, message = subscription_service.can_purchase_tier(current_user.id, tier_slug)
            purchase_eligibility[tier_slug] = {
                'can_purchase': can_purchase,
                'message': message
            }
        
        return jsonify({
            "current_tier": current_tier,
            "subscriptions": subscriptions,
            "limits": limits,
            "purchase_eligibility": purchase_eligibility
        }), 200
    except Exception as e:
        logging.error(f"Error getting user tier status: {e}")
        return jsonify({"error": "Failed to get tier status"}), 500

@subscription.route("/user/settings-data", methods=["GET"])
@login_required
def get_user_settings_data():
    """Get all user subscription data optimized for settings page"""
    try:
        data = subscription_service.get_user_subscription_data(current_user.id)
        return jsonify(data), 200
    except Exception as e:
        logging.error(f"Error getting user settings data: {e}")
        return jsonify({"error": "Failed to get settings data"}), 500

@subscription.route("/payment/qr/<tier_slug>", methods=["GET"])
@login_required
def generate_payment_qr(tier_slug):
    """Generate payment QR code for subscription"""
    try:
        # Check if user can purchase this tier
        can_purchase, message = subscription_service.can_purchase_tier(current_user.id, tier_slug)
        if not can_purchase:
            return jsonify({
                "error": message
            }), 400
        
        # Generate QR code
        qr_data = subscription_service.generate_payment_qr(current_user.username, tier_slug)
        if not qr_data:
            return jsonify({"error": "Failed to generate payment QR"}), 500
        
        return jsonify(qr_data), 200
    except Exception as e:
        logging.error(f"Error generating payment QR: {e}")
        return jsonify({"error": "Failed to generate payment QR"}), 500

@subscription.route("/webhook/sepay", methods=["POST", "GET"])
def sepay_webhook():
    """Handle SePay webhook for payment confirmation"""
    
    # Handle GET requests (for debugging/testing)
    if request.method == "GET":
        return jsonify({
            "message": "SePay webhook endpoint is active",
            "method": "GET",
            "note": "This endpoint expects POST requests from SePay with payment data",
            "status": "ready"
        }), 200
    
    try:
        # Get webhook data
        webhook_data = request.get_json()
        if not webhook_data:
            logging.error("No webhook data received")
            return jsonify({"error": "No webhook data received"}), 400
        
        logging.info(f"Received SePay webhook: {webhook_data}")
        logging.info(f"Webhook data type: {type(webhook_data)}")
        logging.info(f"Webhook data keys: {list(webhook_data.keys()) if isinstance(webhook_data, dict) else 'Not a dict'}")
        
        # Log all headers for debugging (optional)
        logging.info(f"SePay webhook headers: {dict(request.headers)}")
        
        # Log raw request data for debugging
        logging.info(f"Raw request data: {request.get_data(as_text=True)}")
        
        # Since API key is disabled, we'll skip authentication
        # But we can still log if any signature headers are present for debugging
        signature = request.headers.get('X-SePay-Signature') or \
                   request.headers.get('X-Webhook-Signature') or \
                   request.headers.get('Signature') or \
                   request.headers.get('Authorization')
        
        if signature:
            logging.info(f"Signature header found: {signature}")
        else:
            logging.info("No signature header found (API key disabled)")
        
        payment_reference = subscription_service._extract_payment_reference(webhook_data)
        
        if payment_reference:
            # Both coin and tier payments now use TKPINC format
            # We need to check which type by looking for the payment record
            from yuuzone.coins.models import CoinPayment
            
            # Try to find coin payment first
            coin_payment = CoinPayment.query.filter(
                CoinPayment.notes.contains(payment_reference)
            ).first()
            
            if coin_payment:
                # This is a coin payment
                logging.info(f"Processing coin payment: {payment_reference}")
                success = subscription_service.process_coin_payment_webhook(webhook_data)
            else:
                # This is a subscription payment
                logging.info(f"Processing subscription payment: {payment_reference}")
                success = subscription_service.process_sepay_payment(webhook_data)
        else:
            logging.error(f"No payment reference found in webhook data")
            return jsonify({"error": "No payment reference found"}), 400
        
        if success:
            return jsonify({
                "success": True,
                "message": "Payment processed successfully"
            }), 200
        else:
            # Get more specific error information from logs
            logging.error("Payment processing failed - check logs for details")
            return jsonify({
                "error": "Failed to process payment",
                "details": "Check server logs for specific error information"
            }), 500
            
    except Exception as e:
        logging.error(f"Error processing SePay webhook: {e}")
        return jsonify({"error": "Failed to process webhook"}), 500

@subscription.route("/history", methods=["GET"])
@login_required
def get_payment_history():
    """Get user's payment history"""
    try:
        subscriptions = UserSubscription.query.filter_by(user_id=current_user.id)\
            .order_by(UserSubscription.created_at.desc()).all()
        
        return jsonify({
            "history": [sub.as_dict() for sub in subscriptions]
        }), 200
    except Exception as e:
        logging.error(f"Error getting payment history: {e}")
        return jsonify({"error": "Failed to get payment history"}), 500

@subscription.route("/purchase-history", methods=["GET"])
@login_required
def get_purchase_history():
    """Get comprehensive purchase history including subscriptions, coins, avatars, and boosts"""
    try:
        from yuuzone.coins.models import CoinTransaction, CoinPayment, UserAvatar
        from yuuzone.models import PostBoost
        from yuuzone.subscriptions.models import Payment
        
        # Get subscription purchases
        subscription_payments = Payment.query.filter_by(user_id=current_user.id)\
            .order_by(Payment.created_at.desc()).all()
        
        # Get coin purchases
        coin_payments = CoinPayment.query.filter_by(user_id=current_user.id)\
            .order_by(CoinPayment.created_at.desc()).all()
        
        # Get coin transactions (including avatar purchases, boosts, etc.)
        coin_transactions = CoinTransaction.query.filter_by(user_id=current_user.id)\
            .order_by(CoinTransaction.created_at.desc()).all()
        
        # Get avatar purchases
        avatar_purchases = UserAvatar.query.filter_by(user_id=current_user.id)\
            .order_by(UserAvatar.purchased_at.desc()).all()
        
        # Get post boosts
        post_boosts = PostBoost.query.filter_by(user_id=current_user.id)\
            .order_by(PostBoost.created_at.desc()).all()
        
        # Combine and format all purchases
        purchase_history = []
        
        # Add subscription purchases
        for payment in subscription_payments:
            purchase_history.append({
                "id": f"sub_{payment.id}",
                "type": "subscription",
                "tier_name": payment.tier.name if payment.tier else "Unknown",
                "tier_slug": payment.tier.slug if payment.tier else None,
                "amount": float(payment.amount) if payment.amount else 0,
                "currency": payment.currency,
                "payment_status": payment.payment_status,
                "payment_method": payment.payment_method,
                "created_at": payment.created_at.isoformat() if payment.created_at else None,
                "paid_at": payment.paid_at.isoformat() if payment.paid_at else None,
                "description": f"Subscription to {payment.tier.name if payment.tier else 'Unknown Tier'}"
            })
        
        # Add coin purchases
        for payment in coin_payments:
            purchase_history.append({
                "id": f"coin_{payment.id}",
                "type": "coin_purchase",
                "package_name": payment.package.name if payment.package else "Unknown Package",
                "coin_amount": payment.coin_amount,
                "amount": payment.amount_vnd,
                "currency": payment.currency,
                "payment_status": payment.payment_status,
                "payment_method": payment.payment_method,
                "created_at": payment.created_at.isoformat() if payment.created_at else None,
                "paid_at": payment.paid_at.isoformat() if payment.paid_at else None,
                "description": f"Purchased {payment.coin_amount} coins"
            })
        
        # Add coin transactions (avatar purchases, boosts, etc.)
        for transaction in coin_transactions:
            if transaction.transaction_type in ['avatar_purchase', 'post_boost', 'tier_purchase']:
                purchase_history.append({
                    "id": f"trans_{transaction.id}",
                    "type": transaction.transaction_type,
                    "amount": transaction.amount,
                    "balance_after": transaction.balance_after,
                    "reference_id": transaction.reference_id,
                    "reference_type": transaction.reference_type,
                    "created_at": transaction.created_at.isoformat() if transaction.created_at else None,
                    "description": transaction.description or f"{transaction.transaction_type.replace('_', ' ').title()}"
                })
        
        # Add avatar purchases (from UserAvatar table)
        for avatar in avatar_purchases:
            purchase_history.append({
                "id": f"avatar_{avatar.id}",
                "type": "avatar_purchase",
                "avatar_name": avatar.avatar_item.name if avatar.avatar_item else "Unknown Avatar",
                "avatar_image": avatar.avatar_item.image_url if avatar.avatar_item else None,
                "price_coins": avatar.avatar_item.price_coins if avatar.avatar_item else 0,
                "created_at": avatar.purchased_at.isoformat() if avatar.purchased_at else None,
                "description": f"Purchased avatar: {avatar.avatar_item.name if avatar.avatar_item else 'Unknown Avatar'}"
            })
        
        # Add post boosts
        for boost in post_boosts:
            purchase_history.append({
                "id": f"boost_{boost.id}",
                "type": "post_boost",
                "post_id": boost.post_id,
                "boost_start": boost.boost_start.isoformat() if boost.boost_start else None,
                "boost_end": boost.boost_end.isoformat() if boost.boost_end else None,
                "is_active": boost.is_active,
                "created_at": boost.created_at.isoformat() if boost.created_at else None,
                "description": f"Boosted post #{boost.post_id}"
            })
        
        # Sort all purchases by date (newest first)
        purchase_history.sort(key=lambda x: x['created_at'] or '', reverse=True)
        
        return jsonify({
            "success": True,
            "purchase_history": purchase_history,
            "total_count": len(purchase_history)
        }), 200
        
    except Exception as e:
        logging.error(f"Error getting purchase history: {e}")
        return jsonify({"error": "Failed to get purchase history"}), 500

@subscription.route("/themes", methods=["GET"])
@login_required
def get_user_themes():
    """Get all custom themes for the current user"""
    try:
        themes = UserCustomTheme.query.filter_by(user_id=current_user.id).order_by(UserCustomTheme.created_at.desc()).all()
        return jsonify({
            "themes": [theme.as_dict() for theme in themes]
        }), 200
    except Exception as e:
        logging.error(f"Error getting user themes: {e}")
        return jsonify({"error": "Failed to get themes"}), 500

@subscription.route("/themes", methods=["POST"])
@login_required
def create_custom_theme():
    """Create a new custom theme"""
    try:
        data = request.get_json()
        theme_name = data.get('theme_name')
        theme_data = data.get('theme_data')
        
        if not theme_name or not theme_data:
            return jsonify({"error": "Theme name and data are required"}), 400
        
        # Check if user has available theme slots
        available_slots = subscription_service.get_theme_slots_available(current_user.id)
        if available_slots <= 0:
            return jsonify({"error": "No theme slots available"}), 403
        
        # Check if theme name already exists for this user
        existing_theme = UserCustomTheme.query.filter_by(
            user_id=current_user.id, 
            theme_name=theme_name
        ).first()
        
        if existing_theme:
            return jsonify({"error": "Theme name already exists"}), 409
        
        # Create new theme
        new_theme = UserCustomTheme(
            user_id=current_user.id,
            theme_name=theme_name,
            theme_data=theme_data,
            is_active=False
        )
        
        db.session.add(new_theme)
        db.session.commit()
        
        # Emit real-time event for theme creation
        theme_data = new_theme.as_dict()
        socketio.emit('custom_theme_updated', {
            'theme_id': new_theme.id,
            'action': 'created',
            'theme_data': theme_data
        }, room=f'user_settings_{current_user.id}')
        
        return jsonify({
            "message": "Theme created successfully",
            "theme": theme_data
        }), 201
        
    except Exception as e:
        logging.error(f"Error creating theme: {e}")
        db.session.rollback()
        return jsonify({"error": "Failed to create theme"}), 500

@subscription.route("/themes/<int:theme_id>", methods=["PUT"])
@login_required
def update_custom_theme(theme_id):
    """Update an existing custom theme"""
    try:
        theme = UserCustomTheme.query.filter_by(
            id=theme_id, 
            user_id=current_user.id
        ).first()
        
        if not theme:
            return jsonify({"error": "Theme not found"}), 404
        
        data = request.get_json()
        theme_name = data.get('theme_name')
        theme_data = data.get('theme_data')
        
        if theme_name:
            # Check if new name conflicts with existing theme
            existing_theme = UserCustomTheme.query.filter_by(
                user_id=current_user.id, 
                theme_name=theme_name
            ).filter(UserCustomTheme.id != theme_id).first()
            
            if existing_theme:
                return jsonify({"error": "Theme name already exists"}), 409
            
            theme.theme_name = theme_name
        
        if theme_data:
            theme.theme_data = theme_data
        
        theme.updated_at = datetime.utcnow()
        db.session.commit()
        
        # Emit real-time event for theme update
        theme_data = theme.as_dict()
        socketio.emit('custom_theme_updated', {
            'theme_id': theme.id,
            'action': 'updated',
            'theme_data': theme_data
        }, room=f'user_settings_{current_user.id}')
        
        return jsonify({
            "message": "Theme updated successfully",
            "theme": theme_data
        }), 200
        
    except Exception as e:
        logging.error(f"Error updating theme: {e}")
        db.session.rollback()
        return jsonify({"error": "Failed to update theme"}), 500

@subscription.route("/themes/<int:theme_id>", methods=["DELETE"])
@login_required
def delete_custom_theme(theme_id):
    """Delete a custom theme"""
    try:
        theme = UserCustomTheme.query.filter_by(
            id=theme_id, 
            user_id=current_user.id
        ).first()
        
        if not theme:
            return jsonify({"error": "Theme not found"}), 404
        
        theme_id = theme.id
        db.session.delete(theme)
        db.session.commit()
        
        # Emit real-time event for theme deletion
        socketio.emit('custom_theme_updated', {
            'theme_id': theme_id,
            'action': 'deleted'
        }, room=f'user_settings_{current_user.id}')
        
        return jsonify({"message": "Theme deleted successfully"}), 200
        
    except Exception as e:
        logging.error(f"Error deleting theme: {e}")
        db.session.rollback()
        return jsonify({"error": "Failed to delete theme"}), 500

@subscription.route("/themes/<int:theme_id>/activate", methods=["POST"])
@login_required
def activate_custom_theme(theme_id):
    """Activate a custom theme"""
    try:
        theme = UserCustomTheme.query.filter_by(
            id=theme_id, 
            user_id=current_user.id
        ).first()
        
        if not theme:
            return jsonify({"error": "Theme not found"}), 404
        
        # Deactivate all other themes for this user
        UserCustomTheme.query.filter_by(user_id=current_user.id).update({"is_active": False})
        
        # Activate the selected theme
        theme.is_active = True
        db.session.commit()
        
        # Emit real-time event for theme activation
        theme_data = theme.as_dict()
        socketio.emit('custom_theme_updated', {
            'theme_id': theme.id,
            'action': 'activated',
            'theme_data': theme_data
        }, room=f'user_settings_{current_user.id}')
        
        return jsonify({
            "message": "Theme activated successfully",
            "theme": theme_data
        }), 200
        
    except Exception as e:
        logging.error(f"Error activating theme: {e}")
        db.session.rollback()
        return jsonify({"error": "Failed to activate theme"}), 500

@subscription.route("/themes/deactivate", methods=["POST"])
@login_required
def deactivate_custom_theme():
    """Deactivate all custom themes for the user"""
    try:
        UserCustomTheme.query.filter_by(user_id=current_user.id).update({"is_active": False})
        db.session.commit()
        
        # Emit real-time event for theme deactivation
        socketio.emit('custom_theme_updated', {
            'action': 'deactivated'
        }, room=f'user_settings_{current_user.id}')
        
        return jsonify({"message": "All themes deactivated successfully"}), 200
    except Exception as e:
        logging.error(f"Error deactivating themes: {e}")
        db.session.rollback()
        return jsonify({"error": "Failed to deactivate themes"}), 500

@subscription.route("/themes/slots", methods=["GET"])
@login_required
def get_theme_slots():
    """Get user's theme slot information"""
    try:
        available_slots = subscription_service.get_theme_slots_available(current_user.id)
        limits = subscription_service.get_user_limits(current_user.id)
        total_slots = limits.get('theme_slots', 0)
        used_slots = total_slots - available_slots
        
        logging.info(f"User {current_user.id} theme slots: total={total_slots}, used={used_slots}, available={available_slots}")
        
        return jsonify({
            "available_slots": available_slots,
            "total_slots": total_slots,
            "used_slots": used_slots
        }), 200
    except Exception as e:
        logging.error(f"Error getting theme slots: {e}")
        return jsonify({"error": "Failed to get theme slots"}), 500

@subscription.route("/payment/status/<payment_reference>", methods=["GET"])
def check_payment_status(payment_reference):
    """Check payment status by reference ID"""
    try:
        # URL decode the payment reference (handles %20 -> space)
        from urllib.parse import unquote
        decoded_reference = unquote(payment_reference)
        
        # Always log payment status checks for debugging
        logging.info(f"🔍 Checking payment status for reference: '{decoded_reference}'")
        
        # Use the improved subscription service that searches both tables
        payment = subscription_service.find_payment_by_reference(decoded_reference)
        
        if payment:
            # For public payment status checks, we don't require user authentication
            # but we can still log if a user is authenticated and accessing their own payment
            if current_user.is_authenticated and payment.user_id != current_user.id:
                logging.warning(f"User {current_user.id} accessing payment {payment.id} owned by user {payment.user_id}")
                # Don't block access, just log the warning
            
            # Determine payment type
            from yuuzone.coins.models import CoinPayment
            is_coin_payment = isinstance(payment, CoinPayment)
            
            logging.info(f"Payment found: {payment.id}, status: {payment.payment_status}, type: {'coin' if is_coin_payment else 'subscription'}")
            
            # Use timezone-aware datetime for comparison
            from datetime import timezone
            current_time = datetime.now(timezone.utc)
            
            return jsonify({
                "payment": payment.as_dict(),
                "status": payment.payment_status,
                "expires_at": payment.expires_at.isoformat() if payment.expires_at else None,
                "is_expired": payment.expires_at and current_time > payment.expires_at if payment.expires_at else False,
                "payment_type": "coin" if is_coin_payment else "subscription"
            }), 200
        else:
            # Log warning with more details
            logging.warning(f"❌ Payment not found for reference: '{decoded_reference}'")
            
            # Show recent payments for debugging
            from yuuzone.coins.models import CoinPayment
            recent_coin_payments = CoinPayment.query.order_by(CoinPayment.created_at.desc()).limit(3).all()
            recent_sub_payments = Payment.query.order_by(Payment.created_at.desc()).limit(3).all()
            logging.info(f"🔍 Recent coin payments: {[p.notes for p in recent_coin_payments if p.notes]}")
            logging.info(f"🔍 Recent subscription payments: {[p.notes for p in recent_sub_payments if p.notes]}")
            
            return jsonify({
                "error": "Payment not found"
            }), 404
        
    except Exception as e:
        logging.error(f"Error checking payment status: {e}")
        return jsonify({"error": "Failed to check payment status"}), 500

@subscription.route("/payment/pending", methods=["GET"])
@login_required
def get_pending_payments():
    """Get user's pending payments"""
    try:
        from yuuzone.subscriptions.models import Payment
        
        # Use timezone-aware datetime for comparison
        from datetime import timezone
        current_time = datetime.now(timezone.utc)
        
        pending_payments = Payment.query.filter_by(
            user_id=current_user.id,
            payment_status='pending'
        ).filter(
            Payment.expires_at > current_time
        ).order_by(Payment.created_at.desc()).all()
        
        return jsonify({
            "pending_payments": [payment.as_dict() for payment in pending_payments]
        }), 200
        
    except Exception as e:
        logging.error(f"Error getting pending payments: {e}")
        return jsonify({"error": "Failed to get pending payments"}), 500

@subscription.route("/cancel", methods=["POST"])
@login_required
def cancel_subscription():
    """Cancel user's active subscription"""
    try:
        from yuuzone.subscriptions.models import UserSubscription
        from datetime import timezone
        
        # Find user's active subscription
        current_time = datetime.now(timezone.utc)
        active_subscription = UserSubscription.query.filter_by(
            user_id=current_user.id,
            is_active=True
        ).filter(
            UserSubscription.expires_at > current_time
        ).first()
        
        if not active_subscription:
            return jsonify({
                "error": "No active subscription found to cancel"
            }), 404
        
        # Cancel the subscription
        active_subscription.is_active = False
        active_subscription.cancelled_at = current_time
        active_subscription.auto_renew = False
        
        db.session.commit()
        
        logging.info(f"Subscription {active_subscription.id} cancelled for user {current_user.id}")
        
        return jsonify({
            "success": True,
            "message": "Subscription cancelled successfully",
            "subscription": active_subscription.as_dict()
        }), 200
        
    except Exception as e:
        logging.error(f"Error cancelling subscription: {e}")
        db.session.rollback()
        return jsonify({"error": "Failed to cancel subscription"}), 500 

@subscription.route("/test-payment-completion", methods=["POST"])
@login_required
def test_payment_completion():
    """Test endpoint to manually trigger payment completion events"""
    try:
        data = request.get_json()
        payment_type = data.get('payment_type', 'coin')
        amount = data.get('amount', 100)
        
        # Emit test payment completion event
        try:
            from yuuzone import socketio
            if socketio:
                socketio.emit('payment_completed', {
                    'user_id': current_user.id,
                    'payment_reference': f'TEST_{int(datetime.now().timestamp())}',
                    'payment_type': payment_type,
                    'amount': amount,
                    'tier_name': 'Test Tier' if payment_type == 'subscription' else None,
                    'new_balance': 1000  # Test balance
                }, room=f'user_{current_user.id}')
                
                return jsonify({
                    "success": True,
                    "message": f"Test {payment_type} payment completion event emitted"
                }), 200
            else:
                return jsonify({
                    "error": "SocketIO not available"
                }), 500
        except Exception as e:
            return jsonify({
                "error": f"Failed to emit test event: {str(e)}"
            }), 500
            
    except Exception as e:
        return jsonify({
            "error": f"Test failed: {str(e)}"
        }), 500

@subscription.route("/manual-process-payment", methods=["POST"])
@login_required
def manual_process_payment():
    """Manually process a payment by reference (for testing/debugging)"""
    try:
        data = request.get_json()
        payment_reference = data.get('payment_reference')
        
        if not payment_reference:
            return jsonify({
                "success": False,
                "error": "Payment reference is required"
            }), 400
        
        logging.info(f"Manual payment processing requested for reference: {payment_reference}")
        
        # Find the payment with flexible matching
        from yuuzone.coins.models import CoinPayment
        payment = None
        
        # Try exact match first
        payment = CoinPayment.query.filter(
            CoinPayment.notes == f"Payment reference: {payment_reference}"
        ).first()
        
        if not payment:
            # Try contains search
            payment = CoinPayment.query.filter(
                CoinPayment.notes.contains(payment_reference)
            ).first()
        
        if not payment and ' ' in payment_reference:
            # Try searching with just the random ID part
            random_id = payment_reference.split(' ')[-1]
            payment = CoinPayment.query.filter(
                CoinPayment.notes.contains(random_id)
            ).first()
        
        if not payment and 'TKPINC' in payment_reference.upper():
            # Try variations for typos
            variations = [
                payment_reference.replace('TKPINC', 'TKPTNC'),
                payment_reference.replace('TKPTNC', 'TKPINC'),
                payment_reference.upper(),
                payment_reference.lower()
            ]
            
            for variation in variations:
                payment = CoinPayment.query.filter(
                    CoinPayment.notes.contains(variation)
                ).first()
                if payment:
                    logging.info(f"✅ Found payment with variation: {variation}")
                    break
        
        if not payment:
            # Show recent payments for debugging
            recent_payments = CoinPayment.query.order_by(CoinPayment.created_at.desc()).limit(5).all()
            logging.info(f"🔍 Recent payments: {[p.notes for p in recent_payments if p.notes]}")
            
            return jsonify({
                "success": False,
                "error": f"Payment not found for reference: {payment_reference}",
                "recent_payments": [p.notes for p in recent_payments if p.notes]
            }), 404
        
        if payment.payment_status == 'completed':
            return jsonify({
                "success": False,
                "error": "Payment already completed"
            }), 400
        
        # Process the payment
        from yuuzone.coins.service import CoinService
        coin_service = CoinService()
        
        old_balance = coin_service.get_wallet_balance(payment.user_id)
        processed_payment = coin_service.process_coin_payment(payment.id)
        new_balance = coin_service.get_wallet_balance(payment.user_id)
        
        if processed_payment:
            return jsonify({
                "success": True,
                "message": "Payment processed successfully",
                "payment_id": payment.id,
                "user_id": payment.user_id,
                "old_balance": old_balance,
                "new_balance": new_balance,
                "coins_added": new_balance - old_balance
            }), 200
        else:
            return jsonify({
                "success": False,
                "error": "Failed to process payment"
            }), 500
            
    except Exception as e:
        logging.error(f"Error in manual payment processing: {e}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500 