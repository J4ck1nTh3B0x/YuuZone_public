from yuuzone.messages.models import Messages
from flask import Blueprint, jsonify, request
from yuuzone import db
from sqlalchemy import and_
from yuuzone.users.models import User
from flask_login import login_required, current_user

# Import rate limiting utilities
from yuuzone.utils.rate_limiter import combined_protection

messages = Blueprint("messages", __name__, url_prefix="/api")

# Socket.IO will be handled in WSGI - use try/except for graceful fallback
try:
    from yuuzone.socketio_app import socketio as socketio_instance
except ImportError:
    socketio_instance = None


@messages.route("/messages", methods=["POST"])
@login_required
@combined_protection("send_message")
def new_message():

    # Handle both JSON and form data (for file uploads)
    if request.content_type and 'multipart/form-data' in request.content_type:
        # Handle file upload
        form_data = request.form.to_dict()
        file = request.files.get('file')
    else:
        # Handle JSON data (text-only messages)
        form_data = request.json
        file = None

    if form_data:
        receiver_user = User.query.filter(
            User.username == form_data["receiver"], 
            User.is_email_verified == True, 
            User.deleted == False,
            ~User.username.startswith("del_")  # Exclude deleted accounts
        ).first()
        if not receiver_user:
            return jsonify({"message": "User not found or account deleted"}), 404

        # Validate content - either text content or file must be present
        content = form_data.get("content", "").strip()
        if not content and not file:
            return jsonify({"message": "Message must contain text or a file"}), 400

        # If no text content but file exists, use empty string for content
        if not content and file:
            content = ""

        try:
            new_message = Messages(
                sender_id=current_user.id,
                receiver_id=receiver_user.id,
                content=content,
            )

            # Handle file upload if present
            if file:
                # print(f"f🔥 YUUZONE DEBUG: Processing file upload: {file.filename}")
                new_message.handle_media(file)
                # print(f"f🔥 YUUZONE DEBUG: After handle_media, message.media = {new_message.media}")

            db.session.add(new_message)
            db.session.commit()

            # Refresh the message from database to ensure all fields are loaded
            db.session.refresh(new_message)
            # print(f"f🔥 YUUZONE DEBUG: After DB commit and refresh, message.media = {new_message.media}")

        except ValueError as e:
            # Handle file upload errors
            return jsonify({"message": str(e)}), 400
        except Exception as e:
            # Handle other errors
            import logging
            logging.error(f"Failed to create message: {e}")
            return jsonify({"message": "Failed to send message"}), 500

        # Emit to shared chat room and individual user rooms if socketio is available
        if socketio_instance:
            # Create consistent room name for both users (alphabetical order)
            room_name = f"chat_{min(current_user.username, receiver_user.username)}_{max(current_user.username, receiver_user.username)}"

            # Prepare message data
            message_data = {
                'user': current_user.username,
                'message': new_message.get_decrypted_content(),  # Use decrypted content
                'media': new_message.media,
                'message_id': new_message.id,
                'created_at': new_message.created_at.isoformat(),
                'sender': {
                    'username': current_user.username,
                    'avatar': current_user.avatar
                },
                'receiver': {
                    'username': receiver_user.username,
                    'avatar': receiver_user.avatar
                }
            }

            # print(f"f🔥 YUUZONE DEBUG: Prepared message data for Socket.IO: {message_data}")
            # print(f"f🔥 YUUZONE DEBUG: Message media field: {new_message.media}")
            # print(f"f🔥 YUUZONE DEBUG: Message data media field: {message_data.get('media')}")
            # print(f"f🔥 YUUZONE DEBUG: Room name: {room_name}")

            # Ensure media field is properly included
            if new_message.media:
                message_data['media'] = new_message.media
                # print(f"f🔥 YUUZONE DEBUG: Explicitly set media field: {message_data['media']}")

            # Emit to shared chat room for real-time messaging (if Socket.IO available)
            if socketio_instance:
                try:
                    import logging
                    #logging.info(f"Emitting message to chat room: {room_name}")

                    # Emit to the chat room for real-time chat updates
                    # The Chat component will handle both chat and inbox updates
                    # print(f"f🔥 YUUZONE DEBUG: Emitting to chat room: {room_name}")
                    socketio_instance.emit('new_message', message_data, room=room_name)
                    # print(f"f🔥 YUUZONE DEBUG: Emitted to chat room successfully")

                    # Also emit to individual user rooms to ensure users get messages
                    # even if they're not currently in the chat room
                    # print(f"f🔥 YUUZONE DEBUG: Emitting to user rooms: user_{receiver_user.id}, user_{current_user.id}")
                    #logging.info(f"Emitting to user rooms: user_{receiver_user.id}, user_{current_user.id}")
                    socketio_instance.emit('new_message', message_data, room=f"user_{receiver_user.id}")
                    socketio_instance.emit('new_message', message_data, room=f"user_{current_user.id}")
                    # print(f"f🔥 YUUZONE DEBUG: Emitted to user rooms successfully")

                except Exception as e:
                    import logging
                    logging.error(f"Failed to emit message events: {e}")
            else:
                import logging
                #logging.info("Socket.IO not available, skipping real-time message emission")

        response_data = new_message.as_dict()
        # print(f"f🔥 YUUZONE DEBUG: API response data: {response_data}")
        # print(f"f🔥 YUUZONE DEBUG: API response media field: {response_data.get('media')}")
        return jsonify(response_data), 200
    return jsonify({"message": "Message must contain text or a file"}), 400


@messages.route("/messages/inbox")
@login_required
def get_inbox():
    return jsonify(Messages.get_inbox(current_user.id)), 200


@messages.route("/messages/chat/<username>")
@login_required
def get_chat(username):
    receiver_user = User.query.filter(
        User.username == username, 
        User.is_email_verified == True, 
        User.deleted == False,
        ~User.username.startswith("del_")  # Exclude deleted accounts
    ).first()
    if not receiver_user:
        # Return error for deleted users
        return jsonify({"error": "User not found or account deleted"}), 404
    
    chat_messages = Messages.query.filter(
        and_(
            (Messages.sender_id == current_user.id) & (Messages.receiver_id == receiver_user.id) |
            (Messages.sender_id == receiver_user.id) & (Messages.receiver_id == current_user.id)
        )
    ).order_by(Messages.created_at.asc()).all()
    
    return jsonify([message.as_dict() for message in chat_messages]), 200


@messages.route("/messages/mark-seen", methods=["POST"])
@login_required
def mark_messages_seen():
    if form_data := request.json:
        sender_username = form_data.get("sender")
        if not sender_username:
            return jsonify({"message": "Sender username is required"}), 400
            
        sender_user = User.query.filter(
        User.username == sender_username, 
        User.is_email_verified == True,
        User.deleted == False,
        ~User.username.startswith("del_")  # Exclude deleted accounts
    ).first()
        if not sender_user:
            return jsonify({"message": "Sender not found"}), 404
            
        # Mark all messages from this sender to current user as seen
        Messages.query.filter_by(
            sender_id=sender_user.id,
            receiver_id=current_user.id,
            seen=False
        ).update({"seen": True, "seen_at": db.func.now()})
        
        db.session.commit()
        return jsonify({"message": "Messages marked as seen"}), 200
    
    return jsonify({"message": "Invalid request data"}), 400


@messages.route("/messages/<int:message_id>/edit", methods=["PUT"])
@login_required
def edit_message(message_id):
    """Edit a message - only the sender can edit their own messages"""
    data = request.get_json()
    new_content = data.get("content", "").strip()

    if not new_content:
        return jsonify({"message": "Message content cannot be empty"}), 400

    # Find the message
    message = Messages.query.filter_by(id=message_id, sender_id=current_user.id).first()
    if not message:
        return jsonify({"message": "Message not found or you don't have permission to edit it"}), 404

    # Update the message
    message.content = new_content
    message.edited_at = db.func.now()
    db.session.commit()

    # Emit real-time update if socketio is available
    if socketio_instance:
        try:
            # Get receiver info
            receiver_user = User.query.get(message.receiver_id)
            if receiver_user:
                # Create consistent room name for both users (alphabetical order)
                room_name = f"chat_{min(current_user.username, receiver_user.username)}_{max(current_user.username, receiver_user.username)}"

                # Prepare edit data
                edit_data = {
                    'message_id': message_id,
                    'content': new_content,
                    'edited_at': message.edited_at.isoformat() if message.edited_at else None,
                    'sender': current_user.username
                }

                # Emit to chat room
                socketio_instance.emit('message_edited', edit_data, room=room_name)

        except Exception as e:
            import logging
            logging.error(f"Failed to emit message edit event: {e}")

    return jsonify(message.as_dict()), 200


@messages.route("/messages/<int:message_id>/delete", methods=["DELETE"])
@login_required
def delete_message(message_id):
    """Delete a message - only the sender can delete their own messages"""
    # Find the message
    message = Messages.query.filter_by(id=message_id, sender_id=current_user.id).first()
    if not message:
        return jsonify({"message": "Message not found or you don't have permission to delete it"}), 404

    # Store receiver info before deletion
    receiver_user = User.query.get(message.receiver_id)

    # Delete the message
    db.session.delete(message)
    db.session.commit()

    # Emit real-time update if socketio is available
    if socketio_instance and receiver_user:
        try:
            # Create consistent room name for both users (alphabetical order)
            room_name = f"chat_{min(current_user.username, receiver_user.username)}_{max(current_user.username, receiver_user.username)}"

            # Prepare delete data
            delete_data = {
                'message_id': message_id,
                'sender': current_user.username
            }

            # Emit to chat room
            socketio_instance.emit('message_deleted', delete_data, room=room_name)

        except Exception as e:
            import logging
            logging.error(f"Failed to emit message delete event: {e}")

    return jsonify({"message": "Message deleted successfully"}), 200
