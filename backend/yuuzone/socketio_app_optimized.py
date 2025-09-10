from flask_socketio import SocketIO, emit, join_room, leave_room
from flask import request
import logging

# Optimized Socket.IO configuration for better performance
try:
    from engineio.payload import Payload
    Payload.max_decode_packets = 100  # Reduced from 500 to 100 for better performance
except ImportError:
    logging.warning("Could not import engineio.payload, continuing without packet limit fix")

# Create optimized socketio instance
socketio = SocketIO(
    cors_allowed_origins="*",
    max_http_buffer_size=10000000,  # 10MB limit
    ping_timeout=30,  # Reduced from 60 to 30 seconds
    ping_interval=15,  # Reduced from 25 to 15 seconds
    engineio_logger=False,
    logger=False,
    async_mode='eventlet',
    allow_upgrades=True,
    transports=['websocket', 'polling'],  # Prioritize WebSocket
    always_connect=True,
    cookie=None,
    manage_session=False,
    # Performance optimizations
    compression_threshold=1024,  # Compress messages > 1KB
    compression_level=6,  # Balanced compression
)

# Optimized connection handler
@socketio.on('connect')
def on_connect():
    try:
        emit('connected', {'message': 'Connected to YuuZone server'})
    except Exception as e:
        logging.error(f"Error in on_connect: {e}")

@socketio.on('disconnect')
def on_disconnect(reason=None):
    try:
        # Optimized cleanup
        try:
            rooms = socketio.server.rooms(request.sid)
            for room in rooms:
                if room != request.sid:
                    leave_room(room)
        except Exception as cleanup_error:
            logging.debug(f"Cleanup error during disconnect: {cleanup_error}")
    except Exception as e:
        logging.error(f"Error in on_disconnect: {e}")

@socketio.on_error_default
def default_error_handler(e):
    try:
        logging.error(f"Socket.IO error: {e}")
    except Exception as err:
        pass

# Optimized room management
@socketio.on('join')
def on_join(data):
    try:
        if not data or not isinstance(data, dict):
            emit('error', {'message': 'Invalid join data'})
            return

        room = data.get('room')
        if not room or not isinstance(room, str) or len(room) > 100:
            emit('error', {'message': 'Invalid room name'})
            return

        join_room(room)
        emit('join_success', {'room': room})
    except Exception as e:
        logging.error(f"Error in on_join: {e}")
        emit('error', {'message': 'Failed to join room'})

@socketio.on('leave')
def on_leave(data):
    try:
        if not data or not isinstance(data, dict):
            emit('error', {'message': 'Invalid leave data'})
            return

        room = data.get('room')
        if not room or not isinstance(room, str) or len(room) > 100:
            emit('error', {'message': 'Invalid room name'})
            return

        leave_room(room)
        emit('leave_success', {'room': room})
    except Exception as e:
        logging.error(f"Error in on_leave: {e}")
        emit('error', {'message': 'Failed to leave room'})

# Optimized chat handlers
@socketio.on('join_chat')
def on_join_chat(data):
    try:
        if not data or not isinstance(data, dict):
            return

        room = data.get('room')
        if not room:
            return

        join_room(room)
        emit('status', {'msg': f'User joined chat room {room}'}, room=room)
    except Exception as e:
        logging.error(f"Error in on_join_chat: {e}")

@socketio.on('leave_chat')
def on_leave_chat(data):
    try:
        if not data or not isinstance(data, dict):
            return

        room = data.get('room')
        if not room:
            return

        leave_room(room)
        emit('status', {'msg': f'User left chat room {room}'}, room=room)
    except Exception as e:
        logging.error(f"Error in on_leave_chat: {e}")

# Optimized message handling
@socketio.on('new_message')
def on_new_message(data):
    try:
        if not data or not isinstance(data, dict):
            emit('error', {'message': 'Invalid message data'})
            return

        room = data.get('room')
        message = data.get('message')
        user = data.get('user')
        message_id = data.get('message_id')
        media = data.get('media')

        # Validation
        if not room or not user or not message_id:
            emit('error', {'message': 'Missing required fields'})
            return

        if not isinstance(message, str) or len(message) > 1000:
            emit('error', {'message': 'Invalid message content'})
            return

        if not message and not media:
            emit('error', {'message': 'Message must contain text or media'})
            return

        # Broadcast message
        message_payload = {
            'user': user,
            'message': message,
            'media': media,
            'message_id': message_id,
            'created_at': data.get('created_at'),
            'sender': data.get('sender'),
            'receiver': data.get('receiver')
        }
        
        emit('new_message', message_payload, room=room)
        emit('message_sent', {'message_id': message_id, 'room': room})
        
    except Exception as e:
        logging.error(f"Error in on_new_message: {e}")
        emit('error', {'message': 'Failed to send message'})

# Optimized typing indicators
@socketio.on('typing')
def on_typing(data):
    try:
        if not data or not isinstance(data, dict):
            return

        room = data.get('room')
        user = data.get('user')

        if not room or not user:
            return

        emit('user_typing', {
            'user': user,
            'typing': True
        }, room=room, include_self=False)
    except Exception as e:
        logging.error(f"Error in on_typing: {e}")

@socketio.on('stop_typing')
def on_stop_typing(data):
    try:
        if not data or not isinstance(data, dict):
            return

        room = data.get('room')
        user = data.get('user')

        if not room or not user:
            return

        emit('user_stop_typing', {
            'user': user,
            'typing': False
        }, room=room, include_self=False)
    except Exception as e:
        logging.error(f"Error in on_stop_typing: {e}")

# Optimized IP address retrieval
def get_client_ip(sid):
    """Optimized client IP address retrieval"""
    try:
        if not hasattr(socketio, 'server') or not socketio.server:
            return "Unknown IP"

        environ = socketio.server.get_environ(sid)
        if not environ:
            return "Unknown IP"

        # Check headers in order of preference
        headers_to_check = [
            'HTTP_CF_CONNECTING_IP',  # Cloudflare
            'HTTP_FASTLY_CLIENT_IP',  # Fastly
            'HTTP_X_FORWARDED_FOR',   # Standard proxy
            'HTTP_FORWARDED',         # RFC 7239
            'REMOTE_ADDR'             # Direct connection
        ]

        for header in headers_to_check:
            value = environ.get(header)
            if value:
                if header == 'HTTP_X_FORWARDED_FOR':
                    return value.split(',')[0].strip()
                elif header == 'HTTP_FORWARDED':
                    for directive in value.split(',')[0].split(';'):
                        if directive.strip().startswith('for='):
                            return directive.strip()[4:]
                else:
                    return value

        return "Unknown IP"
    except Exception as e:
        logging.error(f"Error getting client IP for session {sid}: {e}")
        return "Unknown IP"

# Optimized message edit/delete handlers
@socketio.on('edit_message')
def handle_edit_message(data):
    try:
        room = data.get('room')
        message_id = data.get('message_id')
        content = data.get('content')
        sender = data.get('sender')

        if not all([room, message_id, content, sender]):
            return

        emit('message_edited', {
            'message_id': message_id,
            'content': content,
            'edited_at': data.get('edited_at'),
            'sender': sender
        }, room=room)
    except Exception as e:
        logging.error(f"Error handling message edit: {e}")

@socketio.on('delete_message')
def handle_delete_message(data):
    try:
        room = data.get('room')
        message_id = data.get('message_id')
        sender = data.get('sender')

        if not all([room, message_id, sender]):
            return

        emit('message_deleted', {
            'message_id': message_id,
            'sender': sender
        }, room=room)
    except Exception as e:
        logging.error(f"Error handling message delete: {e}")

# Optimized real-time event handlers
@socketio.on('post_vote')
def handle_post_vote(data):
    try:
        post_id = data.get('post_id')
        user_id = data.get('user_id')
        subthread_id = data.get('subthread_id')

        if not all([post_id, user_id, subthread_id]):
            return

        emit('post_vote_updated', {
            'post_id': post_id,
            'user_id': user_id,
            'is_upvote': data.get('is_upvote'),
            'vote_type': data.get('vote_type')
        }, room=f'{subthread_id}')
    except Exception as e:
        logging.error(f"Error handling post vote: {e}")

@socketio.on('comment_vote')
def handle_comment_vote(data):
    try:
        comment_id = data.get('comment_id')
        post_id = data.get('post_id')
        user_id = data.get('user_id')

        if not all([comment_id, post_id, user_id]):
            return

        emit('comment_vote_updated', {
            'comment_id': comment_id,
            'post_id': post_id,
            'user_id': user_id,
            'is_upvote': data.get('is_upvote'),
            'vote_type': data.get('vote_type')
        }, room=f'{post_id}')
    except Exception as e:
        logging.error(f"Error handling comment vote: {e}")

@socketio.on('post_delete')
def handle_post_delete(data):
    try:
        post_id = data.get('post_id')
        subthread_id = data.get('subthread_id')
        deleted_by = data.get('deleted_by')

        if not all([post_id, subthread_id, deleted_by]):
            return

        emit('post_deleted', {
            'post_id': post_id,
            'deleted_by': deleted_by
        }, room=f'{subthread_id}')
    except Exception as e:
        logging.error(f"Error handling post delete: {e}")

@socketio.on('comment_delete')
def handle_comment_delete(data):
    try:
        comment_id = data.get('comment_id')
        post_id = data.get('post_id')
        deleted_by = data.get('deleted_by')

        if not all([comment_id, post_id, deleted_by]):
            return

        emit('comment_deleted', {
            'comment_id': comment_id,
            'deleted_by': deleted_by
        }, room=f'{post_id}')
    except Exception as e:
        logging.error(f"Error handling comment delete: {e}")

@socketio.on('comment_edit')
def handle_comment_edit(data):
    try:
        comment_id = data.get('comment_id')
        post_id = data.get('post_id')
        content = data.get('content')
        edited_by = data.get('edited_by')

        if not all([comment_id, post_id, content, edited_by]):
            return

        emit('comment_edited', {
            'comment_id': comment_id,
            'content': content,
            'edited_by': edited_by,
            'edited_at': data.get('edited_at')
        }, room=f'{post_id}')
    except Exception as e:
        logging.error(f"Error handling comment edit: {e}")

# Optimized user management handlers
@socketio.on('user_banned')
def handle_user_banned(data):
    try:
        username = data.get('username')
        subthread_id = data.get('subthread_id')
        banned_by = data.get('banned_by')

        if not all([username, subthread_id, banned_by]):
            return

        emit('user_banned', {
            'username': username,
            'banned_by': banned_by,
            'reason': data.get('reason')
        }, room=f'{subthread_id}')

        emit('you_were_banned', {
            'subthread_id': subthread_id,
            'banned_by': banned_by,
            'reason': data.get('reason')
        }, room=f'user_{username}')
    except Exception as e:
        logging.error(f"Error handling user ban: {e}")

@socketio.on('user_unbanned')
def handle_user_unbanned(data):
    try:
        username = data.get('username')
        subthread_id = data.get('subthread_id')
        unbanned_by = data.get('unbanned_by')

        if not all([username, subthread_id, unbanned_by]):
            return

        emit('user_unbanned', {
            'username': username,
            'unbanned_by': unbanned_by
        }, room=f'{subthread_id}')

        emit('you_were_unbanned', {
            'subthread_id': subthread_id,
            'unbanned_by': unbanned_by
        }, room=f'user_{username}')
    except Exception as e:
        logging.error(f"Error handling user unban: {e}")

@socketio.on('mod_removed')
def handle_mod_removed(data):
    try:
        username = data.get('username')
        subthread_id = data.get('subthread_id')
        removed_by = data.get('removed_by')

        if not all([username, subthread_id, removed_by]):
            return

        emit('mod_removed', {
            'username': username,
            'removed_by': removed_by
        }, room=f'{subthread_id}')

        emit('you_were_demoted', {
            'subthread_id': subthread_id,
            'removed_by': removed_by,
            'role': 'mod'
        }, room=f'user_{username}')
    except Exception as e:
        logging.error(f"Error handling mod removal: {e}")

@socketio.on('admin_transferred')
def handle_admin_transferred(data):
    try:
        old_admin = data.get('old_admin')
        new_admin = data.get('new_admin')
        subthread_id = data.get('subthread_id')

        if not all([old_admin, new_admin, subthread_id]):
            return

        emit('admin_transferred', {
            'old_admin': old_admin,
            'new_admin': new_admin
        }, room=f'{subthread_id}')

        emit('you_lost_admin', {
            'subthread_id': subthread_id,
            'new_admin': new_admin
        }, room=f'user_{old_admin}')

        emit('you_became_admin', {
            'subthread_id': subthread_id,
            'old_admin': old_admin
        }, room=f'user_{new_admin}')
    except Exception as e:
        logging.error(f"Error handling admin transfer: {e}")

# Optimized profile and status handlers
@socketio.on('profile_updated')
def handle_profile_updated(data):
    try:
        username = data.get('username')
        if not username:
            return

        emit('profile_updated', {
            'username': username,
            'updated_fields': data.get('updated_fields'),
            'avatar_url': data.get('avatar_url')
        }, broadcast=True)
    except Exception as e:
        logging.error(f"Error handling profile update: {e}")

@socketio.on('user_status_changed')
def handle_user_status_changed(data):
    try:
        username = data.get('username')
        status = data.get('status')

        if not all([username, status]):
            return

        emit('user_status_changed', {
            'username': username,
            'status': status
        }, broadcast=True)
    except Exception as e:
        logging.error(f"Error handling user status change: {e}")

# Optimized subthread handlers
@socketio.on('subthread_created')
def handle_subthread_created(data):
    try:
        subthread_id = data.get('subthread_id')
        subthread_name = data.get('subthread_name')
        created_by = data.get('created_by')

        if not all([subthread_id, subthread_name, created_by]):
            return

        emit('subthread_created', {
            'subthread_id': subthread_id,
            'subthread_name': subthread_name,
            'created_by': created_by,
            'subthread_data': data.get('subthread_data')
        }, broadcast=True)
    except Exception as e:
        logging.error(f"Error handling subthread creation: {e}")

@socketio.on('subthread_updated')
def handle_subthread_updated(data):
    try:
        subthread_id = data.get('subthread_id')
        updated_fields = data.get('updated_fields')
        updated_by = data.get('updated_by')

        if not all([subthread_id, updated_fields, updated_by]):
            return

        emit('subthread_updated', {
            'updated_fields': updated_fields,
            'updated_by': updated_by
        }, room=f'{subthread_id}')
    except Exception as e:
        logging.error(f"Error handling subthread update: {e}")

@socketio.on('subthread_joined')
def handle_subthread_joined(data):
    """Handle real-time subthread join events for sidebar updates"""
    try:
        subthread_id = data.get('subthreadId')
        user_id = data.get('userId')
        
        if not subthread_id:
            logging.error("Missing subthreadId for subthread_joined event")
            return

        logging.info(f"Broadcasting subthread_joined event: subthreadId={subthread_id}, userId={user_id}")

        # Broadcast to all clients for sidebar updates
        emit('subthread_joined', {
            'subthreadId': subthread_id,
            'userId': user_id
        }, broadcast=True)

        #logging.info(f"User {user_id} joined subthread {subthread_id}")

    except Exception as e:
        logging.error(f"Error handling subthread_joined event: {e}")

@socketio.on('subthread_left')
def handle_subthread_left(data):
    """Handle real-time subthread leave events for sidebar updates"""
    try:
        subthread_id = data.get('subthreadId')
        user_id = data.get('userId')
        
        if not subthread_id:
            logging.error("Missing subthreadId for subthread_left event")
            return

        logging.info(f"Broadcasting subthread_left event: subthreadId={subthread_id}, userId={user_id}")

        # Broadcast to all clients for sidebar updates
        emit('subthread_left', {
            'subthreadId': subthread_id,
            'userId': user_id
        }, broadcast=True)

        #logging.info(f"User {user_id} left subthread {subthread_id}")

    except Exception as e:
        logging.error(f"Error handling subthread_left event: {e}")

@socketio.on('user_subscription_changed')
def handle_user_subscription_changed(data):
    """Handle real-time user subscription changes for sidebar updates"""
    try:
        subthread_id = data.get('subthreadId')
        action = data.get('action')  # 'joined' or 'left'
        user_id = data.get('userId')
        username = data.get('username')
        
        if not all([subthread_id, action, user_id]):
            logging.error("Missing required fields for user_subscription_changed event")
            return

        logging.info(f"Broadcasting user_subscription_changed event: subthreadId={subthread_id}, action={action}, userId={user_id}, username={username}")

        # Broadcast to all clients for sidebar updates
        emit('user_subscription_changed', {
            'subthreadId': subthread_id,
            'action': action,
            'userId': user_id,
            'username': username
        }, broadcast=True)

        #logging.info(f"User {username} {action} subthread {subthread_id}")

    except Exception as e:
        logging.error(f"Error handling user_subscription_changed event: {e}")

@socketio.on('internal_subthread_update')
def handle_internal_subthread_update(data):
    """Handle internal subthread updates from routes and broadcast to all clients"""
    try:
        update_type = data.get('type')  # 'joined', 'left', 'created', 'updated', 'deleted'
        subthread_id = data.get('subthreadId')
        user_id = data.get('userId')
        username = data.get('username')
        
        if not all([update_type, subthread_id]):
            logging.error("Missing required fields for internal_subthread_update event")
            return

        logging.info(f"🔄 Processing internal subthread update: type={update_type}, subthreadId={subthread_id}, userId={user_id}")

        # Broadcast appropriate event based on update type
        if update_type == 'joined':
            logging.info(f"📤 Broadcasting subthread_joined event for subthread {subthread_id}")
            emit('subthread_joined', {
                'subthreadId': subthread_id,
                'userId': user_id
            }, broadcast=True)
            
            logging.info(f"📤 Broadcasting user_subscription_changed event for subthread {subthread_id}")
            emit('user_subscription_changed', {
                'subthreadId': subthread_id,
                'action': 'joined',
                'userId': user_id,
                'username': username
            }, broadcast=True)
            
        elif update_type == 'left':
            logging.info(f"📤 Broadcasting subthread_left event for subthread {subthread_id}")
            emit('subthread_left', {
                'subthreadId': subthread_id,
                'userId': user_id
            }, broadcast=True)
            
            logging.info(f"📤 Broadcasting user_subscription_changed event for subthread {subthread_id}")
            emit('user_subscription_changed', {
                'subthreadId': subthread_id,
                'action': 'left',
                'userId': user_id,
                'username': username
            }, broadcast=True)
            
        elif update_type == 'created':
            logging.info(f"📤 Broadcasting subthread_created event for subthread {subthread_id}")
            emit('subthread_created', {
                'subthread_id': subthread_id,
                'subthread_name': data.get('name'),
                'created_by': username,
                'subthread_data': data.get('subthread_data')
            }, broadcast=True)
            
        elif update_type == 'updated':
            logging.info(f"📤 Broadcasting subthread_updated event for subthread {subthread_id}")
            emit('subthread_updated', {
                'updated_fields': data.get('updated_fields'),
                'updated_by': username
            }, room=f'{subthread_id}')
            
        elif update_type == 'deleted':
            logging.info(f"📤 Broadcasting subthread_deleted event for subthread {subthread_id}")
            emit('subthread_deleted', {
                'id': subthread_id
            }, broadcast=True)

        logging.info(f"✅ Successfully broadcasted {update_type} event for subthread {subthread_id}")

    except Exception as e:
        logging.error(f"❌ Error handling internal_subthread_update event: {e}")

# Optimized notification handler
@socketio.on('notification')
def handle_notification(data):
    try:
        recipient_username = data.get('recipient_username')
        notification_type = data.get('type')
        title = data.get('title')
        message = data.get('message')

        if not all([recipient_username, notification_type, title, message]):
            return

        emit('notification', {
            'type': notification_type,
            'title': title,
            'message': message,
            'action_url': data.get('action_url'),
            'sender': data.get('sender'),
            'timestamp': data.get('timestamp')
        }, room=f'user_{recipient_username}')
    except Exception as e:
        logging.error(f"Error handling notification: {e}")

# Coin-related socket events
@socketio.on('coin_update')
def handle_coin_update(data):
    try:
        user_id = data.get('user_id')
        transaction_type = data.get('transaction_type')
        amount = data.get('amount')
        new_balance = data.get('new_balance')

        if not all([user_id, transaction_type, amount, new_balance]):
            return

        emit('coin_balance_updated', {
            'new_balance': new_balance,
            'transaction_type': transaction_type,
            'amount': amount
        }, room=f'user_{user_id}')
    except Exception as e:
        logging.error(f"Error handling coin update: {e}")

@socketio.on('coin_purchase_complete')
def handle_coin_purchase_complete(data):
    try:
        user_id = data.get('user_id')
        new_balance = data.get('new_balance')
        package_name = data.get('package_name')
        coin_amount = data.get('coin_amount')

        if not all([user_id, new_balance, package_name, coin_amount]):
            return

        emit('coin_purchase_complete', {
            'new_balance': new_balance,
            'package_name': package_name,
            'coin_amount': coin_amount
        }, room=f'user_{user_id}')
    except Exception as e:
        logging.error(f"Error handling coin purchase: {e}")

@socketio.on('avatar_purchased')
def handle_avatar_purchased(data):
    try:
        user_id = data.get('user_id')
        new_balance = data.get('new_balance')
        avatar_name = data.get('avatar_name')
        cost = data.get('cost')

        if not all([user_id, new_balance, avatar_name, cost]):
            return

        emit('avatar_purchased', {
            'new_balance': new_balance,
            'avatar_name': avatar_name,
            'cost': cost
        }, room=f'user_{user_id}')
    except Exception as e:
        logging.error(f"Error handling avatar purchase: {e}")

@socketio.on('post_boosted')
def handle_post_boosted(data):
    try:
        user_id = data.get('user_id')
        post_id = data.get('post_id')  # Add post_id
        new_balance = data.get('new_balance')
        post_title = data.get('post_title')
        cost = data.get('cost')

        if not all([user_id, post_id, new_balance, post_title, cost]):  # Check for post_id
            return

        emit('post_boosted', {
            'post_id': post_id,  # Include post_id in the emitted event
            'new_balance': new_balance,
            'post_title': post_title,
            'cost': cost
        }, room=f'user_{user_id}')
    except Exception as e:
        logging.error(f"Error handling post boost: {e}")

@socketio.on('tip_transaction')
def handle_tip_transaction(data):
    try:
        sender_id = data.get('sender_id')
        recipient_id = data.get('recipient_id')
        sender_balance = data.get('sender_balance')
        recipient_balance = data.get('recipient_balance')
        tip_amount = data.get('tip_amount')
        recipient_username = data.get('recipient_username')

        if not all([sender_id, recipient_id, sender_balance, recipient_balance, tip_amount, recipient_username]):
            return

        # Emit to sender's room
        emit('tip_transaction', {
            'new_balance': sender_balance,
            'tip_amount': tip_amount,
            'recipient_username': recipient_username,
            'is_sender': True
        }, room=f'user_{sender_id}')

        # Emit to recipient's room
        emit('tip_transaction', {
            'new_balance': recipient_balance,
            'tip_amount': tip_amount,
            'recipient_username': recipient_username,
            'is_sender': False
        }, room=f'user_{recipient_id}')
    except Exception as e:
        logging.error(f"Error handling tip transaction: {e}")

# Purchase History Events
@socketio.on('new_purchase')
def handle_new_purchase(data):
    """Handle new purchase events for real-time purchase history updates"""
    try:
        user_id = data.get('user_id')
        purchase_type = data.get('purchase_type')
        purchase_data = data.get('purchase_data')

        if not all([user_id, purchase_type, purchase_data]):
            return

        emit('new_purchase', {
            'purchase_type': purchase_type,
            'purchase_data': purchase_data
        }, room=f'user_{user_id}')
    except Exception as e:
        logging.error(f"Error handling new purchase: {e}")

@socketio.on('purchase_status_updated')
def handle_purchase_status_updated(data):
    """Handle purchase status updates for real-time purchase history updates"""
    try:
        user_id = data.get('user_id')
        purchase_id = data.get('purchase_id')
        purchase_type = data.get('purchase_type')
        new_status = data.get('new_status')

        if not all([user_id, purchase_id, purchase_type, new_status]):
            return

        emit('purchase_status_updated', {
            'purchase_id': purchase_id,
            'purchase_type': purchase_type,
            'new_status': new_status
        }, room=f'user_{user_id}')
    except Exception as e:
        logging.error(f"Error handling purchase status update: {e}")

@socketio.on('payment_completed')
def handle_payment_completed(data):
    """Handle payment completion events for automatic redirects"""
    try:
        user_id = data.get('user_id')
        payment_reference = data.get('payment_reference')
        payment_type = data.get('payment_type')
        amount = data.get('amount')
        new_balance = data.get('new_balance')
        tier_name = data.get('tier_name')

        if not all([user_id, payment_reference, payment_type]):
            return

        emit('payment_completed', {
            'payment_reference': payment_reference,
            'payment_type': payment_type,
            'amount': amount,
            'new_balance': new_balance,
            'tier_name': tier_name
        }, room=f'user_{user_id}')
        
        logging.info(f"Payment completion event emitted for user {user_id}: {payment_type} payment {payment_reference}")
    except Exception as e:
        logging.error(f"Error handling payment completion: {e}")

@socketio.on('subscription_purchased')
def handle_subscription_purchased(data):
    """Handle subscription purchase events"""
    try:
        user_id = data.get('user_id')
        tier_name = data.get('tier_name')
        tier_slug = data.get('tier_slug')
        amount = data.get('amount')
        currency = data.get('currency')
        payment_status = data.get('payment_status')

        if not all([user_id, tier_name, tier_slug, amount]):
            return

        emit('subscription_purchased', {
            'tier_name': tier_name,
            'tier_slug': tier_slug,
            'amount': amount,
            'currency': currency or 'VND',
            'payment_status': payment_status or 'pending'
        }, room=f'user_{user_id}')
    except Exception as e:
        logging.error(f"Error handling subscription purchase: {e}")

@socketio.on('tier_purchased')
def handle_tier_purchased(data):
    """Handle tier purchase with coins events"""
    try:
        user_id = data.get('user_id')
        tier_name = data.get('tier_name')
        tier_slug = data.get('tier_slug')
        cost = data.get('cost')

        if not all([user_id, tier_name, tier_slug, cost]):
            return

        emit('tier_purchased', {
            'tier_name': tier_name,
            'tier_slug': tier_slug,
            'cost': cost
        }, room=f'user_{user_id}')
    except Exception as e:
        logging.error(f"Error handling tier purchase: {e}") 