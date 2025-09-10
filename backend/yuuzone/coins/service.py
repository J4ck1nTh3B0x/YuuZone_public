from yuuzone import db
from yuuzone.coins.models import UserWallet, CoinTransaction, CoinPackage, CoinPayment, AvatarItem, UserAvatar, PostBoost, AvatarCategory
from yuuzone.users.models import User
from yuuzone.posts.models import Posts as Post
from datetime import datetime, timedelta, timezone
import logging
import os
import hashlib
import hmac
import random
import string
import traceback
import json
from yuuzone.utils.email import send_email
from yuuzone.config import BOOST_DURATION_DAYS, DAILY_BOOST_LIMIT

# Import socketio for real-time updates - will be imported locally in functions
socketio = None

class CoinService:
    def __init__(self):
        self.boost_cost = 1200  # Cost to boost a post
        self.first_purchase_bonus = 300  # Bonus coins for first purchase
        self.debug_mode = os.environ.get('COIN_DEBUG_MODE', 'false').lower() == 'true'

    def get_or_create_wallet(self, user_id):
        """Get user wallet or create if doesn't exist"""
        wallet = UserWallet.query.filter_by(user_id=user_id).first()
        if not wallet:
            wallet = UserWallet(user_id=user_id, coin_balance=0)
            db.session.add(wallet)
            db.session.commit()
        return wallet

    def get_wallet_balance(self, user_id):
        """Get user's coin balance"""
        wallet = self.get_or_create_wallet(user_id)
        return wallet.coin_balance

    def add_coins(self, user_id, amount, transaction_type, reference_id=None, reference_type=None, description=None):
        """Add coins to user wallet and create transaction record"""
        try:
            logging.info(f"🔍 DEBUG: Starting add_coins - user_id={user_id}, amount={amount}, transaction_type={transaction_type}")
            
            wallet = self.get_or_create_wallet(user_id)
            logging.info(f"🔍 DEBUG: Found wallet - wallet_id={wallet.id}, current_balance={wallet.coin_balance}")
            
            old_balance = wallet.coin_balance
            new_balance = old_balance + amount
            
            # Update the wallet balance using direct SQL update to ensure it's saved
            from sqlalchemy import text
            update_stmt = text("UPDATE user_wallets SET coin_balance = :new_balance, updated_at = :updated_at WHERE user_id = :user_id")
            result = db.session.execute(update_stmt, {
                'new_balance': new_balance,
                'updated_at': datetime.now(timezone.utc),
                'user_id': user_id
            })
            
            logging.info(f"🔍 DEBUG: SQL update result - rows affected: {result.rowcount}")
            logging.info(f"🔍 DEBUG: Updated wallet balance - old_balance={old_balance}, new_balance={new_balance}")
            
            # Create transaction record
            transaction = CoinTransaction(
                user_id=user_id,
                transaction_type=transaction_type,
                amount=amount,
                balance_after=new_balance,
                reference_id=reference_id,
                reference_type=reference_type,
                description=description
            )
            
            logging.info(f"🔍 DEBUG: Created transaction record")
            
            # Add transaction to session
            db.session.add(transaction)
            
            # Commit the transaction to ensure changes are saved
            db.session.commit()
            
            # Refresh the wallet object to get the latest balance
            db.session.refresh(wallet)
            
            logging.info(f"✅ DEBUG: Successfully committed transaction - final_balance={wallet.coin_balance}")
            
            # Verify the balance was actually updated
            if wallet.coin_balance != new_balance:
                logging.error(f"❌ ERROR: Balance mismatch! Expected: {new_balance}, Actual: {wallet.coin_balance}")
                # Try to get the actual balance from the database
                actual_wallet = UserWallet.query.filter_by(user_id=user_id).first()
                if actual_wallet:
                    logging.error(f"❌ ACTUAL DATABASE BALANCE: {actual_wallet.coin_balance}")
                raise ValueError(f"Balance update failed - expected {new_balance}, got {wallet.coin_balance}")
            
            # Send email notification
            try:
                self._send_coin_notification(user_id, amount, transaction_type, wallet.coin_balance)
                logging.info(f"🔍 DEBUG: Email notification sent successfully")
            except Exception as email_error:
                logging.error(f"❌ Error sending email notification: {email_error}")
            
            # Emit real-time update via socket
            try:
                from yuuzone import socketio
                if socketio:
                    socketio.emit('coin_balance_updated', {
                        'new_balance': wallet.coin_balance,
                        'transaction_type': transaction_type,
                        'amount': amount
                    }, room=f'user_{user_id}')
                    logging.info(f"🔍 DEBUG: Real-time update emitted successfully")
            except Exception as socket_error:
                logging.error(f"Error emitting coin balance update: {socket_error}")
            
            return wallet.coin_balance
            
        except Exception as e:
            logging.error(f"❌ Error adding coins: {e}")
            logging.error(f"❌ Full traceback: {traceback.format_exc()}")
            db.session.rollback()
            raise

    def deduct_coins(self, user_id, amount, transaction_type, reference_id=None, reference_type=None, description=None):
        """Deduct coins from user wallet and create transaction record"""
        try:
            logging.info(f"🔍 DEBUG: Starting deduct_coins - user_id={user_id}, amount={amount}, transaction_type={transaction_type}")
            
            wallet = self.get_or_create_wallet(user_id)
            logging.info(f"🔍 DEBUG: Found wallet - wallet_id={wallet.id}, current_balance={wallet.coin_balance}")
            
            if wallet.coin_balance < amount:
                logging.error(f"❌ ERROR: Insufficient coin balance - current: {wallet.coin_balance}, required: {amount}")
                raise ValueError("Insufficient coin balance")
            
            old_balance = wallet.coin_balance
            new_balance = old_balance - amount
            
            # Update the wallet balance using a direct SQL update to ensure it's saved
            from sqlalchemy import text
            update_stmt = text("UPDATE user_wallets SET coin_balance = :new_balance, updated_at = :updated_at WHERE user_id = :user_id")
            result = db.session.execute(update_stmt, {
                'new_balance': new_balance,
                'updated_at': datetime.now(timezone.utc),
                'user_id': user_id
            })
            
            logging.info(f"🔍 DEBUG: SQL update result - rows affected: {result.rowcount}")
            logging.info(f"🔍 DEBUG: Updated wallet balance - old_balance={old_balance}, new_balance={new_balance}")
            
            # Create transaction record
            transaction = CoinTransaction(
                user_id=user_id,
                transaction_type=transaction_type,
                amount=-amount,  # Negative for deductions
                balance_after=new_balance,
                reference_id=reference_id,
                reference_type=reference_type,
                description=description
            )
            
            logging.info(f"🔍 DEBUG: Created transaction record")
            
            # Add transaction to session
            db.session.add(transaction)
            
            # Commit the transaction to ensure changes are saved
            db.session.commit()
            
            # Refresh the wallet object to get the latest balance
            db.session.refresh(wallet)
            
            logging.info(f"✅ DEBUG: Successfully committed transaction - final_balance={wallet.coin_balance}")
            
            # Verify the balance was actually updated
            if wallet.coin_balance != new_balance:
                logging.error(f"❌ ERROR: Balance mismatch! Expected: {new_balance}, Actual: {wallet.coin_balance}")
                # Try to get the actual balance from the database
                actual_wallet = UserWallet.query.filter_by(user_id=user_id).first()
                if actual_wallet:
                    logging.error(f"❌ ACTUAL DATABASE BALANCE: {actual_wallet.coin_balance}")
                raise ValueError(f"Balance update failed - expected {new_balance}, got {wallet.coin_balance}")
            
            # Send email notification
            try:
                self._send_coin_notification(user_id, -amount, transaction_type, wallet.coin_balance)
                logging.info(f"🔍 DEBUG: Email notification sent successfully")
            except Exception as email_error:
                logging.error(f"❌ Error sending email notification: {email_error}")
            
            # Emit real-time update via socket
            try:
                from yuuzone import socketio
                if socketio:
                    socketio.emit('coin_balance_updated', {
                        'new_balance': wallet.coin_balance,
                        'transaction_type': transaction_type,
                        'amount': -amount
                    }, room=f'user_{user_id}')
                    logging.info(f"🔍 DEBUG: Real-time update emitted successfully")
            except Exception as socket_error:
                logging.error(f"Error emitting coin balance update: {socket_error}")
            
            return wallet.coin_balance
            
        except Exception as e:
            logging.error(f"❌ Error deducting coins: {e}")
            logging.error(f"❌ Full traceback: {traceback.format_exc()}")
            db.session.rollback()
            raise

    def transfer_coins(self, from_user_id, to_user_id, amount, description=None):
        """Transfer coins between users (tip functionality)"""
        try:
            # Check if users exist
            from_user = User.query.get(from_user_id)
            to_user = User.query.get(to_user_id)
            
            if not from_user or not to_user:
                raise ValueError("User not found")
            
            # Check if users are blocked
            if self._are_users_blocked(from_user_id, to_user_id):
                raise ValueError("Cannot send coins to blocked user")
            
            # Deduct from sender
            self.deduct_coins(from_user_id, amount, 'tip_sent', to_user_id, 'user', 
                             f"Tip sent to {to_user.username}")
            
            # Add to receiver
            self.add_coins(to_user_id, amount, 'tip_received', from_user_id, 'user', 
                          f"Tip received from {from_user.username}")
            
            # Emit tip transaction event via socket
            try:
                from yuuzone import socketio
                if socketio:
                    # Get updated balances
                    sender_balance = self.get_wallet_balance(from_user_id)
                    recipient_balance = self.get_wallet_balance(to_user_id)
                    
                    socketio.emit('tip_transaction', {
                        'sender_id': from_user_id,
                        'recipient_id': to_user_id,
                        'sender_balance': sender_balance,
                        'recipient_balance': recipient_balance,
                        'tip_amount': amount,
                        'recipient_username': to_user.username
                    })
            except Exception as e:
                logging.error(f"Error emitting tip transaction: {e}")
            
            return True
            
        except Exception as e:
            logging.error(f"Error transferring coins: {e}")
            raise

    def purchase_coins(self, user_id, package_id):
        """Purchase coins using existing payment system"""
        try:
            if self.debug_mode:
                logging.info(f"🔍 DEBUG: Starting coin purchase for user_id={user_id}, package_id={package_id}")
            
            package = CoinPackage.query.get(package_id)
            if not package or not package.is_active:
                if self.debug_mode:
                    logging.error(f"❌ DEBUG: Invalid coin package - package_id={package_id}, exists={package is not None}, is_active={package.is_active if package else None}")
                raise ValueError("Invalid coin package")
            
            if self.debug_mode:
                logging.info(f"✅ DEBUG: Found valid package - {package.name}, price={package.price_vnd}, coins={package.coin_amount}")
            
            # Check if this is user's first purchase
            try:
                existing_payments = CoinPayment.query.filter_by(
                    user_id=user_id, 
                    payment_status='completed'
                ).count()
                if self.debug_mode:
                    logging.info(f"🔍 DEBUG: Existing completed payments for user {user_id}: {existing_payments}")
            except Exception as e:
                if self.debug_mode:
                    logging.error(f"❌ DEBUG: Error checking existing payments: {e}")
                existing_payments = 0
            
            is_first_purchase = existing_payments == 0
            if self.debug_mode:
                logging.info(f"🔍 DEBUG: Is first purchase: {is_first_purchase}")
            
            # Create payment record
            try:
                payment = CoinPayment(
                    user_id=user_id,
                    package_id=package_id,
                    amount_vnd=package.price_vnd,
                    coin_amount=package.coin_amount,
                    is_first_purchase=is_first_purchase,
                    payment_method='bank',
                    expires_at=datetime.now(timezone.utc) + timedelta(minutes=5)
                )
                
                if self.debug_mode:
                    logging.info(f"🔍 DEBUG: Created payment object - id={payment.id if hasattr(payment, 'id') else 'N/A'}")
                
                db.session.add(payment)
                db.session.commit()
                
                if self.debug_mode:
                    logging.info(f"✅ DEBUG: Payment created successfully - payment_id={payment.id}")
                return payment
                
            except Exception as e:
                if self.debug_mode:
                    logging.error(f"❌ DEBUG: Error creating payment record: {e}")
                    logging.error(f"❌ DEBUG: Payment object details - user_id={user_id}, package_id={package_id}, amount_vnd={package.price_vnd}, coin_amount={package.coin_amount}")
                raise
            
        except Exception as e:
            if self.debug_mode:
                logging.error(f"❌ DEBUG: Error creating coin purchase: {e}")
                logging.error(f"❌ DEBUG: Full traceback: {traceback.format_exc()}")
            else:
                logging.error(f"Error creating coin purchase: {e}")
            db.session.rollback()
            raise

    def process_coin_payment(self, payment_id):
        """Process completed coin payment"""
        try:
            if self.debug_mode:
                logging.info(f"🔍 DEBUG: Processing coin payment - payment_id={payment_id}")
            
            payment = CoinPayment.query.get(payment_id)
            if not payment:
                if self.debug_mode:
                    logging.error(f"❌ DEBUG: Payment not found - payment_id={payment_id}")
                raise ValueError("Payment not found")
            
            # Check if coins were already added by looking for a transaction record
            existing_transaction = CoinTransaction.query.filter_by(
                user_id=payment.user_id,
                reference_id=payment.id,
                reference_type='coin_payment',
                transaction_type='purchase'
            ).first()
            
            if existing_transaction:
                if self.debug_mode:
                    logging.info(f"✅ DEBUG: Payment already processed - transaction found: {existing_transaction.id}")
                return payment  # Already processed
            
            # Add coins to user wallet
            coin_amount = payment.coin_amount
            
            # Add bonus for first purchase
            if payment.is_first_purchase:
                coin_amount += self.first_purchase_bonus
                if self.debug_mode:
                    logging.info(f"🔍 DEBUG: First purchase bonus added - bonus={self.first_purchase_bonus}")
            
            if self.debug_mode:
                logging.info(f"🔍 DEBUG: Adding {coin_amount} coins to user {payment.user_id}")
            
            # Ensure wallet exists and add coins
            try:
                self.add_coins(
                    payment.user_id, 
                    coin_amount, 
                    'purchase', 
                    payment.id, 
                    'coin_payment',
                    f"Coin purchase: {payment.package.name if payment.package else 'Coin Package'}"
                )
            except Exception as add_coins_error:
                logging.error(f"❌ Error adding coins to wallet: {add_coins_error}")
                raise
            
            # Update payment status
            payment.payment_status = 'completed'
            payment.paid_at = datetime.now(timezone.utc)
            db.session.commit()
            
            # Force a fresh balance check after commit
            db.session.expire_all()
            
            if self.debug_mode:
                logging.info(f"✅ DEBUG: Payment processed successfully - payment_id={payment_id}, coins_added={coin_amount}")
            
            # Send email notification
            try:
                self._send_purchase_notification(payment)
            except Exception as email_error:
                logging.error(f"❌ Error sending email notification: {email_error}")
                # Don't fail the entire process if email fails
            
            # Emit purchase completion event via socket
            try:
                from yuuzone import socketio
                if socketio:
                    socketio.emit('coin_purchase_complete', {
                        'user_id': payment.user_id,
                        'new_balance': self.get_wallet_balance(payment.user_id),
                        'package_name': payment.package.name if payment.package else 'Coin Package',
                        'coin_amount': coin_amount
                    }, room=f'user_{payment.user_id}')
                    
                    # Emit purchase history event
                    socketio.emit('new_purchase', {
                        'user_id': payment.user_id,
                        'purchase_type': 'coin_purchase',
                        'purchase_data': {
                            'id': f"coin_{payment.id}",
                            'type': 'coin_purchase',
                            'package_name': payment.package.name if payment.package else 'Coin Package',
                            'coin_amount': payment.coin_amount,
                            'amount': payment.amount_vnd,
                            'currency': payment.currency,
                            'payment_status': payment.payment_status,
                            'payment_method': payment.payment_method,
                            'created_at': payment.created_at.isoformat() if payment.created_at else None,
                            'paid_at': payment.paid_at.isoformat() if payment.paid_at else None,
                            'description': f"Purchased {payment.coin_amount} coins"
                        }
                    }, room=f'user_{payment.user_id}')
            except Exception as e:
                if self.debug_mode:
                    logging.error(f"❌ DEBUG: Error emitting coin purchase completion: {e}")
                else:
                    logging.error(f"Error emitting coin purchase completion: {e}")
            
            return payment
            
        except Exception as e:
            if self.debug_mode:
                logging.error(f"❌ DEBUG: Error processing coin payment: {e}")
                logging.error(f"❌ DEBUG: Full traceback: {traceback.format_exc()}")
            else:
                logging.error(f"Error processing coin payment: {e}")
            db.session.rollback()
            raise

    def purchase_avatar(self, user_id, avatar_id):
        """Purchase avatar with coins"""
        try:
            avatar = AvatarItem.query.get(avatar_id)
            if not avatar or not avatar.is_active:
                raise ValueError("Invalid avatar")
            
            # Check if user already owns this avatar
            existing_ownership = UserAvatar.query.filter_by(
                user_id=user_id, 
                avatar_id=avatar_id
            ).first()
            
            if existing_ownership:
                raise ValueError("Already own this avatar")
            
            # Deduct coins
            self.deduct_coins(
                user_id, 
                avatar.price_coins, 
                'avatar_purchase', 
                avatar_id, 
                'avatar',
                f"Purchased avatar: {avatar.name}"
            )
            
            # Add to user's owned avatars
            user_avatar = UserAvatar(
                user_id=user_id,
                avatar_id=avatar_id,
                is_equipped=False
            )
            
            db.session.add(user_avatar)
            db.session.commit()
            
            # Emit avatar purchase event via socket
            try:
                from yuuzone import socketio
                if socketio:
                    socketio.emit('avatar_purchased', {
                        'user_id': user_id,
                        'new_balance': self.get_wallet_balance(user_id),
                        'avatar_name': avatar.name,
                        'cost': avatar.price_coins
                    }, room=f'user_{user_id}')
                    
                    # Emit purchase history event
                    socketio.emit('new_purchase', {
                        'user_id': user_id,
                        'purchase_type': 'avatar_purchase',
                        'purchase_data': {
                            'id': f"avatar_{user_avatar.id}",
                            'type': 'avatar_purchase',
                            'avatar_name': avatar.name,
                            'avatar_image': avatar.image_url,
                            'price_coins': avatar.price_coins,
                            'created_at': user_avatar.purchased_at.isoformat() if user_avatar.purchased_at else None,
                            'description': f"Purchased avatar: {avatar.name}"
                        }
                    }, room=f'user_{user_id}')
            except Exception as e:
                logging.error(f"Error emitting avatar purchase: {e}")
            
            return user_avatar
            
        except Exception as e:
            logging.error(f"Error purchasing avatar: {e}")
            db.session.rollback()
            raise

    def equip_avatar(self, user_id, avatar_id):
        """Equip an owned avatar"""
        try:
            # Check if user owns this avatar
            user_avatar = UserAvatar.query.filter_by(
                user_id=user_id, 
                avatar_id=avatar_id
            ).first()
            
            if not user_avatar:
                raise ValueError("Avatar not owned")
            
            # Unequip all other avatars
            UserAvatar.query.filter_by(user_id=user_id).update({'is_equipped': False})
            
            # Equip this avatar
            user_avatar.is_equipped = True
            db.session.commit()
            
            return user_avatar
            
        except Exception as e:
            logging.error(f"Error equipping avatar: {e}")
            db.session.rollback()
            raise

    def boost_post(self, user_id, post_id):
        """Boost a post for 1200 coins"""
        try:
            # Check if post exists
            post = Post.query.get(post_id)
            if not post:
                raise ValueError("Post not found")
            
            # Check if user is the post creator
            if post.user_id != user_id:
                raise ValueError("Only the post creator can boost their own post")
            
            # Check if post is already boosted
            now = datetime.now(timezone.utc)
            existing_boost = PostBoost.query.filter_by(
                post_id=post_id, 
                is_active=True
            ).filter(PostBoost.boost_end > now).first()
            
            if existing_boost:
                raise ValueError("Post is already boosted")
            
            # Check daily boost limit (5 boosts per day)
            today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
            today_boosts = PostBoost.query.filter(
                PostBoost.user_id == user_id,
                PostBoost.created_at >= today_start
            ).count()
            
            if today_boosts >= DAILY_BOOST_LIMIT:
                raise ValueError(f"Daily boost limit reached. You can boost up to {DAILY_BOOST_LIMIT} posts per day.")
            
            # Check for recent boost attempts (cooldown period)
            recent_boost = PostBoost.query.filter_by(
                post_id=post_id,
                user_id=user_id
            ).filter(PostBoost.created_at > now - timedelta(minutes=1)).first()
            
            if recent_boost:
                raise ValueError("Please wait at least 1 minute before attempting to boost this post again")
            
            # Check user's coin balance before attempting to deduct
            wallet = self.get_or_create_wallet(user_id)
            if wallet.coin_balance < self.boost_cost:
                raise ValueError(f"Insufficient coin balance. You need {self.boost_cost} coins but only have {wallet.coin_balance} coins.")
            
            # Deduct coins
            self.deduct_coins(
                user_id, 
                self.boost_cost, 
                'post_boost', 
                post_id, 
                'post',
                f"Boosted post: {post.title[:50]}..."
            )
            
            # Create boost record
            boost = PostBoost(
                post_id=post_id,
                user_id=user_id,
                boost_end=datetime.now(timezone.utc) + timedelta(days=BOOST_DURATION_DAYS)
            )
            
            db.session.add(boost)
            db.session.commit()
            
            # Emit post boost event via socket
            try:
                from yuuzone import socketio
                if socketio:
                    socketio.emit('post_boosted', {
                        'user_id': user_id,
                        'post_id': post_id,  # Add post_id for frontend to update post data
                        'new_balance': self.get_wallet_balance(user_id),
                        'post_title': post.title,
                        'cost': self.boost_cost,
                        'daily_boosts_remaining': DAILY_BOOST_LIMIT - today_boosts  # Show remaining boosts
                    }, room=f'user_{user_id}')
                    
                    # Emit purchase history event
                    socketio.emit('new_purchase', {
                        'user_id': user_id,
                        'purchase_type': 'post_boost',
                        'purchase_data': {
                            'id': f"boost_{boost.id}",
                            'type': 'post_boost',
                            'post_id': post_id,
                            'amount': -self.boost_cost,
                            'created_at': boost.created_at.isoformat() if boost.created_at else None,
                            'description': f"Boosted post #{post_id}"
                        }
                    }, room=f'user_{user_id}')
            except Exception as e:
                logging.error(f"Error emitting post boost: {e}")
            
            return boost
            
        except Exception as e:
            logging.error(f"Error boosting post: {e}")
            db.session.rollback()
            raise

    def get_user_daily_boost_info(self, user_id):
        """Get user's daily boost information"""
        try:
            now = datetime.now(timezone.utc)
            today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
            
            # Count today's boosts
            today_boosts = PostBoost.query.filter(
                PostBoost.user_id == user_id,
                PostBoost.created_at >= today_start
            ).count()
            
            # Get today's boost details
            today_boost_details = PostBoost.query.filter(
                PostBoost.user_id == user_id,
                PostBoost.created_at >= today_start
            ).order_by(PostBoost.created_at.desc()).all()
            
            return {
                'daily_boosts_used': today_boosts,
                'daily_boosts_remaining': DAILY_BOOST_LIMIT - today_boosts,
                'daily_boosts_limit': DAILY_BOOST_LIMIT,
                'today_boosts': [boost.as_dict() for boost in today_boost_details],
                'reset_time': (today_start + timedelta(days=1)).isoformat()
            }
        except Exception as e:
            logging.error(f"Error getting user daily boost info: {e}")
            return None

    def get_boosted_posts(self):
        """Get all currently boosted posts"""
        try:
            now = datetime.now(timezone.utc)
            boosted_posts = PostBoost.query.filter(
                PostBoost.is_active == True,
                PostBoost.boost_end > now
            ).all()
            
            return [boost.as_dict() for boost in boosted_posts]
            
        except Exception as e:
            logging.error(f"Error getting boosted posts: {e}")
            return []

    def get_user_transactions(self, user_id, limit=50, offset=0):
        """Get user's transaction history"""
        try:
            transactions = CoinTransaction.query.filter_by(user_id=user_id)\
                .order_by(CoinTransaction.created_at.desc())\
                .limit(limit)\
                .offset(offset)\
                .all()
            
            return [transaction.as_dict() for transaction in transactions]
            
        except Exception as e:
            logging.error(f"Error getting user transactions: {e}")
            return []

    def get_available_avatars(self, user_id=None):
        """Get available avatars for purchase and owned avatars"""
        try:
            result = []
            
            if user_id:
                # Get all avatars (active and inactive) that the user owns
                owned_avatars = UserAvatar.query.filter_by(user_id=user_id).all()
                owned_avatar_ids = [ua.avatar_id for ua in owned_avatars]
                
                # Get active avatars that user doesn't own (for purchase)
                # Also filter by active categories
                available_avatars = AvatarItem.query.join(AvatarCategory).filter(
                    AvatarItem.is_active == True,
                    AvatarCategory.is_active == True,
                    ~AvatarItem.id.in_(owned_avatar_ids)
                ).all()
                
                # Get inactive avatars that user owns (for use)
                # Include avatars from inactive categories if user owns them
                owned_inactive_avatars = AvatarItem.query.filter(
                    AvatarItem.is_active == False,
                    AvatarItem.id.in_(owned_avatar_ids)
                ).all()
                
                # Combine available and owned inactive avatars
                all_avatars = available_avatars + owned_inactive_avatars
                
                for avatar in all_avatars:
                    avatar_dict = avatar.as_dict()
                    
                    # Check if user owns this avatar
                    owned = UserAvatar.query.filter_by(
                        user_id=user_id, 
                        avatar_id=avatar.id
                    ).first()
                    avatar_dict['owned'] = owned is not None
                    avatar_dict['equipped'] = owned.is_equipped if owned else False
                    avatar_dict['available_for_purchase'] = avatar.is_active and not avatar_dict['owned']
                    
                    result.append(avatar_dict)
            else:
                # For non-authenticated users, only show active avatars from active categories
                avatars = AvatarItem.query.join(AvatarCategory).filter(
                    AvatarItem.is_active == True,
                    AvatarCategory.is_active == True
                ).all()
                
                for avatar in avatars:
                    avatar_dict = avatar.as_dict()
                    avatar_dict['owned'] = False
                    avatar_dict['equipped'] = False
                    avatar_dict['available_for_purchase'] = True
                    
                    result.append(avatar_dict)
            
            return result
            
        except Exception as e:
            logging.error(f"Error getting available avatars: {e}")
            return []

    def get_user_avatars(self, user_id):
        """Get user's owned avatars"""
        try:
            user_avatars = UserAvatar.query.filter_by(user_id=user_id).all()
            return [user_avatar.as_dict() for user_avatar in user_avatars]
            
        except Exception as e:
            logging.error(f"Error getting user avatars: {e}")
            return []

    def _are_users_blocked(self, user1_id, user2_id):
        """Check if users are blocked from each other"""
        # This would need to be implemented based on your blocking system
        # For now, return False (no blocking)
        return False

    def _send_coin_notification(self, user_id, amount, transaction_type, new_balance):
        """Send email notification for coin transactions"""
        try:
            user = User.query.get(user_id)
            if not user or not user.email:
                return
            
            subject = "Coin Transaction Notification"
            
            if amount > 0:
                message = f"You received {amount} coins. New balance: {new_balance} coins."
            else:
                message = f"You spent {abs(amount)} coins. New balance: {new_balance} coins."
            
            send_email(user.email, subject, message)
            
        except Exception as e:
            logging.error(f"Error sending coin notification: {e}")

    def _send_purchase_notification(self, payment):
        """Send email notification for coin purchase"""
        try:
            user = User.query.get(payment.user_id)
            if not user or not user.email:
                return
            
            # Calculate values for email
            coin_amount = payment.coin_amount
            bonus_amount = self.first_purchase_bonus if payment.is_first_purchase else None
            total_coins = coin_amount + (bonus_amount or 0)
            new_balance = self.get_wallet_balance(payment.user_id)
            
            # Format dates
            from datetime import datetime
            purchase_date = payment.paid_at.strftime("%B %d, %Y at %I:%M %p") if payment.paid_at else datetime.now().strftime("%B %d, %Y at %I:%M %p")
            
            # Send professional email
            from yuuzone.utils.email import send_coin_purchase_email
            send_coin_purchase_email(
                user_email=user.email,
                username=user.username,
                package_name=payment.package.name if payment.package else 'Coin Package',
                coin_amount=coin_amount,
                total_coins=total_coins,
                new_balance=new_balance,
                transaction_id=f"TKPINC{payment.id:06d}",
                purchase_date=purchase_date,
                bonus_amount=bonus_amount,
                user=user
            )
            
        except Exception as e:
            logging.error(f"Error sending purchase notification: {e}")

    def get_coin_packages(self):
        """Get all active coin packages"""
        try:
            packages = CoinPackage.query.filter_by(is_active=True).all()
            return [package.as_dict() for package in packages]
            
        except Exception as e:
            logging.error(f"Error getting coin packages: {e}")
            return []

    def purchase_tier_with_coins(self, user_id, tier_slug):
        """Purchase tier subscription using coins"""
        try:
            # Get tier information
            from yuuzone.subscriptions.models import UserTier
            tier = UserTier.query.filter_by(slug=tier_slug).first()
            if not tier:
                raise ValueError("Invalid tier")
            
            # Calculate coin cost (convert VND price to coins at 1:1 ratio for now)
            coin_cost = int(float(tier.price_monthly))
            
            # Deduct coins
            self.deduct_coins(
                user_id, 
                coin_cost, 
                'tier_purchase', 
                tier.id, 
                'tier',
                f"Purchased tier: {tier.name}"
            )
            
            # Create subscription (reuse existing subscription service)
            from yuuzone.subscriptions.service import SubscriptionService
            subscription_service = SubscriptionService()
            
            # Create subscription for 1 month
            subscription = subscription_service.create_subscription_from_coins(
                user_id, tier_slug, coin_cost
            )
            
            # Emit tier purchase event via socket
            try:
                from yuuzone import socketio
                if socketio:
                    socketio.emit('tier_purchased', {
                        'user_id': user_id,
                        'tier_name': tier.name,
                        'tier_slug': tier_slug,
                        'cost': coin_cost
                    }, room=f'user_{user_id}')
                    
                    # Emit purchase history event
                    socketio.emit('new_purchase', {
                        'user_id': user_id,
                        'purchase_type': 'tier_purchase',
                        'purchase_data': {
                            'id': f"tier_{subscription.id if subscription else int(datetime.now(timezone.utc).timestamp())}",
                            'type': 'tier_purchase',
                            'tier_name': tier.name,
                            'tier_slug': tier_slug,
                            'amount': -coin_cost,
                            'created_at': subscription.created_at.isoformat() if subscription and subscription.created_at else None,
                            'description': f"Purchased tier: {tier.name}"
                        }
                    }, room=f'user_{user_id}')
            except Exception as e:
                logging.error(f"Error emitting tier purchase: {e}")
            
            return subscription
            
        except Exception as e:
            logging.error(f"Error purchasing tier with coins: {e}")
            raise 