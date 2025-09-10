from yuuzone import db
from sqlalchemy import case, func
import uuid
import logging
import io
from werkzeug.utils import secure_filename
from flask import current_app as app
from yuuzone.utils.message_encryption import message_encryption


class Messages(db.Model):
    __tablename__ = "messages"
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    sender_id = db.Column(db.Integer, db.ForeignKey("users.id"))
    receiver_id = db.Column(db.Integer, db.ForeignKey("users.id"))
    content = db.Column(db.Text, nullable=False)  # Keep for backward compatibility
    content_encrypted = db.Column(db.LargeBinary)  # New encrypted content
    encryption_version = db.Column(db.Integer, default=1)
    encryption_key_id = db.Column(db.String(255))
    iv = db.Column(db.LargeBinary)  # Initialization vector
    media = db.Column(db.Text)
    seen = db.Column(db.Boolean, default=False)
    seen_at = db.Column(db.DateTime(timezone=True))
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=db.func.now())
    edited_at = db.Column(db.DateTime(timezone=True))
    user_sender = db.relationship("User", back_populates="sender", primaryjoin="Messages.sender_id == User.id")
    user_receiver = db.relationship(
        "User",
        back_populates="receiver",
        primaryjoin="Messages.receiver_id == User.id",
    )

    def __init__(self, sender_id, receiver_id, content, media=None):
        self.sender_id = sender_id
        self.receiver_id = receiver_id
        
        # Encrypt content if encryption is available
        if message_encryption and content:
            encrypted_content, iv = message_encryption.encrypt_message(content)
            self.content_encrypted = encrypted_content
            self.iv = iv
            self.encryption_version = 1
            self.encryption_key_id = 'master_key_v1'
            # Keep original content for backward compatibility during transition
            self.content = content
        else:
            # Fallback to plain text if encryption not available
            self.content = content
            self.content_encrypted = None
            self.iv = None
            self.encryption_version = None
            self.encryption_key_id = None
        
        self.media = media

    def handle_media(self, file):
        """Handle file upload for messages with 25MB limit"""
        if not file:
            return

        # Import Cloudinary here to avoid circular imports
        try:
            from cloudinary import uploader
        except ImportError:
            raise ValueError("Cloudinary not configured for file uploads")

        # Check file size (25MB = 26214400 bytes)
        file.seek(0, 2)  # Seek to end
        file_size = file.tell()
        file.seek(0)  # Reset to beginning

        if file_size > 26214400:  # 25MB limit
            raise ValueError("File too large. Maximum size is 25MB.")

        if file_size == 0:
            raise ValueError("File is empty")

        try:
            filename = secure_filename(file.filename)

            if file.content_type.startswith("image/"):
                # Upload image
                image_data = uploader.upload(
                    file,
                    public_id=f"message_image_{uuid.uuid4().hex}_{filename.rsplit('.')[0]}",
                    resource_type="image"
                )
                if not image_data or not image_data.get('public_id'):
                    raise ValueError("Cloudinary upload failed: no public_id returned")
                url = f"https://res.cloudinary.com/{app.config['CLOUDINARY_NAME']}/image/upload/c_auto,g_auto/{image_data.get('public_id')}"
                #logging.info(f"Message image uploaded successfully to Cloudinary: {image_data.get('public_id')}")

            elif file.content_type.startswith("video/"):
                # Upload video
                video_data = uploader.upload(
                    file,
                    resource_type="video",
                    public_id=f"message_video_{uuid.uuid4().hex}_{filename.rsplit('.')[0]}",
                )
                if not video_data or not video_data.get('public_id'):
                    raise ValueError("Cloudinary video upload failed: no public_id returned")

                # Use consistent URL format like images - this ensures /video/ is in the path
                url = f"https://res.cloudinary.com/{app.config['CLOUDINARY_NAME']}/video/upload/{video_data.get('public_id')}"
                # print(f"f🔥 YUUZONE DEBUG: Generated video URL: {url}")
                #logging.info(f"Message video uploaded successfully to Cloudinary: {video_data.get('public_id')}")

            else:
                # For other file types, upload as raw
                file_data = uploader.upload(
                    file,
                    resource_type="raw",
                    public_id=f"message_file_{uuid.uuid4().hex}_{filename.rsplit('.')[0]}",
                )
                if not file_data or not file_data.get('secure_url'):
                    raise ValueError("Cloudinary upload failed: no secure_url returned")
                url = file_data.get("secure_url")
                #logging.info(f"Message file uploaded successfully to Cloudinary: {file_data.get('public_id')}")

            self.media = url

        except Exception as e:
            logging.error(f"Failed to upload message file to Cloudinary: {e}")
            raise ValueError(f"Failed to upload file: {str(e)}")

    def as_dict(self):
        # Decrypt content if encrypted
        content = self.get_decrypted_content()
        
        return {
            "message_id": self.id,
            "sender": {
                "username": self.user_sender.username,
                "avatar": self.user_sender.avatar,
            },
            "receiver": {
                "username": self.user_receiver.username,
                "avatar": self.user_receiver.avatar,
            },
            "content": content,
            "media": self.media,
            "created_at": self.created_at,
            "edited_at": self.edited_at,
            "seen": self.seen,
            "seen_at": self.seen_at,
        }
    
    def get_decrypted_content(self):
        """Get decrypted content, falling back to plain text if needed"""
        # Try to decrypt encrypted content first
        if self.content_encrypted and message_encryption:
            try:
                decrypted = message_encryption.decrypt_message(self.content_encrypted, self.iv)
                if decrypted is not None:
                    return decrypted
            except Exception as e:
                logging.error(f"Failed to decrypt message {self.id}: {e}")
        
        # Fallback to plain text content
        return self.content

    @classmethod
    def get_inbox(cls, user_id):
        my_case = case(
            (Messages.sender_id == user_id, Messages.receiver_id),
            else_=Messages.sender_id,
        ).label("contact_id")
        my_max = func.max(Messages.id).label("latest_id")
        my_subquery = (
            db.session.query(my_case, my_max)
            .filter((Messages.sender_id == user_id) | (Messages.receiver_id == user_id))
            .group_by("contact_id")
            .subquery()
        )
        messages = (
            Messages.query.join(my_subquery, my_subquery.c.latest_id == Messages.id)
            .order_by(Messages.created_at.desc())
            .all()
        )
        messages_list = []
        for message in messages:
            sender = message.user_receiver if message.sender_id == user_id else message.user_sender
            messages_list.append(
                message.as_dict()
                | {
                    "latest_from_user": message.sender_id == user_id,
                    "sender": {
                        "username": sender.username,
                        "avatar": sender.avatar,
                    },
                }
            )
        return messages_list
