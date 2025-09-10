from yuuzone import db
from yuuzone.subscriptions.models import UserTier, UserSubscription, Payment, UserCustomTheme
from datetime import datetime, timedelta, timezone
import logging
import os
import hashlib
import hmac
import random
import string
import traceback
import json
import re

class SubscriptionService:
    def __init__(self):
        # Default limits for free users
        self.default_limits = {
            'subthread_limit': 3,
            'theme_slots': 0,
            'upload_limit': 25 * 1024 * 1024,  # 25MB
            'translation_limit': 100
        }

    def generate_random_id(self, length=8):
        """Generate a random ID with specified length (max 8 characters)"""
        # Use uppercase letters and numbers for better readability
        characters = string.ascii_uppercase + string.digits
        return ''.join(random.choice(characters) for _ in range(length))

    def generate_payment_reference(self, username, tier_slug):
        """Generate payment reference in format: TKPINC [RANDOM ID]"""
        max_attempts = 10
        for attempt in range(max_attempts):
            random_id = self.generate_random_id(8)
            payment_reference = f"TKPINC {random_id}"
            
            # Ensure uniqueness by checking if this reference already exists
            from yuuzone.coins.models import CoinPayment
            from yuuzone.subscriptions.models import Payment
            
            # Check both coin payments and subscription payments
            existing_coin = CoinPayment.query.filter(CoinPayment.notes.contains(payment_reference)).first()
            existing_sub = Payment.query.filter(Payment.notes.contains(payment_reference)).first()
            
            if not existing_coin and not existing_sub:
                return payment_reference
        
        # If we've tried max_attempts times and still haven't found a unique reference,
        # generate one with a timestamp to ensure uniqueness
        import time
        timestamp = int(time.time())
        random_id = self.generate_random_id(4)
        return f"TKPINC {timestamp}{random_id}"

    def create_pending_payment(self, user_id, tier_slug, payment_reference):
        """Create a pending payment record to track the order"""
        try:
            tier = UserTier.query.filter_by(slug=tier_slug).first()
            if not tier:
                return None
            
            # Create payment record with 5-minute expiry
            payment = Payment(
                user_id=user_id,
                tier_id=tier.id,
                amount=tier.price_monthly,
                currency='VND',
                payment_status='pending',
                payment_method='bank',
                expires_at=datetime.now(timezone.utc) + timedelta(minutes=5),
                notes=f"Payment reference: {payment_reference}"
            )
            
            db.session.add(payment)
            db.session.commit()
            
            return payment
            
        except Exception as e:
            logging.error(f"Error creating pending payment: {e}")
            db.session.rollback()
            return None

    def find_payment_by_reference(self, payment_reference):
        """Find payment record by payment reference - flexible matching (searches both Payment and CoinPayment tables)"""
        try:
            logging.info(f"Searching for payment with reference: '{payment_reference}'")
            
            # Import joinedload for eager loading
            from sqlalchemy.orm import joinedload
            
            # First search in Payment table (subscription payments) with tier relationship loaded
            payment = Payment.query.options(joinedload(Payment.tier)).filter_by(notes=f"Payment reference: {payment_reference}").first()
            
            if payment:
                logging.info(f"Found subscription payment with exact match: {payment.id}, status: {payment.payment_status}, tier: {payment.tier.name if payment.tier else 'None'}")
                return payment
            
            # Try contains search in Payment table with tier relationship loaded
            payment = Payment.query.options(joinedload(Payment.tier)).filter(Payment.notes.contains(payment_reference)).first()
            
            if payment:
                logging.info(f"Found subscription payment with contains search: {payment.id}, status: {payment.payment_status}, tier: {payment.tier.name if payment.tier else 'None'}")
                return payment
            
            # Now search in CoinPayment table (coin payments)
            from yuuzone.coins.models import CoinPayment
            
            coin_payment = CoinPayment.query.filter_by(notes=f"Payment reference: {payment_reference}").first()
            
            if coin_payment:
                logging.info(f"Found coin payment with exact match: {coin_payment.id}, status: {coin_payment.payment_status}")
                return coin_payment
            
            # Try contains search in CoinPayment table
            coin_payment = CoinPayment.query.filter(CoinPayment.notes.contains(payment_reference)).first()
            
            if coin_payment:
                logging.info(f"Found coin payment with contains search: {coin_payment.id}, status: {coin_payment.payment_status}")
                return coin_payment
            
            # Try searching with just the random ID part (for TKPINC format)
            if ' ' in payment_reference:
                random_id = payment_reference.split(' ')[-1]
                
                # Search in Payment table with tier relationship loaded
                payment = Payment.query.options(joinedload(Payment.tier)).filter(Payment.notes.contains(random_id)).first()
                if payment:
                    logging.info(f"Found subscription payment with random ID search: {payment.id}, status: {payment.payment_status}, tier: {payment.tier.name if payment.tier else 'None'}")
                    return payment
                
                # Search in CoinPayment table
                coin_payment = CoinPayment.query.filter(CoinPayment.notes.contains(random_id)).first()
                if coin_payment:
                    logging.info(f"Found coin payment with random ID search: {coin_payment.id}, status: {coin_payment.payment_status}")
                    return coin_payment
            
            # Try searching for similar references (handle typos like TKPINC vs TKPTNC)
            if 'TKPINC' in payment_reference.upper():
                # Try variations
                variations = [
                    payment_reference.replace('TKPINC', 'TKPTNC'),
                    payment_reference.replace('TKPTNC', 'TKPINC'),
                    payment_reference.upper(),
                    payment_reference.lower()
                ]
                
                for variation in variations:
                    # Search in Payment table with tier relationship loaded
                    payment = Payment.query.options(joinedload(Payment.tier)).filter(Payment.notes.contains(variation)).first()
                    if payment:
                        logging.info(f"Found subscription payment with variation search: {payment.id}, status: {payment.payment_status}, tier: {payment.tier.name if payment.tier else 'None'}, variation: {variation}")
                        return payment
                    
                    # Search in CoinPayment table
                    coin_payment = CoinPayment.query.filter(CoinPayment.notes.contains(variation)).first()
                    if coin_payment:
                        logging.info(f"Found coin payment with variation search: {coin_payment.id}, status: {coin_payment.payment_status}, variation: {variation}")
                        return coin_payment
            
            logging.warning(f"No payment found for reference: '{payment_reference}'")
            
            # Debug: show recent payments from both tables
            recent_sub_payments = Payment.query.options(joinedload(Payment.tier)).order_by(Payment.created_at.desc()).limit(3).all()
            recent_coin_payments = CoinPayment.query.order_by(CoinPayment.created_at.desc()).limit(3).all()
            recent_sub_info = []
            for p in recent_sub_payments:
                if p.notes:
                    tier_name = p.tier.name if p.tier else "None"
                    recent_sub_info.append(f"{p.notes} (tier: {tier_name})")
            logging.info(f"Recent subscription payments: {recent_sub_info}")
            logging.info(f"Recent coin payments: {[p.notes for p in recent_coin_payments if p.notes]}")
            
            return None
        except Exception as e:
            logging.error(f"Error finding payment by reference: {e}")
            return None

    def create_subscription(self, user_id, tier_slug, payment_reference):
        """Create a new subscription for a user"""
        try:
            # Check if user already has an active subscription of this type
            if self.has_subscription(user_id, tier_slug):
                logging.warning(f"User {user_id} already has active {tier_slug} subscription")
                return None
            
            # Get tier information
            tier = UserTier.query.filter_by(slug=tier_slug).first()
            if not tier:
                logging.error(f"Invalid tier: {tier_slug}")
                return None
            
            # Find existing payment record by reference
            payment = self.find_payment_by_reference(payment_reference)
            if not payment:
                logging.error(f"Payment record not found for reference: {payment_reference}")
                return None
            
            # Use timezone-aware datetime
            from datetime import timezone
            current_time = datetime.now(timezone.utc)
            
            # Update payment status to completed
            payment.payment_status = 'completed'
            payment.paid_at = current_time
            
            # Calculate expiration date (1 month from now)
            expires_at = current_time + timedelta(days=30)
            
            # Create subscription
            subscription = UserSubscription(
                user_id=user_id,
                tier_id=tier.id,
                payment_id=payment.id,
                starts_at=current_time,
                expires_at=expires_at,
                is_active=True,
                auto_renew=False
            )
            
            db.session.add(subscription)
            db.session.commit()
            
            # Send email notification
            try:
                from yuuzone.utils.email import send_subscription_purchase_email
                from yuuzone.users.models import User
                
                user = User.query.get(user_id)
                if user and user.email:
                    # Get tier benefits
                    benefits = []
                    if tier.features and 'benefits' in tier.features:
                        benefits = tier.features['benefits']
                    
                    # Format dates
                    activation_date = subscription.starts_at.strftime("%B %d, %Y at %I:%M %p") if subscription.starts_at else "Now"
                    expiration_date = subscription.expires_at.strftime("%B %d, %Y at %I:%M %p") if subscription.expires_at else "Never"
                    
                    send_subscription_purchase_email(
                        user_email=user.email,
                        username=user.username,
                        tier_name=tier.name,
                        amount=float(payment.amount) if payment.amount else 0,
                        currency=payment.currency or 'VND',
                        activation_date=activation_date,
                        expiration_date=expiration_date,
                        transaction_id=f"TKPINC{payment.id:06d}",
                        benefits=benefits,
                        user=user
                    )
            except Exception as email_error:
                logging.error(f"Error sending subscription email notification: {email_error}")
            
            # Emit subscription purchase event via socket
            try:
                from yuuzone import socketio
                if socketio:
                    socketio.emit('subscription_purchased', {
                        'user_id': user_id,
                        'tier_name': tier.name,
                        'tier_slug': tier_slug,
                        'amount': float(payment.amount) if payment.amount else 0,
                        'currency': payment.currency or 'VND',
                        'payment_status': payment.payment_status
                    }, room=f'user_{user_id}')
                    
                    # Emit purchase history event
                    socketio.emit('new_purchase', {
                        'user_id': user_id,
                        'purchase_type': 'subscription',
                        'purchase_data': {
                            'id': f"sub_{subscription.id}",
                            'type': 'subscription',
                            'tier_name': tier.name,
                            'tier_slug': tier_slug,
                            'amount': float(payment.amount) if payment.amount else 0,
                            'currency': payment.currency or 'VND',
                            'payment_status': payment.payment_status,
                            'payment_method': payment.payment_method or 'bank',
                            'created_at': subscription.created_at.isoformat() if subscription.created_at else None,
                            'paid_at': payment.paid_at.isoformat() if payment.paid_at else None,
                            'description': f"Subscription to {tier.name}"
                        }
                    }, room=f'user_{user_id}')
            except Exception as e:
                logging.error(f"Error emitting subscription purchase event: {e}")
            
            logging.info(f"Created subscription for user {user_id}, tier {tier_slug}")
            return subscription.as_dict()
            
        except Exception as e:
            logging.error(f"Error creating subscription: {e}")
            db.session.rollback()
            return None

    def verify_sepay_webhook(self, webhook_data, signature):
        """Verify SePay webhook signature"""
        try:
            sepay_api_key = os.environ.get('SEPAY_API_KEY')
            if not sepay_api_key:
                logging.error("SEPAY_API_KEY not configured")
                return False
            
            logging.info(f"Verifying webhook signature: {signature[:20]}...")
            
            # Try different signature verification methods
            
            # Method 1: HMAC-SHA256 with API key
            expected_signature = hmac.new(
                sepay_api_key.encode('utf-8'),
                webhook_data.encode('utf-8'),
                hashlib.sha256
            ).hexdigest()
            
            if hmac.compare_digest(signature, expected_signature):
                logging.info("Signature verified using HMAC-SHA256")
                return True
            
            # Method 2: Bearer token (OAuth2)
            if signature.startswith('Bearer '):
                token = signature[7:]  # Remove 'Bearer ' prefix
                if token == sepay_api_key:
                    logging.info("Signature verified using Bearer token")
                    return True
            
            # Method 3: Direct API key comparison
            if signature == sepay_api_key:
                logging.info("Signature verified using direct API key")
                return True
            
            logging.warning(f"Signature verification failed. Expected: {expected_signature[:20]}..., Got: {signature[:20]}...")
            return False
            
        except Exception as e:
            logging.error(f"Error verifying SePay webhook: {e}")
            return False

    def process_sepay_payment(self, webhook_data):
        """Process SePay payment webhook data"""
        try:
            logging.info(f"🔍 DEBUG: Starting SePay payment webhook processing")
            logging.info(f"🔍 DEBUG: Webhook data: {webhook_data}")
            
            # Capture and analyze webhook data structure
            self._capture_webhook_structure(webhook_data)
            
            # Extract payment information with flexible field mapping
            payment_reference = self._extract_payment_reference(webhook_data)
            amount = self._extract_amount(webhook_data)
            transfer_type = self._extract_transfer_type(webhook_data)
            transaction_id = self._extract_transaction_id(webhook_data)
            reference_code = self._extract_reference_code(webhook_data)
            
            logging.info(f"🔍 DEBUG: Extracted: reference={payment_reference}, amount={amount}, type={transfer_type}, id={transaction_id}")
            
            # Validate required fields
            if not payment_reference:
                logging.error("❌ DEBUG: No payment reference found in webhook data")
                return False
            
            if not amount:
                logging.error("❌ DEBUG: No amount found in webhook data")
                return False
            
            # Only process incoming transfers (SePay uses "in" for incoming transfers)
            if transfer_type != 'in':
                logging.warning(f"⚠️ DEBUG: Skipping non-incoming transfer: {transfer_type}")
                return False
            
            # Find payment record by reference (content field)
            payment = self.find_payment_by_reference(payment_reference)
            if not payment:
                logging.error(f"❌ DEBUG: Payment record not found for reference: {payment_reference}")
                logging.error("❌ DEBUG: This usually means the payment was never created or the reference doesn't match")
                
                # Let's log all existing payments for debugging
                all_payments = Payment.query.limit(10).all()
                logging.info(f"🔍 DEBUG: Recent payments in database: {[p.notes for p in all_payments if p.notes]}")
                
                return False
            
            logging.info(f"✅ DEBUG: Found payment record: ID={payment.id}, Status={payment.payment_status}, Notes={payment.notes}")
            
            # Check if payment already processed
            if payment.payment_status == 'completed':
                logging.warning(f"⚠️ DEBUG: Payment already processed: {payment_reference}")
                return True  # Return True since payment was already processed
            
            # Check if payment has expired
            if payment.expires_at and datetime.now(timezone.utc) > payment.expires_at:
                logging.error(f"❌ DEBUG: Payment expired: {payment_reference}")
                return False
            
            # Update payment with transaction details
            logging.info(f"🔍 DEBUG: Updating payment with transaction details")
            payment.momo_trans_id = str(transaction_id)
            payment.momo_order_id = reference_code
            payment.payment_status = 'completed'
            payment.paid_at = datetime.now(timezone.utc)
            payment.callback_data = webhook_data
            
            # Save payment changes first
            db.session.commit()
            logging.info(f"✅ DEBUG: Payment updated successfully: {payment_reference}")
            
            # Create subscription
            logging.info(f"🔍 DEBUG: Creating subscription")
            subscription = self.create_subscription(
                payment.user_id, 
                payment.tier.slug, 
                payment_reference
            )
            
            if subscription:
                logging.info(f"✅ DEBUG: Successfully processed payment for reference {payment_reference}")
                
                # Get updated user subscription data for real-time updates
                try:
                    from yuuzone.users.models import User
                    user = User.query.get(payment.user_id)
                    if user:
                        # Get user's current subscription types
                        user_subscription_types = []
                        for user_sub in user.subscriptions:
                            if user_sub.is_active:
                                user_subscription_types.append(user_sub.tier.slug)
                        
                        logging.info(f"🔍 DEBUG: User {user.id} subscription types after payment: {user_subscription_types}")
                        
                        # Emit payment completion event for frontend redirect (like coin payments)
                        try:
                            logging.info(f"🔍 DEBUG: Emitting payment completion event")
                            from yuuzone import socketio
                            if socketio:
                                event_data = {
                                    'user_id': payment.user_id,
                                    'payment_reference': payment_reference,
                                    'payment_type': 'subscription',
                                    'amount': float(payment.amount) if payment.amount else 0,
                                    'tier_name': payment.tier.name,
                                    'tier_slug': payment.tier.slug,
                                    'user_subscription_types': user_subscription_types  # Include updated tier info
                                }
                                logging.info(f"🔍 DEBUG: Event data: {event_data}")
                                
                                # Emit only ONE event to specific user room to prevent spam
                                socketio.emit('payment_completed', event_data, room=f'user_{payment.user_id}')
                                logging.info(f"✅ DEBUG: Payment completion event emitted to room user_{payment.user_id}")
                                
                            else:
                                logging.warning("⚠️ DEBUG: SocketIO not available for payment completion event")
                        except Exception as socket_error:
                            logging.error(f"❌ DEBUG: Error emitting payment completion event: {socket_error}")
                            # Try alternative emission method
                            try:
                                logging.info(f"🔍 DEBUG: Trying alternative socket emission method")
                                from yuuzone.socketio_app_optimized import socketio as alt_socketio
                                if alt_socketio:
                                    event_data = {
                                        'user_id': payment.user_id,
                                        'payment_reference': payment_reference,
                                        'payment_type': 'subscription',
                                        'amount': float(payment.amount) if payment.amount else 0,
                                        'tier_name': payment.tier.name,
                                        'tier_slug': payment.tier.slug,
                                        'user_subscription_types': user_subscription_types
                                    }
                                    alt_socketio.emit('payment_completed', event_data, room=f'user_{payment.user_id}')
                                    logging.info(f"✅ DEBUG: Alternative payment completion event emitted for user {payment.user_id}")
                            except Exception as alt_socket_error:
                                logging.error(f"❌ DEBUG: Alternative socket emission also failed: {alt_socket_error}")
                    
                    # Also emit a global event for any listening components
                    try:
                        logging.info(f"🔍 DEBUG: Emitting global payment completion event")
                        from yuuzone import socketio
                        if socketio:
                            event_data = {
                                'user_id': payment.user_id,
                                'payment_reference': payment_reference,
                                'payment_type': 'subscription',
                                'amount': float(payment.amount) if payment.amount else 0,
                                'tier_name': payment.tier.name,
                                'tier_slug': payment.tier.slug,
                                'user_subscription_types': user_subscription_types
                            }
                            # Only emit to user room, not globally to prevent spam
                            socketio.emit('payment_completed', event_data, room=f'user_{payment.user_id}')
                            logging.info(f"✅ DEBUG: Payment completion event emitted to user room only")
                    except Exception as global_socket_error:
                        logging.error(f"❌ DEBUG: Error emitting global payment completion event: {global_socket_error}")
                    
                except Exception as user_error:
                    logging.error(f"❌ DEBUG: Error getting user subscription data: {user_error}")
                
                return True
            else:
                logging.error(f"❌ DEBUG: Failed to create subscription for payment reference {payment_reference}")
                return False
                
        except Exception as e:
            logging.error(f"❌ DEBUG: Error processing SePay payment: {e}")
            import traceback
            logging.error(f"❌ DEBUG: Full traceback: {traceback.format_exc()}")
            db.session.rollback()
            return False

    def _capture_webhook_structure(self, webhook_data):
        """Capture and log webhook data structure for debugging"""
        logging.info("=== WEBHOOK DATA STRUCTURE ANALYSIS ===")
        logging.info(f"All fields: {list(webhook_data.keys())}")
        
        for key, value in webhook_data.items():
            logging.info(f"  {key}: {value} (type: {type(value).__name__})")
            if isinstance(value, dict):
                logging.info(f"    Nested: {json.dumps(value, indent=4)}")

    def _extract_payment_reference(self, webhook_data):
        """Extract payment reference from SePay webhook data"""
        import re
        
        # Try multiple possible field names for payment reference
        possible_fields = ['content', 'description', 'des', 'message', 'note', 'memo', 'comment']
        
        for field in possible_fields:
            if field in webhook_data:
                value = webhook_data[field]
                if value and isinstance(value, str) and value.strip():
                    logging.info(f"Found potential reference in '{field}': {value}")
                    
                    # Try to extract clean TKPINC reference from this field
                    extracted_ref = self._extract_tkpinc_from_text(value.strip())
                    if extracted_ref:
                        logging.info(f"✅ Extracted clean reference: {extracted_ref}")
                        return extracted_ref
                    
                    # If no clean extraction, return the original value as fallback
                    logging.info(f"Using original value as fallback: {value.strip()}")
                    return value.strip()
        
        # If no direct field found, try to extract from any string field
        for key, value in webhook_data.items():
            if isinstance(value, str) and value.strip():
                # Look for TKPINC pattern in any string field
                if 'TKPINC' in value.upper():
                    logging.info(f"Found TKPINC reference in '{key}': {value}")
                    
                    # Try to extract clean TKPINC reference from this field
                    extracted_ref = self._extract_tkpinc_from_text(value.strip())
                    if extracted_ref:
                        logging.info(f"✅ Extracted clean reference: {extracted_ref}")
                        return extracted_ref
                    
                    # If no clean extraction, return the original value as fallback
                    logging.info(f"Using original value as fallback: {value.strip()}")
                    return value.strip()
        
        logging.warning(f"No payment reference found in webhook data. Available fields: {list(webhook_data.keys())}")
        logging.warning(f"Webhook data content: {webhook_data}")
        return None

    def _extract_tkpinc_from_text(self, text):
        """
        Extract clean TKPINC reference from messy bank text
        Examples:
        - "TKPINC Y5P8B1D1" -> "TKPINC Y5P8B1D1"
        - "MBVCB.10573454090.5228BFTVG2QF7UWQ.TKPINC Y5P8B1D1.CT tu 1026708125..." -> "TKPINC Y5P8B1D1"
        - "Payment for TKPINC Y5P8B1D1 subscription" -> "TKPINC Y5P8B1D1"
        """
        import re
        
        if not text or not isinstance(text, str):
            return None
        
        # Pattern 1: Exact TKPINC format (TKPINC + space + 8 alphanumeric characters)
        # This handles: TKPINC Y5P8B1D1, TKPINC ABC12345, etc.
        pattern1 = r'TKPINC\s+[A-Z0-9]{8}'
        match1 = re.search(pattern1, text.upper())
        if match1:
            return match1.group().strip()
        
        # Pattern 2: TKPINC with any characters after it (more flexible)
        # This handles: TKPINC Y5P8B1D1.CT, TKPINC Y5P8B1D1, etc.
        pattern2 = r'TKPINC\s+[A-Z0-9]{8}[^A-Z0-9]*'
        match2 = re.search(pattern2, text.upper())
        if match2:
            # Extract just the TKPINC + 8 characters part
            full_match = match2.group()
            clean_ref = re.search(r'TKPINC\s+[A-Z0-9]{8}', full_match)
            if clean_ref:
                return clean_ref.group().strip()
        
        # Pattern 3: TKPINC with variable length alphanumeric (most flexible)
        # This handles: TKPINC Y5P8B1D1, TKPINC ABC123, etc.
        pattern3 = r'TKPINC\s+[A-Z0-9]+'
        match3 = re.search(pattern3, text.upper())
        if match3:
            return match3.group().strip()
        
        # If no pattern matches, return None
        logging.warning(f"Could not extract TKPINC reference from text: {text}")
        return None

    def _extract_amount(self, webhook_data):
        """Extract amount from SePay webhook data"""
        # According to SePay docs: transferAmount field contains the amount
        if 'transferAmount' in webhook_data:
            value = webhook_data['transferAmount']
            logging.info(f"Found amount in 'transferAmount': {value}")
            return value
        logging.warning("No 'transferAmount' field found in webhook data")
        return None

    def _extract_transfer_type(self, webhook_data):
        """Extract transfer type from SePay webhook data"""
        # According to SePay docs: transferType field contains the transfer type
        if 'transferType' in webhook_data:
            value = webhook_data['transferType']
            logging.info(f"Found transfer type in 'transferType': {value}")
            return value
        logging.warning("No 'transferType' field found in webhook data")
        return None

    def _extract_transaction_id(self, webhook_data):
        """Extract transaction ID from SePay webhook data"""
        # According to SePay docs: id field contains the transaction ID
        if 'id' in webhook_data:
            value = webhook_data['id']
            logging.info(f"Found transaction ID in 'id': {value}")
            return value
        logging.warning("No 'id' field found in webhook data")
        return None

    def _extract_reference_code(self, webhook_data):
        """Extract reference code from SePay webhook data"""
        # According to SePay docs: referenceCode field contains the reference code
        if 'referenceCode' in webhook_data:
            value = webhook_data['referenceCode']
            logging.info(f"Found reference code in 'referenceCode': {value}")
            return value
        logging.warning("No 'referenceCode' field found in webhook data")
        return None

    def get_user_subscriptions(self, user_id):
        """Get all active subscriptions for a user"""
        try:
            # Use timezone-aware datetime
            from datetime import timezone
            current_time = datetime.now(timezone.utc)
            
            subscriptions = UserSubscription.query.filter_by(
                user_id=user_id,
                is_active=True
            ).filter(
                UserSubscription.expires_at > current_time
            ).all()
            
            return [sub.as_dict() for sub in subscriptions]
        except Exception as e:
            logging.error(f"Error getting user subscriptions: {e}")
            return []

    def get_user_subscription_types(self, user_id):
        """Get list of active subscription types for a user"""
        try:
            subscriptions = self.get_user_subscriptions(user_id)
            return [sub['tier_slug'] for sub in subscriptions if sub['tier_slug']]
        except Exception as e:
            logging.error(f"Error getting user subscription types: {e}")
            return []

    def has_subscription(self, user_id, tier_slug):
        """Check if user has active subscription of specific type"""
        try:
            # Use timezone-aware datetime
            from datetime import timezone
            current_time = datetime.now(timezone.utc)
            
            subscription = UserSubscription.query.join(UserTier).filter(
                UserSubscription.user_id == user_id,
                UserSubscription.is_active == True,
                UserSubscription.expires_at > current_time,
                UserTier.slug == tier_slug
            ).first()
            
            return subscription is not None
        except Exception as e:
            logging.error(f"Error checking subscription: {e}")
            return False

    def get_user_limits(self, user_id):
        """Get user's current limits based on their subscriptions"""
        try:
            subscription_types = self.get_user_subscription_types(user_id)
            
            # Start with default limits
            limits = self.default_limits.copy()
            
            # Apply subscription benefits
            for tier_slug in subscription_types:
                tier = UserTier.query.filter_by(slug=tier_slug).first()
                if tier and tier.features:
                    features = tier.features
                    
                    # Update limits based on tier features
                    if 'max_subthreads' in features:
                        subthread_limit = features['max_subthreads']
                        if subthread_limit == -1 or limits['subthread_limit'] < subthread_limit:
                            limits['subthread_limit'] = subthread_limit
                    
                    if 'theme_slots' in features:
                        theme_slots = features['theme_slots']
                        if theme_slots > limits['theme_slots']:
                            limits['theme_slots'] = theme_slots
                    
                    if 'upload_limit' in features:
                        upload_limit = features['upload_limit']
                        if upload_limit == -1 or limits['upload_limit'] < upload_limit:
                            limits['upload_limit'] = upload_limit
                    
                    if 'translation_limit' in features:
                        translation_limit = features['translation_limit']
                        if translation_limit == -1 or limits['translation_limit'] < translation_limit:
                            limits['translation_limit'] = translation_limit
            
            return limits
        except Exception as e:
            logging.error(f"Error getting user limits: {e}")
            return self.default_limits.copy()

    def can_create_subthread(self, user_id):
        """Check if user can create more subthreads"""
        try:
            from yuuzone.subthreads.models import Subthreads
            
            limits = self.get_user_limits(user_id)
            if limits['subthread_limit'] == -1:  # Unlimited
                return True
            
            # Count user's subthreads
            subthread_count = Subthreads.query.filter_by(created_by=user_id).count()
            return subthread_count < limits['subthread_limit']
        except Exception as e:
            logging.error(f"Error checking subthread creation: {e}")
            return False

    def can_upload_file(self, user_id, file_size):
        """Check if user can upload file of given size"""
        try:
            limits = self.get_user_limits(user_id)
            if limits['upload_limit'] == -1:  # Unlimited
                return True
            
            return file_size <= limits['upload_limit']
        except Exception as e:
            logging.error(f"Error checking file upload: {e}")
            return False

    def get_theme_slots_available(self, user_id):
        """Get number of theme slots available for user"""
        try:
            limits = self.get_user_limits(user_id)
            total_slots = limits.get('theme_slots', 0)
            
            if total_slots == 0:
                return 0
            
            # Count user's existing themes
            theme_count = UserCustomTheme.query.filter_by(user_id=user_id).count()
            available_slots = max(0, total_slots - theme_count)
            
            logging.info(f"User {user_id} theme slots: total={total_slots}, used={theme_count}, available={available_slots}")
            return available_slots
        except Exception as e:
            logging.error(f"Error getting theme slots: {e}")
            return 0

    def get_subscription_plans(self):
        """Get all available subscription plans"""
        try:
            tiers = UserTier.query.all()
            plans = {}
            for tier in tiers:
                plans[tier.slug] = {
                    'name': tier.name,
                    'price': float(tier.price_monthly) if tier.price_monthly else 0,
                    'description': tier.description,
                    'features': tier.features or {}
                }
            return plans
        except Exception as e:
            logging.error(f"Error getting subscription plans: {e}")
            return {}

    def generate_payment_qr(self, username, tier_slug):
        """Generate SePay QR code URL using the same format as coin payments"""
        try:
            tier = UserTier.query.filter_by(slug=tier_slug).first()
            if not tier:
                raise ValueError(f"Invalid tier: {tier_slug}")
            
            amount = int(float(tier.price_monthly)) if tier.price_monthly else 0
            
            # Generate new payment reference format: TKPINC [RANDOM ID]
            payment_reference = self.generate_payment_reference(username, tier_slug)
            
            # Create pending payment record for tracking (same as coin payments)
            from yuuzone.users.models import User
            user = User.query.filter_by(username=username).first()
            if not user:
                raise ValueError(f"User not found: {username}")
            
            pending_payment = self.create_pending_payment(user.id, tier_slug, payment_reference)
            if not pending_payment:
                raise ValueError("Failed to create pending payment record")
            
            # Generate QR URL using the exact same format as coin payments
            qr_url = f"https://qr.sepay.vn/img?acc=94120903912&bank=TPBank&amount={amount}&des={payment_reference}"
            
            # Return the exact same format as coin payments
            result = {
                'qr_url': qr_url,
                'amount': amount,
                'description': payment_reference,
                'package_name': tier.name,  # Use package_name like coin payments
                'payment_reference': payment_reference,
                'expires_at': pending_payment.expires_at.isoformat() if pending_payment.expires_at else None
            }
            
            return result
        except Exception as e:
            logging.error(f"Error generating payment QR: {e}")
            return None

    def can_purchase_tier(self, user_id, tier_slug):
        """Check if user can purchase a specific tier (not already owned)"""
        try:
            # Check if user already has an active subscription of this type
            if self.has_subscription(user_id, tier_slug):
                return False, "User already has an active subscription of this type"
            
            # Check if tier exists
            tier = UserTier.query.filter_by(slug=tier_slug).first()
            if not tier:
                return False, "Invalid tier"
            
            return True, "Can purchase"
            
        except Exception as e:
            logging.error(f"Error checking if user can purchase tier: {e}")
            return False, "Error checking purchase eligibility"

    def get_user_current_tier(self, user_id):
        """Get user's current highest tier"""
        try:
            subscriptions = self.get_user_subscriptions(user_id)
            if not subscriptions:
                return 'free'
            
            # Return the highest tier (VIP > Support > Free)
            tier_order = {'vip': 3, 'support': 2, 'free': 1}
            highest_tier = 'free'
            highest_value = 1
            
            for sub in subscriptions:
                tier_slug = sub.get('tier_slug')
                if tier_slug and tier_order.get(tier_slug, 0) > highest_value:
                    highest_tier = tier_slug
                    highest_value = tier_order.get(tier_slug, 0)
            
            return highest_tier
            
        except Exception as e:
            logging.error(f"Error getting user current tier: {e}")
            return 'free'

    def get_user_subscription_data(self, user_id):
        """Get all user subscription data in a single optimized call"""
        try:
            # Get all data in parallel using a single database session
            from datetime import timezone
            current_time = datetime.now(timezone.utc)
            
            # Get active subscriptions with tier info in one query
            subscriptions = db.session.query(UserSubscription, UserTier).join(
                UserTier, UserSubscription.tier_id == UserTier.id
            ).filter(
                UserSubscription.user_id == user_id,
                UserSubscription.is_active == True,
                UserSubscription.expires_at > current_time
            ).all()
            
            # Process subscriptions
            subscription_list = []
            subscription_types = []
            tier_order = {'vip': 3, 'support': 2, 'free': 1}
            highest_tier = 'free'
            highest_value = 1
            
            for sub, tier in subscriptions:
                sub_dict = sub.as_dict()
                sub_dict['tier_name'] = tier.name
                sub_dict['tier_slug'] = tier.slug
                subscription_list.append(sub_dict)
                subscription_types.append(tier.slug)
                
                # Track highest tier
                if tier_order.get(tier.slug, 0) > highest_value:
                    highest_tier = tier.slug
                    highest_value = tier_order.get(tier.slug, 0)
            
            # Get user limits
            limits = self.get_user_limits(user_id)
            
            # Get theme slots
            theme_slots = self.get_theme_slots_available(user_id)
            
            # Check purchase eligibility
            purchase_eligibility = {}
            for tier_slug in ['support', 'vip']:
                can_purchase, message = self.can_purchase_tier(user_id, tier_slug)
                purchase_eligibility[tier_slug] = {
                    'can_purchase': can_purchase,
                    'message': message
                }
            
            return {
                'current_tier': highest_tier,
                'subscriptions': subscription_list,
                'user_subscription_types': subscription_types,
                'limits': limits,
                'theme_slots': {
                    'available_slots': theme_slots,
                    'total_slots': limits.get('theme_slots', 0),
                    'used_slots': max(0, limits.get('theme_slots', 0) - theme_slots)
                },
                'purchase_eligibility': purchase_eligibility
            }
            
        except Exception as e:
            logging.error(f"Error getting user subscription data: {e}")
            return {
                'current_tier': 'free',
                'subscriptions': [],
                'user_subscription_types': [],
                'limits': self.default_limits.copy(),
                'theme_slots': {
                    'available_slots': 0,
                    'total_slots': 0,
                    'used_slots': 0
                },
                'purchase_eligibility': {}
            } 

    def generate_coin_payment_qr(self, username, payment_id):
        """Generate SePay QR code URL for coin payment"""
        try:
            from yuuzone.coins.models import CoinPayment
            payment = CoinPayment.query.get(payment_id)
            if not payment:
                raise ValueError(f"Coin payment not found: {payment_id}")
            
            amount = int(float(payment.amount_vnd)) if payment.amount_vnd else 0
            
            # Generate payment reference format: TKPINC [RANDOM ID] (same as tier payments)
            payment_reference = self.generate_payment_reference(username, "coin")
            
            # Update payment with reference - ensure consistent format
            payment.notes = f"Payment reference: {payment_reference}"
            db.session.commit()
            
            logging.info(f"Generated coin payment QR - payment_id: {payment_id}, reference: {payment_reference}, amount: {amount}")
            
            # Generate QR URL
            qr_url = f"https://qr.sepay.vn/img?acc=94120903912&bank=TPBank&amount={amount}&des={payment_reference}"
            
            return {
                'qr_url': qr_url,
                'amount': amount,
                'description': payment_reference,
                'package_name': payment.package.name if payment.package else 'Coin Package',
                'payment_reference': payment_reference,
                'expires_at': payment.expires_at.isoformat() if payment.expires_at else None
            }
        except Exception as e:
            logging.error(f"Error generating coin payment QR: {e}")
            return None

    def process_coin_payment_webhook(self, webhook_data):
        """Process SePay payment webhook for coin payments"""
        try:
            logging.info(f"🔍 DEBUG: Starting coin payment webhook processing")
            logging.info(f"🔍 DEBUG: Webhook data: {webhook_data}")
            
            # Extract payment information
            payment_reference = self._extract_payment_reference(webhook_data)
            amount = self._extract_amount(webhook_data)
            transfer_type = self._extract_transfer_type(webhook_data)
            transaction_id = self._extract_transaction_id(webhook_data)
            reference_code = self._extract_reference_code(webhook_data)
            
            logging.info(f"🔍 DEBUG: Extracted coin payment: reference={payment_reference}, amount={amount}, type={transfer_type}, id={transaction_id}")
            
            # Validate required fields - now accepts any reference format
            if not payment_reference:
                logging.error("❌ DEBUG: No payment reference found in webhook data")
                return False
            
            # Check if it's a TKPINC format reference
            is_tkpinc_format = payment_reference.startswith('TKPINC ')
            
            if not amount:
                logging.error("❌ DEBUG: No amount found in coin payment webhook")
                return False
            
            # Only process incoming transfers
            if transfer_type != 'in':
                logging.warning(f"⚠️ DEBUG: Skipping non-incoming coin transfer: {transfer_type}")
                return False
            
            # Find coin payment record by reference - improved search logic
            from yuuzone.coins.models import CoinPayment
            payment = None
            
            # Log all recent coin payments for debugging
            recent_payments = CoinPayment.query.order_by(CoinPayment.created_at.desc()).limit(10).all()
            logging.info(f"🔍 DEBUG: Recent coin payments: {[(p.id, p.notes, p.payment_status) for p in recent_payments if p.notes]}")
            
            # Try exact match first with "Payment reference: " prefix
            payment = CoinPayment.query.filter(
                CoinPayment.notes == f"Payment reference: {payment_reference}"
            ).first()
            
            if payment:
                logging.info(f"✅ DEBUG: Found coin payment with exact match: {payment.id}")
            else:
                logging.info(f"🔍 DEBUG: No exact match found, trying contains search")
                # Try contains search with the full payment reference
                payment = CoinPayment.query.filter(
                    CoinPayment.notes.contains(payment_reference)
                ).first()
                
                if payment:
                    logging.info(f"✅ DEBUG: Found coin payment with contains search: {payment.id}")
                else:
                    logging.info(f"🔍 DEBUG: No contains match found, trying TKPINC format")
                    # If it's a TKPINC format, try searching with just the random ID part
                    if is_tkpinc_format:
                        random_id = payment_reference.replace('TKPINC ', '')
                        payment = CoinPayment.query.filter(
                            CoinPayment.notes.contains(random_id)
                        ).first()
                        
                        if payment:
                            logging.info(f"✅ DEBUG: Found coin payment with random ID search: {payment.id}")
                    
                    # Last resort: try searching for any payment with this reference in notes
                    if not payment:
                        logging.info(f"🔍 DEBUG: Trying LIKE search")
                        payment = CoinPayment.query.filter(
                            CoinPayment.notes.like(f"%{payment_reference}%")
                        ).first()
                        
                        if payment:
                            logging.info(f"✅ DEBUG: Found coin payment with LIKE search: {payment.id}")
                    
                    # Final attempt: search for any payment with similar reference pattern
                    if not payment:
                        logging.info(f"🔍 DEBUG: Trying pattern search")
                        # Remove common prefixes/suffixes and search
                        clean_reference = payment_reference.replace('TKPINC ', '').replace(' ', '').strip()
                        if clean_reference:
                            payment = CoinPayment.query.filter(
                                CoinPayment.notes.like(f"%{clean_reference}%")
                            ).first()
                            
                            if payment:
                                logging.info(f"✅ DEBUG: Found coin payment with pattern search: {payment.id}")
            
            if not payment:
                logging.error(f"❌ DEBUG: Coin payment record not found for reference: {payment_reference}")
                logging.error(f"❌ DEBUG: Available payment references: {[p.notes for p in recent_payments if p.notes]}")
                return False
            
            logging.info(f"✅ DEBUG: Found payment record: ID={payment.id}, Status={payment.payment_status}, Notes={payment.notes}")
            
            # Check if payment already processed
            if payment.payment_status == 'completed':
                logging.warning(f"⚠️ DEBUG: Coin payment already processed: {payment_reference}")
                return True
            
            # Check if payment has expired
            if payment.expires_at and datetime.now(timezone.utc) > payment.expires_at:
                logging.warning(f"⚠️ DEBUG: Coin payment expired: {payment_reference}")
                logging.warning(f"⚠️ DEBUG: Payment created: {payment.created_at}")
                logging.warning(f"⚠️ DEBUG: Payment expired: {payment.expires_at}")
                logging.warning(f"⚠️ DEBUG: Current time: {datetime.now(timezone.utc)}")
                
                # For expired payments, we'll still process them if they have valid webhook data
                # This handles cases where SePay webhook was delayed
                if webhook_data and 'transferAmount' in webhook_data:
                    logging.info(f"✅ DEBUG: Processing expired payment with valid webhook data: {payment_reference}")
                else:
                    logging.error(f"❌ DEBUG: Payment expired and no valid webhook data: {payment_reference}")
                    return False
            
            # Update payment with transaction details
            logging.info(f"🔍 DEBUG: Updating payment with transaction details")
            payment.momo_trans_id = str(transaction_id)
            payment.momo_order_id = reference_code
            payment.payment_status = 'completed'
            payment.paid_at = datetime.now(timezone.utc)
            payment.callback_data = webhook_data
            
            # Save payment changes first
            db.session.commit()
            logging.info(f"✅ DEBUG: Coin payment updated successfully: {payment_reference}")
            
            # Process coin payment using coin service
            try:
                logging.info(f"🔍 DEBUG: Processing coin payment with coin service")
                from yuuzone.coins.service import CoinService
                coin_service = CoinService()
                
                # Get user's balance before processing
                old_balance = coin_service.get_wallet_balance(payment.user_id)
                logging.info(f"🔍 DEBUG: User {payment.user_id} balance before: {old_balance}")
                
                processed_payment = coin_service.process_coin_payment(payment.id)
                
                if processed_payment:
                    # Get user's balance after processing with a fresh query
                    from yuuzone.coins.models import UserWallet
                    actual_wallet = UserWallet.query.filter_by(user_id=payment.user_id).first()
                    new_balance = actual_wallet.coin_balance if actual_wallet else 0
                    
                    logging.info(f"✅ DEBUG: Coin payment processed successfully: {payment_reference}")
                    logging.info(f"✅ DEBUG: Coins added: {processed_payment.coin_amount}")
                    logging.info(f"✅ DEBUG: User {payment.user_id} balance after: {new_balance}")
                    logging.info(f"✅ DEBUG: Balance change: {new_balance - old_balance}")
                    
                    # Verify the balance actually changed
                    if new_balance <= old_balance:
                        logging.error(f"❌ ERROR: Balance did not increase! Old: {old_balance}, New: {new_balance}")
                        raise ValueError("Coin balance did not increase after payment processing")
                    
                    # Emit payment completion event for frontend redirect
                    try:
                        logging.info(f"🔍 DEBUG: Emitting payment completion event")
                        from yuuzone import socketio
                        if socketio:
                            event_data = {
                                'user_id': payment.user_id,
                                'payment_reference': payment_reference,
                                'payment_type': 'coin',
                                'amount': payment.coin_amount,
                                'new_balance': coin_service.get_wallet_balance(payment.user_id)
                            }
                            logging.info(f"🔍 DEBUG: Event data: {event_data}")
                            
                            # Emit to specific user room
                            socketio.emit('payment_completed', event_data, room=f'user_{payment.user_id}')
                            logging.info(f"✅ DEBUG: Payment completion event emitted to room user_{payment.user_id}")
                            
                        else:
                            logging.warning("⚠️ DEBUG: SocketIO not available for payment completion event")
                    except Exception as socket_error:
                        logging.error(f"❌ DEBUG: Error emitting payment completion event: {socket_error}")
                        # Try alternative emission method
                        try:
                            logging.info(f"🔍 DEBUG: Trying alternative socket emission method")
                            from yuuzone.socketio_app_optimized import socketio as alt_socketio
                            if alt_socketio:
                                alt_socketio.emit('payment_completed', {
                                    'user_id': payment.user_id,
                                    'payment_reference': payment_reference,
                                    'payment_type': 'coin',
                                    'amount': payment.coin_amount,
                                    'new_balance': coin_service.get_wallet_balance(payment.user_id)
                                }, room=f'user_{payment.user_id}')
                                logging.info(f"✅ DEBUG: Alternative payment completion event emitted for user {payment.user_id}")
                        except Exception as alt_socket_error:
                            logging.error(f"❌ DEBUG: Alternative socket emission also failed: {alt_socket_error}")
                    
                    # Also emit a global event for any listening components
                    try:
                        logging.info(f"🔍 DEBUG: Emitting global payment completion event")
                        from yuuzone import socketio
                        if socketio:
                            socketio.emit('payment_completed', {
                                'user_id': payment.user_id,
                                'payment_reference': payment_reference,
                                'payment_type': 'coin',
                                'amount': payment.coin_amount,
                                'new_balance': coin_service.get_wallet_balance(payment.user_id)
                            })  # No room specified - broadcast to all
                            logging.info(f"✅ DEBUG: Global payment completion event emitted")
                    except Exception as global_socket_error:
                        logging.error(f"❌ DEBUG: Error emitting global payment completion event: {global_socket_error}")
                    
                    return True
                else:
                    logging.error(f"❌ DEBUG: Failed to process coin payment: {payment_reference}")
                    return False
                    
            except Exception as coin_error:
                logging.error(f"❌ DEBUG: Error processing coin payment with coin service: {coin_error}")
                logging.error(f"❌ DEBUG: Full traceback: {traceback.format_exc()}")
                # Revert payment status if coin processing failed
                payment.payment_status = 'pending'
                db.session.commit()
                return False
            
        except Exception as e:
            logging.error(f"❌ DEBUG: Error processing coin payment webhook: {e}")
            traceback.print_exc()
            return False

    def create_subscription_from_coins(self, user_id, tier_slug, coin_cost):
        """Create subscription from coin purchase"""
        try:
            # Check if user already has an active subscription of this type
            if self.has_subscription(user_id, tier_slug):
                logging.warning(f"User {user_id} already has active {tier_slug} subscription")
                return None
            
            # Get tier information
            tier = UserTier.query.filter_by(slug=tier_slug).first()
            if not tier:
                logging.error(f"Invalid tier: {tier_slug}")
                return None
            
            # Use timezone-aware datetime
            current_time = datetime.now(timezone.utc)
            
            # Calculate expiration date (1 month from now)
            expires_at = current_time + timedelta(days=30)
            
            # Create subscription
            subscription = UserSubscription(
                user_id=user_id,
                tier_id=tier.id,
                payment_id=None,  # No payment record for coin purchases
                starts_at=current_time,
                expires_at=expires_at,
                is_active=True,
                auto_renew=False
            )
            
            db.session.add(subscription)
            db.session.commit()
            
            # Emit subscription purchase event via socket
            try:
                from yuuzone import socketio
                if socketio:
                    socketio.emit('subscription_purchased', {
                        'user_id': user_id,
                        'tier_name': tier.name,
                        'tier_slug': tier_slug,
                        'amount': coin_cost,
                        'currency': 'coins',
                        'payment_status': 'completed'
                    }, room=f'user_{user_id}')
                    
                    # Emit purchase history event
                    socketio.emit('new_purchase', {
                        'user_id': user_id,
                        'purchase_type': 'subscription',
                        'purchase_data': {
                            'id': f"sub_{subscription.id}",
                            'type': 'subscription',
                            'tier_name': tier.name,
                            'tier_slug': tier_slug,
                            'amount': coin_cost,
                            'currency': 'coins',
                            'payment_status': 'completed',
                            'payment_method': 'coins',
                            'created_at': subscription.created_at.isoformat() if subscription.created_at else None,
                            'description': f"Subscription to {tier.name} (purchased with coins)"
                        }
                    }, room=f'user_{user_id}')
            except Exception as e:
                logging.error(f"Error emitting subscription purchase event: {e}")
            
            logging.info(f"Created subscription from coins for user {user_id}, tier {tier_slug}")
            return subscription.as_dict()
            
        except Exception as e:
            logging.error(f"Error creating subscription from coins: {e}")
            db.session.rollback()
            return None 