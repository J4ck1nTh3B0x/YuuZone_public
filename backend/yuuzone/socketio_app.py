from flask_socketio import SocketIO, emit, join_room, leave_room
from flask import request
import logging
from .utils.connection_manager import connection_manager
from .utils.system_monitor import system_monitor

# Fix for "Too many packets in payload" error
try:
    from engineio.payload import Payload
    Payload.max_decode_packets = 500  # Increased from default ~16 to 500
except ImportError:
    # If engineio is not available or version doesn't support this, continue without it
    logging.warning("Could not import engineio.payload, continuing without packet limit fix")

# Create socketio instance without app (will be initialized later)
socketio = SocketIO(
    cors_allowed_origins="*",
    max_http_buffer_size=2000000,  # 2MB buffer size (optimized)
    ping_timeout=60,  # Increased to 60 second ping timeout
    ping_interval=25,  # Increased to 25 second ping interval
    engineio_logger=False,  # Disable for production (enable for debugging)
    logger=False,  # Disable for production (enable for debugging)
    async_mode='eventlet',  # Use eventlet mode for Gunicorn eventlet worker
    allow_upgrades=True,  # Allow transport upgrades
    transports=['websocket', 'polling'],  # Prefer WebSocket over polling
    # Additional configuration for better stability
    always_connect=True,  # Always allow connections
    cookie=None,  # Disable cookies for better compatibility
    manage_session=False,  # Don't manage sessions automatically
    remember_upgrade=True,  # Remember transport upgrades
    # Disable CORS credentials requirement to fix connection issues
    cors_credentials=False,  # Disable CORS credentials requirement
    # Additional settings for better connection stability
    compression_threshold=1024,  # Compress messages > 1KB
    compression_level=6  # Balanced compression
)

# Add connection and disconnection event handlers
@socketio.on('connect')
def on_connect():
    try:
        # Import Flask-Login for authentication
        from flask_login import current_user
        
        # Get client IP for logging
        client_ip = get_client_ip(request.sid)
        
        # Check if user is authenticated (optional - allow both authenticated and anonymous connections)
        user_id = None
        username = None
        if current_user.is_authenticated:
            user_id = current_user.id
            username = current_user.username
            logging.info(f"Authenticated user {username} (ID: {user_id}) connected from {client_ip}")
        else:
            logging.info(f"Anonymous user connected from {client_ip}")
        
        # Register connection with connection manager (optional)
        try:
            connection_id = f"websocket_{request.sid}"
            metadata = {
                'sid': request.sid, 
                'ip': client_ip,
                'user_id': user_id,
                'username': username,
                'authenticated': current_user.is_authenticated
            }
            connection_manager.register_connection(connection_id, "websocket", metadata)
        except Exception as e:
            logging.warning(f"Failed to register connection: {request.sid}, error: {e}")
            # Don't reject connection if registration fails
        
        # Send connection confirmation with user info
        emit('connected', {
            'message': 'Connected to YuuZone server',
            'authenticated': current_user.is_authenticated,
            'user_id': user_id,
            'username': username
        })
        
        logging.info(f"Client {request.sid} connected successfully")
        return True
        
    except Exception as e:
        logging.error(f"Error in on_connect: {e}")
        # Don't reject connection on error, just log it
        return True

@socketio.on('disconnect')
def on_disconnect(reason=None):
    try:
        # Remove connection from connection manager
        connection_id = f"websocket_{request.sid}"
        try:
            connection_manager.remove_connection(connection_id, f"disconnect: {reason}")
        except Exception as e:
            logging.warning(f"Failed to remove connection from manager: {e}")
        
        # Force cleanup of any remaining rooms for this client
        try:
            # Get all rooms for this client and leave them
            if hasattr(socketio, 'server') and socketio.server:
                rooms = socketio.server.rooms(request.sid)
                if rooms:
                    for room in rooms:
                        if room != request.sid:  # Don't leave the client's own room
                            try:
                                leave_room(room)
                            except Exception as room_error:
                                logging.debug(f"Failed to leave room {room}: {room_error}")
        except Exception as cleanup_error:
            # Ignore cleanup errors to prevent cascading failures
            logging.debug(f"Cleanup error during disconnect: {cleanup_error}")
        
        logging.info(f"Client {request.sid} disconnected: {reason}")
            
    except Exception as e:
        logging.error(f"Error in on_disconnect: {e}")

# Add error handler for Socket.IO
@socketio.on_error_default
def default_error_handler(e):
    try:
        logging.error(f"Socket.IO error: {e}")
        # Don't emit error events to clients as they might cause frontend errors
    except Exception as err:
        # Fallback error handling
        logging.error(f"Critical Socket.IO error: {err}")
        # Don't emit anything to prevent cascading errors
        pass

# Add connection error handler
@socketio.on('connect_error')
def handle_connect_error(error):
    try:
        logging.warning(f"Socket connection error from {request.sid}: {error}")
    except Exception as e:
        logging.error(f"Error handling connection error: {e}")

# Add disconnect error handler
@socketio.on('disconnect_error')
def handle_disconnect_error(error):
    try:
        logging.warning(f"Socket disconnect error from {request.sid}: {error}")
    except Exception as e:
        logging.error(f"Error handling disconnect error: {e}")

@socketio.on('join')
def on_join(data):
    try:
        from flask_login import current_user
        
        # Handle different data types gracefully
        if isinstance(data, str):
            # If data is a string, treat it as room name
            room = data
            logging.warning(f"String data received in on_join from {request.sid}, treating as room name: {data}")
        elif isinstance(data, dict):
            # If data is a dict, extract room name
            room = data.get('room')
            if not room:
                logging.error(f"No room specified in join from {request.sid}")
                emit('error', {'message': 'Room name required'})
                return
        else:
            logging.error(f"Invalid data type received in on_join from {request.sid}: {type(data)} - {data}")
            emit('error', {'message': 'Invalid join data'})
            return

        # Validate room name format
        if not isinstance(room, str) or len(room) > 100:
            logging.error(f"Invalid room name format from {request.sid}: {room}")
            emit('error', {'message': 'Invalid room name'})
            return

        # Check authentication for user-specific rooms
        if room.startswith('user_') and not current_user.is_authenticated:
            logging.warning(f"Unauthenticated user tried to join user room: {room}")
            emit('error', {'message': 'Authentication required for user rooms'})
            return

        # Check authentication for chat rooms
        if room.startswith('chat_') and not current_user.is_authenticated:
            logging.warning(f"Unauthenticated user tried to join chat room: {room}")
            emit('error', {'message': 'Authentication required for chat rooms'})
            return

        join_room(room)
        # Get client IP address safely
        ip_address = get_client_ip(request.sid)
        
        # Log room join with user info
        if current_user.is_authenticated:
            logging.info(f"User {current_user.username} (ID: {current_user.id}) joined room {room} from IP: {ip_address}")
        else:
            logging.info(f"Anonymous user joined room {room} from IP: {ip_address}")
        
        emit('status', {'msg': f'User has entered the room {room}'}, room=room)
        emit('join_success', {'room': room})
        
    except Exception as e:
        logging.error(f"Error in on_join: {e}")
        emit('error', {'message': 'Failed to join room'})
        # Don't re-raise the exception to prevent WSGI errors

@socketio.on('leave')
def on_leave(data):
    try:
        # Handle different data types gracefully
        if isinstance(data, str):
            # If data is a string, treat it as room name
            room = data
            logging.warning(f"String data received in on_leave from {request.sid}, treating as room name: {data}")
        elif isinstance(data, dict):
            # If data is a dict, extract room name
            room = data.get('room')
            if not room:
                logging.error(f"No room specified in leave from {request.sid}")
                emit('error', {'message': 'Room name required'})
                return
        else:
            logging.error(f"Invalid data type received in on_leave from {request.sid}: {type(data)} - {data}")
            emit('error', {'message': 'Invalid leave data'})
            return

        # Validate room name format
        if not isinstance(room, str) or len(room) > 100:
            logging.error(f"Invalid room name format from {request.sid}: {room}")
            emit('error', {'message': 'Invalid room name'})
            return

        leave_room(room)
        # Get client IP address safely
        ip_address = get_client_ip(request.sid)
        # print(f"f🔥 YUUZONE DEBUG: User {request.sid} left room {room} from IP: {ip_address}")
        #logging.info(f"User left room {room} from IP: {ip_address}")
        emit('status', {'msg': f'User has left the room {room}'}, room=room)
        emit('leave_success', {'room': room})
        # print(f"f🔥 YUUZONE DEBUG: Sent leave_success to {request.sid} for room {room}")
    except Exception as e:
        logging.error(f"Error in on_leave: {e}")
        emit('error', {'message': 'Failed to leave room'})
        # Don't re-raise the exception to prevent WSGI errors

@socketio.on('join_chat')
def on_join_chat(data):
    try:
        if not data or not isinstance(data, dict):
            logging.error("Invalid data received in on_join_chat")
            return

        room = data.get('room')
        if not room:
            logging.error("No room specified in join_chat")
            return

        join_room(room)
        ip_address = get_client_ip(request.sid)
        #logging.info(f"User {request.sid} joined chat room {room} from IP: {ip_address}")
        emit('status', {'msg': f'User joined chat room {room}'}, room=room)
    except Exception as e:
        logging.error(f"❌ Error in on_join_chat: {e}")
        # Don't re-raise the exception to prevent WSGI errors

@socketio.on('leave_chat')
def on_leave_chat(data):
    try:
        if not data or not isinstance(data, dict):
            logging.error("Invalid data received in on_leave_chat")
            return

        room = data.get('room')
        if not room:
            logging.error("No room specified in leave_chat")
            return

        leave_room(room)
        ip_address = get_client_ip(request.sid)
        #logging.info(f"User left chat room {room} from IP: {ip_address}")
        emit('status', {'msg': f'User left chat room {room}'}, room=room)
    except Exception as e:
        logging.error(f"Error in on_leave_chat: {e}")
        # Don't re-raise the exception to prevent WSGI errors

@socketio.on('new_message')
def on_new_message(data):
    try:
        if not data or not isinstance(data, dict):
            logging.error(f"Invalid data received in on_new_message from {request.sid}: {data}")
            emit('error', {'message': 'Invalid message data'})
            return

        room = data.get('room')
        message = data.get('message')
        user = data.get('user')
        message_id = data.get('message_id')
        created_at = data.get('created_at')
        sender = data.get('sender')
        receiver = data.get('receiver')
        media = data.get('media')

        # print(f"f🔥 YUUZONE DEBUG: Received new_message event from {request.sid}")
        # print(f"f🔥 YUUZONE DEBUG: Room: {room}")
        # print(f"f🔥 YUUZONE DEBUG: Message: '{message}' (length: {len(message) if message else 0})")
        # print(f"f🔥 YUUZONE DEBUG: Media: {media}")
        # print(f"f🔥 YUUZONE DEBUG: Media type: {type(media)}")
        # print(f"f🔥 YUUZONE DEBUG: Has media: {bool(media)}")
        # print(f"f🔥 YUUZONE DEBUG: User: {user}")
        # print(f"f🔥 YUUZONE DEBUG: Message ID: {message_id}")

        # Validate required fields
        if not room:
            logging.error(f"No room specified in new_message from {request.sid}")
            emit('error', {'message': 'Room name required'})
            return

        # Allow empty message if media is present, but message must be a string
        if not isinstance(message, str):
            logging.error(f"Invalid message content type from {request.sid}: {type(message)}")
            emit('error', {'message': 'Message must be a string'})
            return

        # Require either message content or media
        if not message and not media:
            logging.error(f"Empty message with no media from {request.sid}")
            emit('error', {'message': 'Message must contain text or media'})
            return

        if not user:
            logging.error(f"No user specified in new_message from {request.sid}")
            emit('error', {'message': 'User required'})
            return

        # Validate message length
        if len(message) > 1000:
            logging.error(f"Message too long from {request.sid}: {len(message)} chars")
            emit('error', {'message': 'Message too long'})
            return

        # print(f"f🔥 YUUZONE DEBUG: Broadcasting message to room {room}: {message[:50]}... (from {user})")
        #logging.info(f"Broadcasting message to room {room}: {message[:50]}... (from {user})")

        # Broadcast the new message to the chat room with all necessary fields
        message_payload = {
            'user': user,
            'message': message,
            'media': media,
            'message_id': message_id,
            'created_at': created_at,
            'sender': sender,
            'receiver': receiver
        }
        # print(f"f🔥 YUUZONE DEBUG: Message payload: {message_payload}")
        # print(f"f🔥 YUUZONE DEBUG: Message payload media field: {message_payload.get('media')}")
        emit('new_message', message_payload, room=room)
        # print(f"f🔥 YUUZONE DEBUG: Emitted new_message to room {room} with media: {bool(message_payload.get('media'))}")

        # Confirm message was sent
        emit('message_sent', {'message_id': message_id, 'room': room})
        # print(f"f🔥 YUUZONE DEBUG: Message broadcasted successfully to room {room}")
        #logging.info(f"Message broadcasted successfully to room {room}")
    except Exception as e:
        logging.error(f"❌ Error in on_new_message: {e}")
        emit('error', {'message': 'Failed to send message'})
        # Don't re-raise the exception to prevent WSGI errors

@socketio.on('typing')
def on_typing(data):
    try:
        if not data or not isinstance(data, dict):
            logging.error("Invalid data received in on_typing")
            return

        room = data.get('room')
        user = data.get('user')

        if not room or not user:
            logging.error("Missing room or user in typing event")
            return

        # Broadcast typing indicator to the room (excluding sender)
        emit('user_typing', {
            'user': user,
            'typing': True
        }, room=room, include_self=False)

        #logging.info(f"User {user} is typing in room {room}")
    except Exception as e:
        logging.error(f"Error in on_typing: {e}")
        # Don't re-raise the exception to prevent WSGI errors

@socketio.on('stop_typing')
def on_stop_typing(data):
    try:
        if not data or not isinstance(data, dict):
            logging.error("Invalid data received in on_stop_typing")
            return

        room = data.get('room')
        user = data.get('user')

        if not room or not user:
            logging.error("Missing room or user in stop_typing event")
            return

        # Broadcast stop typing indicator to the room (excluding sender)
        emit('user_stop_typing', {
            'user': user,
            'typing': False
        }, room=room, include_self=False)

        #logging.info(f"User {user} stopped typing in room {room}")
    except Exception as e:
        logging.error(f"Error in on_stop_typing: {e}")
        # Don't re-raise the exception to prevent WSGI errors

def get_client_ip(sid):
    """Safely get client IP address from Socket.IO session"""
    try:
        # Try to get IP address from various headers or handshake info
        if not hasattr(socketio, 'server') or not socketio.server:
            return "Unknown IP"

        environ = socketio.server.get_environ(sid)
        if not environ:
            return "Unknown IP"

        # Direct connection IP
        ip = environ.get('REMOTE_ADDR')
        if ip:
            return ip

        # X-Forwarded-For header
        x_forwarded_for = environ.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            return x_forwarded_for.split(',')[0].strip()

        # Forwarded header
        forwarded = environ.get('HTTP_FORWARDED')
        if forwarded:
            for directive in forwarded.split(',')[0].split(';'):
                if directive.strip().startswith('for='):
                    return directive.strip()[4:]

        # Cloudflare header
        cf_ip = environ.get('HTTP_CF_CONNECTING_IP')
        if cf_ip:
            return cf_ip

        # Fastly header
        fastly_ip = environ.get('HTTP_FASTLY_CLIENT_IP')
        if fastly_ip:
            return fastly_ip

        return "Unknown IP"
    except Exception as e:
        logging.error(f"Error getting client IP for session {sid}: {e}")
        return "Unknown IP"


# Message edit/delete handlers
@socketio.on('edit_message')
def handle_edit_message(data):
    """Handle message edit events"""
    try:
        room = data.get('room')
        message_id = data.get('message_id')
        content = data.get('content')
        edited_at = data.get('edited_at')
        sender = data.get('sender')

        if not all([room, message_id, content, sender]):
            logging.error("Missing required fields for message edit")
            return

        # Broadcast the edit to the chat room
        emit('message_edited', {
            'message_id': message_id,
            'content': content,
            'edited_at': edited_at,
            'sender': sender
        }, room=room)

        #logging.info(f"Message {message_id} edited by {sender} in room {room}")

    except Exception as e:
        logging.error(f"Error handling message edit: {e}")


@socketio.on('delete_message')
def handle_delete_message(data):
    """Handle message delete events"""
    try:
        room = data.get('room')
        message_id = data.get('message_id')
        sender = data.get('sender')

        if not all([room, message_id, sender]):
            logging.error("Missing required fields for message delete")
            return

        # Broadcast the deletion to the chat room
        emit('message_deleted', {
            'message_id': message_id,
            'sender': sender
        }, room=room)

        #logging.info(f"Message {message_id} deleted by {sender} in room {room}")

    except Exception as e:
        logging.error(f"Error handling message delete: {e}")


# ============================================================================
# POST AND COMMENT REAL-TIME EVENTS
# ============================================================================

@socketio.on('post_vote')
def handle_post_vote(data):
    """Handle real-time post voting events"""
    try:
        post_id = data.get('post_id')
        user_id = data.get('user_id')
        is_upvote = data.get('is_upvote')
        vote_type = data.get('vote_type')  # 'new', 'update', 'remove'
        subthread_id = data.get('subthread_id')

        if not all([post_id, user_id, subthread_id]):
            logging.error("Missing required fields for post vote")
            return

        # Broadcast vote update to subthread room
        emit('post_vote_updated', {
            'post_id': post_id,
            'user_id': user_id,
            'is_upvote': is_upvote,
            'vote_type': vote_type
        }, room=f'{subthread_id}')

        #logging.info(f"Post {post_id} vote {vote_type} by user {user_id} in subthread {subthread_id}")

    except Exception as e:
        logging.error(f"Error handling post vote: {e}")

@socketio.on('comment_vote')
def handle_comment_vote(data):
    """Handle real-time comment voting events"""
    try:
        comment_id = data.get('comment_id')
        post_id = data.get('post_id')
        user_id = data.get('user_id')
        is_upvote = data.get('is_upvote')
        vote_type = data.get('vote_type')  # 'new', 'update', 'remove'

        if not all([comment_id, post_id, user_id]):
            logging.error("Missing required fields for comment vote")
            return

        # Broadcast vote update to post room
        emit('comment_vote_updated', {
            'comment_id': comment_id,
            'post_id': post_id,
            'user_id': user_id,
            'is_upvote': is_upvote,
            'vote_type': vote_type
        }, room=f'{post_id}')

        #logging.info(f"Comment {comment_id} vote {vote_type} by user {user_id} in post {post_id}")

    except Exception as e:
        logging.error(f"Error handling comment vote: {e}")

@socketio.on('post_delete')
def handle_post_delete(data):
    """Handle real-time post deletion events"""
    try:
        post_id = data.get('post_id')
        subthread_id = data.get('subthread_id')
        deleted_by = data.get('deleted_by')

        if not all([post_id, subthread_id, deleted_by]):
            logging.error("Missing required fields for post delete")
            return

        # Broadcast post deletion to subthread room
        emit('post_deleted', {
            'post_id': post_id,
            'deleted_by': deleted_by
        }, room=f'{subthread_id}')

        #logging.info(f"Post {post_id} deleted by {deleted_by} in subthread {subthread_id}")

    except Exception as e:
        logging.error(f"Error handling post delete: {e}")

@socketio.on('comment_delete')
def handle_comment_delete(data):
    """Handle real-time comment deletion events"""
    try:
        comment_id = data.get('comment_id')
        post_id = data.get('post_id')
        deleted_by = data.get('deleted_by')

        if not all([comment_id, post_id, deleted_by]):
            logging.error("Missing required fields for comment delete")
            return

        # Broadcast comment deletion to post room
        emit('comment_deleted', {
            'comment_id': comment_id,
            'deleted_by': deleted_by
        }, room=f'{post_id}')

        #logging.info(f"Comment {comment_id} deleted by {deleted_by} in post {post_id}")

    except Exception as e:
        logging.error(f"Error handling comment delete: {e}")

@socketio.on('comment_edit')
def handle_comment_edit(data):
    """Handle real-time comment edit events"""
    try:
        comment_id = data.get('comment_id')
        post_id = data.get('post_id')
        content = data.get('content')
        edited_by = data.get('edited_by')
        edited_at = data.get('edited_at')

        if not all([comment_id, post_id, content, edited_by]):
            logging.error("Missing required fields for comment edit")
            return

        # Broadcast comment edit to post room
        emit('comment_edited', {
            'comment_id': comment_id,
            'content': content,
            'edited_by': edited_by,
            'edited_at': edited_at
        }, room=f'{post_id}')

        #logging.info(f"Comment {comment_id} edited by {edited_by} in post {post_id}")

    except Exception as e:
        logging.error(f"Error handling comment edit: {e}")


# ============================================================================
# USER MANAGEMENT REAL-TIME EVENTS
# ============================================================================

@socketio.on('user_banned')
def handle_user_banned(data):
    """Handle real-time user ban events"""
    try:
        username = data.get('username')
        subthread_id = data.get('subthread_id')
        banned_by = data.get('banned_by')
        reason = data.get('reason')

        if not all([username, subthread_id, banned_by]):
            logging.error("Missing required fields for user ban")
            return

        # Broadcast ban to subthread room
        emit('user_banned', {
            'username': username,
            'banned_by': banned_by,
            'reason': reason
        }, room=f'{subthread_id}')

        # Also emit to the banned user's personal room
        emit('you_were_banned', {
            'subthread_id': subthread_id,
            'banned_by': banned_by,
            'reason': reason
        }, room=f'user_{username}')

        #logging.info(f"User {username} banned from subthread {subthread_id} by {banned_by}")

    except Exception as e:
        logging.error(f"Error handling user ban: {e}")

@socketio.on('user_unbanned')
def handle_user_unbanned(data):
    """Handle real-time user unban events"""
    try:
        username = data.get('username')
        subthread_id = data.get('subthread_id')
        unbanned_by = data.get('unbanned_by')

        if not all([username, subthread_id, unbanned_by]):
            logging.error("Missing required fields for user unban")
            return

        # Broadcast unban to subthread room
        emit('user_unbanned', {
            'username': username,
            'unbanned_by': unbanned_by
        }, room=f'{subthread_id}')

        # Also emit to the unbanned user's personal room
        emit('you_were_unbanned', {
            'subthread_id': subthread_id,
            'unbanned_by': unbanned_by
        }, room=f'user_{username}')

        #logging.info(f"User {username} unbanned from subthread {subthread_id} by {unbanned_by}")

    except Exception as e:
        logging.error(f"Error handling user unban: {e}")

@socketio.on('mod_removed')
def handle_mod_removed(data):
    """Handle real-time mod removal events"""
    try:
        username = data.get('username')
        subthread_id = data.get('subthread_id')
        removed_by = data.get('removed_by')

        if not all([username, subthread_id, removed_by]):
            logging.error("Missing required fields for mod removal")
            return

        # Broadcast mod removal to subthread room
        emit('mod_removed', {
            'username': username,
            'removed_by': removed_by
        }, room=f'{subthread_id}')

        # Also emit to the removed mod's personal room
        emit('you_were_demoted', {
            'subthread_id': subthread_id,
            'removed_by': removed_by,
            'role': 'mod'
        }, room=f'user_{username}')

        #logging.info(f"Mod {username} removed from subthread {subthread_id} by {removed_by}")

    except Exception as e:
        logging.error(f"Error handling mod removal: {e}")

@socketio.on('admin_transferred')
def handle_admin_transferred(data):
    """Handle real-time admin transfer events"""
    try:
        old_admin = data.get('old_admin')
        new_admin = data.get('new_admin')
        subthread_id = data.get('subthread_id')

        if not all([old_admin, new_admin, subthread_id]):
            logging.error("Missing required fields for admin transfer")
            return

        # Broadcast admin transfer to subthread room
        emit('admin_transferred', {
            'old_admin': old_admin,
            'new_admin': new_admin
        }, room=f'{subthread_id}')

        # Emit to both users' personal rooms
        emit('you_lost_admin', {
            'subthread_id': subthread_id,
            'new_admin': new_admin
        }, room=f'user_{old_admin}')

        emit('you_became_admin', {
            'subthread_id': subthread_id,
            'old_admin': old_admin
        }, room=f'user_{new_admin}')

        #logging.info(f"Admin transferred from {old_admin} to {new_admin} in subthread {subthread_id}")

    except Exception as e:
        logging.error(f"Error handling admin transfer: {e}")


# ============================================================================
# PROFILE AND USER STATUS REAL-TIME EVENTS
# ============================================================================

@socketio.on('profile_updated')
def handle_profile_updated(data):
    """Handle real-time profile update events"""
    try:
        username = data.get('username')
        updated_fields = data.get('updated_fields')  # dict of changed fields
        avatar_url = data.get('avatar_url')

        if not username:
            logging.error("Missing username for profile update")
            return

        # Broadcast profile update to all relevant rooms
        # This could include subthreads where user is active, chat rooms, etc.
        emit('profile_updated', {
            'username': username,
            'updated_fields': updated_fields,
            'avatar_url': avatar_url
        }, broadcast=True)

        #logging.info(f"Profile updated for user {username}")

    except Exception as e:
        logging.error(f"Error handling profile update: {e}")

@socketio.on('user_status_changed')
def handle_user_status_changed(data):
    """Handle real-time user status changes (online/offline)"""
    try:
        username = data.get('username')
        status = data.get('status')  # 'online', 'offline', 'away'

        if not all([username, status]):
            logging.error("Missing required fields for user status change")
            return

        # Broadcast status change to all relevant rooms
        emit('user_status_changed', {
            'username': username,
            'status': status
        }, broadcast=True)

        #logging.info(f"User {username} status changed to {status}")

    except Exception as e:
        logging.error(f"Error handling user status change: {e}")


# ============================================================================
# SUBTHREAD REAL-TIME EVENTS
# ============================================================================

@socketio.on('subthread_created')
def handle_subthread_created(data):
    """Handle real-time subthread creation events"""
    try:
        subthread_id = data.get('subthread_id')
        subthread_name = data.get('subthread_name')
        created_by = data.get('created_by')
        subthread_data = data.get('subthread_data')

        if not all([subthread_id, subthread_name, created_by]):
            logging.error("Missing required fields for subthread creation")
            return

        # Broadcast new subthread to all users
        emit('subthread_created', {
            'subthread_id': subthread_id,
            'subthread_name': subthread_name,
            'created_by': created_by,
            'subthread_data': subthread_data
        }, broadcast=True)

        #logging.info(f"Subthread {subthread_name} created by {created_by}")

    except Exception as e:
        logging.error(f"Error handling subthread creation: {e}")

@socketio.on('subthread_updated')
def handle_subthread_updated(data):
    """Handle real-time subthread update events"""
    try:
        subthread_id = data.get('subthread_id')
        updated_fields = data.get('updated_fields')
        updated_by = data.get('updated_by')

        if not all([subthread_id, updated_fields, updated_by]):
            logging.error("Missing required fields for subthread update")
            return

        # Broadcast subthread update to subthread room
        emit('subthread_updated', {
            'updated_fields': updated_fields,
            'updated_by': updated_by
        }, room=f'{subthread_id}')

        #logging.info(f"Subthread {subthread_id} updated by {updated_by}")

    except Exception as e:
        logging.error(f"Error handling subthread update: {e}")


# ============================================================================
# NOTIFICATION REAL-TIME EVENTS
# ============================================================================

@socketio.on('notification')
def handle_notification(data):
    """Handle real-time notification events"""
    try:
        recipient_username = data.get('recipient_username')
        notification_type = data.get('type')  # 'mention', 'reply', 'ban', 'mod_action', etc.
        title = data.get('title')
        message = data.get('message')
        action_url = data.get('action_url')
        sender = data.get('sender')

        if not all([recipient_username, notification_type, title, message]):
            logging.error("Missing required fields for notification")
            return

        # Send notification to user's personal room
        emit('notification', {
            'type': notification_type,
            'title': title,
            'message': message,
            'action_url': action_url,
            'sender': sender,
            'timestamp': data.get('timestamp')
        }, room=f'user_{recipient_username}')

        #logging.info(f"Notification sent to {recipient_username}: {notification_type}")

    except Exception as e:
        logging.error(f"Error handling notification: {e}")

# ============================================================================
# ENHANCED POST AND SUBTHREAD REAL-TIME EVENTS
# ============================================================================

@socketio.on('post_edit')
def handle_post_edit(data):
    """Handle real-time post edit events"""
    try:
        post_id = data.get('post_id')
        subthread_id = data.get('subthread_id')
        edited_by = data.get('edited_by')
        edited_at = data.get('edited_at')
        new_title = data.get('new_title')
        new_content = data.get('new_content')
        new_media = data.get('new_media')

        if not all([post_id, subthread_id, edited_by]):
            logging.error("Missing required fields for post edit")
            return

        # Broadcast post edit to subthread room
        emit('post_edited', {
            'post_id': post_id,
            'edited_by': edited_by,
            'edited_at': edited_at,
            'new_title': new_title,
            'new_content': new_content,
            'new_media': new_media
        }, room=f'{subthread_id}')

        #logging.info(f"Post {post_id} edited by {edited_by} in subthread {subthread_id}")

    except Exception as e:
        logging.error(f"Error handling post edit: {e}")

@socketio.on('subthread_stats_update')
def handle_subthread_stats_update(data):
    """Handle real-time subthread statistics updates"""
    try:
        subthread_id = data.get('subthread_id')
        stats_type = data.get('stats_type')  # 'posts_count', 'subscriber_count', 'active_users'
        new_value = data.get('new_value')
        updated_by = data.get('updated_by')

        if not all([subthread_id, stats_type, new_value]):
            logging.error("Missing required fields for subthread stats update")
            return

        # Broadcast stats update to subthread room
        emit('subthread_stats_updated', {
            'stats_type': stats_type,
            'new_value': new_value,
            'updated_by': updated_by
        }, room=f'{subthread_id}')

        #logging.info(f"Subthread {subthread_id} stats updated: {stats_type} = {new_value}")

    except Exception as e:
        logging.error(f"Error handling subthread stats update: {e}")

@socketio.on('user_activity')
def handle_user_activity(data):
    """Handle real-time user activity tracking"""
    try:
        username = data.get('username')
        activity_type = data.get('activity_type')  # 'posting', 'commenting', 'voting', 'browsing'
        subthread_id = data.get('subthread_id')
        post_id = data.get('post_id')

        if not all([username, activity_type]):
            logging.error("Missing required fields for user activity")
            return

        # Broadcast user activity to relevant rooms
        activity_data = {
            'username': username,
            'activity_type': activity_type,
            'timestamp': data.get('timestamp')
        }

        if subthread_id:
            emit('user_activity', activity_data, room=f'{subthread_id}')
        
        if post_id:
            emit('user_activity', activity_data, room=f'{post_id}')

        #logging.info(f"User {username} activity: {activity_type}")

    except Exception as e:
        logging.error(f"Error handling user activity: {e}")

@socketio.on('live_user_count')
def handle_live_user_count(data):
    """Handle real-time live user count updates"""
    try:
        subthread_id = data.get('subthread_id')
        user_count = data.get('user_count')
        active_users = data.get('active_users', [])

        if not all([subthread_id, user_count]):
            logging.error("Missing required fields for live user count")
            return

        # Broadcast live user count to subthread room
        emit('live_user_count_updated', {
            'user_count': user_count,
            'active_users': active_users
        }, room=f'{subthread_id}')

        #logging.info(f"Live user count updated for subthread {subthread_id}: {user_count}")

    except Exception as e:
        logging.error(f"Error handling live user count: {e}")

# ============================================================================
# ENHANCED NOTIFICATION AND INTERACTION EVENTS
# ============================================================================

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

        logging.info(f"🔄 Processing internal subthread update: type={update_type}, subthreadId={subthread_id}, userId={user_id}, username={username}")

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

@socketio.on('mention')
def handle_mention(data):
    """Handle real-time user mentions"""
    try:
        mentioned_user = data.get('mentioned_user')
        mentioned_by = data.get('mentioned_by')
        post_id = data.get('post_id')
        comment_id = data.get('comment_id')
        content = data.get('content')

        if not all([mentioned_user, mentioned_by]):
            logging.error("Missing required fields for mention")
            return

        # Send mention notification to mentioned user
        emit('you_were_mentioned', {
            'mentioned_by': mentioned_by,
            'post_id': post_id,
            'comment_id': comment_id,
            'content': content,
            'timestamp': data.get('timestamp')
        }, room=f'user_{mentioned_user}')

        #logging.info(f"User {mentioned_user} mentioned by {mentioned_by}")

    except Exception as e:
        logging.error(f"Error handling mention: {e}")

@socketio.on('post_shared')
def handle_post_shared(data):
    """Handle real-time post sharing events"""
    try:
        post_id = data.get('post_id')
        shared_by = data.get('shared_by')
        share_platform = data.get('share_platform')  # 'twitter', 'facebook', 'copy_link'
        subthread_id = data.get('subthread_id')

        if not all([post_id, shared_by]):
            logging.error("Missing required fields for post share")
            return

        # Broadcast share event to subthread room
        emit('post_shared', {
            'post_id': post_id,
            'shared_by': shared_by,
            'share_platform': share_platform
        }, room=f'{subthread_id}')

        #logging.info(f"Post {post_id} shared by {shared_by} on {share_platform}")

    except Exception as e:
        logging.error(f"Error handling post share: {e}")

# ============================================================================
# SYSTEM AND PERFORMANCE EVENTS
# ============================================================================

@socketio.on('system_status')
def handle_system_status(data):
    """Handle real-time system status updates"""
    try:
        status_type = data.get('status_type')  # 'maintenance', 'performance', 'error'
        message = data.get('message')
        severity = data.get('severity')  # 'info', 'warning', 'error'

        if not all([status_type, message]):
            logging.error("Missing required fields for system status")
            return

        # Broadcast system status to all connected clients
        emit('system_status_update', {
            'status_type': status_type,
            'message': message,
            'severity': severity,
            'timestamp': data.get('timestamp')
        }, broadcast=True)

        #logging.info(f"System status update: {status_type} - {message}")

    except Exception as e:
        logging.error(f"Error handling system status: {e}")

@socketio.on('performance_metrics')
def handle_performance_metrics(data):
    """Handle real-time performance metrics"""
    try:
        metrics_type = data.get('metrics_type')  # 'response_time', 'memory_usage', 'active_connections'
        value = data.get('value')
        threshold = data.get('threshold')

        if not all([metrics_type, value]):
            logging.error("Missing required fields for performance metrics")
            return

        # Only broadcast if metrics exceed threshold
        if threshold and value > threshold:
            emit('performance_alert', {
                'metrics_type': metrics_type,
                'value': value,
                'threshold': threshold,
                'timestamp': data.get('timestamp')
            }, broadcast=True)

        #logging.info(f"Performance metrics: {metrics_type} = {value}")

    except Exception as e:
        logging.error(f"Error handling performance metrics: {e}")

# ============================================================================
# SETTINGS AND USER PREFERENCE EVENTS
# ============================================================================

@socketio.on('join_room')
def handle_join_room(data):
    """Handle joining specific rooms for settings updates"""
    try:
        # Handle different data types gracefully
        if isinstance(data, str):
            # If data is a string, treat it as room name
            room = data
            logging.warning(f"String data received in handle_join_room from {request.sid}, treating as room name: {data}")
        elif isinstance(data, dict):
            # If data is a dict, extract room name
            room = data.get('room')
            if not room:
                logging.error(f"No room specified in join_room from {request.sid}")
                emit('error', {'message': 'Room name required'})
                return
        else:
            logging.error(f"Invalid data type received in handle_join_room from {request.sid}: {type(data)} - {data}")
            emit('error', {'message': 'Invalid join_room data'})
            return

        # Validate room name format
        if not isinstance(room, str) or len(room) > 100:
            logging.error(f"Invalid room name format from {request.sid}: {room}")
            emit('error', {'message': 'Invalid room name'})
            return

        join_room(room)
        emit('room_joined', {'room': room})
        logging.info(f"Client {request.sid} joined room: {room}")

    except Exception as e:
        logging.error(f"Error in join_room: {e}")
        emit('error', {'message': 'Failed to join room'})

@socketio.on('leave_room')
def handle_leave_room(data):
    """Handle leaving specific rooms"""
    try:
        # Handle different data types gracefully
        if isinstance(data, str):
            # If data is a string, treat it as room name
            room = data
            logging.warning(f"String data received in handle_leave_room from {request.sid}, treating as room name: {data}")
        elif isinstance(data, dict):
            # If data is a dict, extract room name
            room = data.get('room')
            if not room:
                logging.error(f"No room specified in leave_room from {request.sid}")
                emit('error', {'message': 'Room name required'})
                return
        else:
            logging.error(f"Invalid data type received in handle_leave_room from {request.sid}: {type(data)} - {data}")
            emit('error', {'message': 'Invalid leave_room data'})
            return

        # Validate room name format
        if not isinstance(room, str) or len(room) > 100:
            logging.error(f"Invalid room name format from {request.sid}: {room}")
            emit('error', {'message': 'Invalid room name'})
            return

        leave_room(room)
        emit('room_left', {'room': room})
        logging.info(f"Client {request.sid} left room: {room}")

    except Exception as e:
        logging.error(f"Error in leave_room: {e}")
        emit('error', {'message': 'Failed to leave room'})

def emit_theme_updated(user_id, theme_data):
    """Emit theme update event to specific user"""
    try:
        emit('theme_updated', theme_data, room=f'user_settings_{user_id}')
        logging.info(f"Theme updated for user {user_id}")
    except Exception as e:
        logging.error(f"Error emitting theme_updated: {e}")

def emit_subscription_updated(user_id, subscription_data):
    """Emit subscription update event to specific user"""
    try:
        emit('subscription_updated', subscription_data, room=f'user_settings_{user_id}')
        logging.info(f"Subscription updated for user {user_id}")
    except Exception as e:
        logging.error(f"Error emitting subscription_updated: {e}")

def emit_custom_theme_updated(user_id, theme_data):
    """Emit custom theme update event to specific user"""
    try:
        emit('custom_theme_updated', theme_data, room=f'user_settings_{user_id}')
        logging.info(f"Custom theme updated for user {user_id}")
    except Exception as e:
        logging.error(f"Error emitting custom_theme_updated: {e}")

def emit_user_preference_updated(user_id, preference_data):
    """Emit user preference update event to specific user"""
    try:
        emit('user_preference_updated', preference_data, room=f'user_settings_{user_id}')
        logging.info(f"User preference updated for user {user_id}")
    except Exception as e:
        logging.error(f"Error emitting user_preference_updated: {e}")

def emit_translation_stats_updated(user_id, stats_data):
    """Emit translation stats update event to specific user"""
    try:
        emit('translation_stats_updated', stats_data, room=f'user_settings_{user_id}')
        logging.info(f"Translation stats updated for user {user_id}")
    except Exception as e:
        logging.error(f"Error emitting translation_stats_updated: {e}")
