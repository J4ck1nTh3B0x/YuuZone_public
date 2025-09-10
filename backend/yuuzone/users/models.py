from sqlalchemy import func
import cloudinary.uploader as uploader
import uuid
from yuuzone import db
from yuuzone import login_manager
from flask_login import UserMixin
from yuuzone import ma, app
from flask_marshmallow.fields import fields
from marshmallow.exceptions import ValidationError
import logging

class UserBlock(db.Model):
    __tablename__ = "user_blocks"
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    blocker_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    blocked_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=db.func.now())

    __table_args__ = (
        db.UniqueConstraint("blocker_id", "blocked_id", name="user_blocks_blocker_blocked_unique"),
    )

    def __init__(self, blocker_id, blocked_id):
        self.blocker_id = blocker_id
        self.blocked_id = blocked_id


@login_manager.user_loader
def load_user(user_id):
    return User.query.get(user_id)


class User(db.Model, UserMixin):
    __tablename__: str = "users"
    id: int = db.Column(db.Integer, primary_key=True)
    username: str = db.Column(db.Text, unique=True, nullable=False)
    email: str = db.Column(db.Text, unique=True, nullable=False)
    password_hash: str = db.Column(db.Text, nullable=False)
    avatar: str = db.Column(db.Text)
    bio: str = db.Column(db.Text)
    language_preference: str = db.Column(db.String(3), default='en')
    theme: str = db.Column(db.String(10), default='light')
    registration_date = db.Column(db.DateTime(timezone=True), nullable=False, default=db.func.now())
    deleted = db.Column(db.Boolean, nullable=False, default=False)
    is_email_verified = db.Column(db.Boolean, nullable=False, default=False)
    email_verification_token = db.Column(db.Text)
    email_verification_expires_at = db.Column(db.DateTime(timezone=True))
    current_tier_id = db.Column(db.Integer)
    theme_preference = db.Column(db.String(20), default='light')
    theme = db.Column(db.String(10), nullable=False, default='light')
    deleted_at = db.Column(db.DateTime(timezone=True))
    # Account deletion verification fields
    account_deletion_token = db.Column(db.Text)
    account_deletion_expires_at = db.Column(db.DateTime(timezone=True))
    account_deletion_requested_at = db.Column(db.DateTime(timezone=True))
    subthread = db.relationship("Subthread", back_populates="user")
    user_role = db.relationship("UserRole", back_populates="user")
    subscription = db.relationship("Subscription", back_populates="user")
    user_karma = db.relationship("UsersKarma", back_populates="user")
    post = db.relationship("Posts", back_populates="user")
    post_info = db.relationship("PostInfo", back_populates="user")
    comment = db.relationship("Comments", back_populates="user")
    reaction = db.relationship("Reactions", back_populates="user")
    saved_post = db.relationship("SavedPosts", back_populates="user")
    sender = db.relationship("Messages", back_populates="user_sender", foreign_keys="Messages.sender_id")
    receiver = db.relationship("Messages", back_populates="user_receiver", foreign_keys="Messages.receiver_id")

    def __init__(self, username: str, email: str, password_hash: str):
        self.username = username
        self.email = email.lower() if email else email
        self.password_hash = password_hash
        # Set default avatar from environment variable
        self.avatar = app.config.get('DEFAULT_AVATAR_URL')
        self.deleted = False

    def get_id(self):
        return str(self.id)

    def add(self):
        db.session.add(self)
        db.session.commit()

    def patch(self, image, form_data):
        if form_data.get("content_type") == "image" and image:
            self.delete_avatar()
            image_data = uploader.upload(image, public_id=f"{uuid.uuid4().hex}_{image.filename.rsplit('.')[0]}")
            url = f"https://res.cloudinary.com/{app.config['CLOUDINARY_NAME']}/image/upload/f_auto,q_auto/{image_data.get('public_id')}"
            self.avatar = url
        elif form_data.get("content_type") == "url":
            # Enhanced security validation for avatar URL uploads
            url = form_data.get("content_url")
            if url:
                try:
                    from yuuzone.utils.security import SecureURLValidator, URLUploadRateLimit
                    import io

                    # Check rate limit for this user
                    URLUploadRateLimit.check_rate_limit(self.id)

                    # Delete current avatar before uploading new one
                    self.delete_avatar()

                    # Secure download with comprehensive validation
                    image_bytes = SecureURLValidator.safe_download_image(url)

                    # Upload to Cloudinary
                    image_data = uploader.upload(
                        io.BytesIO(image_bytes),
                        public_id=f"secure_avatar_{uuid.uuid4().hex}_{self.username}",
                        resource_type="image"
                    )
                    if not image_data or not image_data.get('public_id'):
                        raise ValueError("Cloudinary upload failed: no public_id returned")

                    # Use the Cloudinary URL with auto optimization
                    cloud_url = f"https://res.cloudinary.com/{app.config['CLOUDINARY_NAME']}/image/upload/f_auto,q_auto/{image_data.get('public_id')}"
                    self.avatar = cloud_url
                    #logging.info(f"Secure avatar URL uploaded successfully for user {self.username}: {image_data.get('public_id')}")

                except ValueError as e:
                    # Security or validation error - log and re-raise with user-friendly message
                    logging.warning(f"Avatar URL validation failed for user {self.username}, URL {url}: {e}")
                    raise ValueError(f"Avatar URL validation failed: {str(e)}")
                except Exception as e:
                    logging.error(f"Failed to upload secure avatar URL for user {self.username}: {e}")
                    raise ValueError(f"Failed to upload avatar: {str(e)}")
        elif form_data.get("content_type") == "available_avatar":
            # Handle available avatar selection
            avatar_id = form_data.get("avatar_id")
            if avatar_id:
                try:
                    from yuuzone.coins.models import UserAvatar, AvatarItem
                    # Check if user owns this avatar
                    user_avatar = UserAvatar.query.filter_by(
                        user_id=self.id, 
                        avatar_id=avatar_id
                    ).first()
                    
                    if not user_avatar:
                        raise ValueError("Avatar not owned by user")
                    
                    # Get the avatar item
                    avatar_item = AvatarItem.query.get(avatar_id)
                    if not avatar_item or not avatar_item.is_active:
                        raise ValueError("Invalid avatar")
                    
                    # Update user's avatar to the selected one
                    self.avatar = avatar_item.image_url
                    
                except Exception as e:
                    logging.error(f"Failed to set available avatar for user {self.username}: {e}")
                    raise ValueError(f"Failed to set available avatar: {str(e)}")
        elif form_data.get("content_type") == "remove":
            # Remove avatar and set to default
            self.delete_avatar()
        self.bio = form_data.get("bio")
        db.session.commit()

    def delete_avatar(self):
        if self.avatar and self.avatar.startswith(f"https://res.cloudinary.com/{app.config['CLOUDINARY_NAME']}"):
            # Don't delete the default avatar
            if app.config.get('DEFAULT_AVATAR_URL') and self.avatar == app.config.get('DEFAULT_AVATAR_URL'):
                return

            # Extract public_id correctly by removing the base URL and extension
            public_id_with_ext = self.avatar.split("/")[-1]
            public_id = ".".join(public_id_with_ext.split(".")[:-1]) if "." in public_id_with_ext else public_id_with_ext
            res = uploader.destroy(public_id)
            # print(f"fCloudinary Image Destroy Response for {self.username}: ", res)

        # Set to default avatar after deletion
        self.avatar = app.config.get('DEFAULT_AVATAR_URL')

    def has_role(self, role):
        # DEPRECATED: Use subthread-specific role checking instead
        # This method should not be used for authorization decisions
        return role in {r.role.slug for r in self.user_role}

    @classmethod
    def get_all(cls):
        all_users: list[dict] = []
        for user in cls.query.filter_by(deleted=False).all():
            all_users.append(user.as_dict(include_all=True))
        return all_users

    def as_dict(self, include_all=False) -> dict:
        # Safely get karma data or provide defaults
        karma_data = {
            "user_karma": 0,
            "comments_count": 0,
            "comments_karma": 0,
            "posts_count": 0,
            "posts_karma": 0,
        }

        try:
            if hasattr(self, 'user_karma') and self.user_karma:
                # Handle both list and single object cases
                if isinstance(self.user_karma, list) and len(self.user_karma) > 0:
                    karma_data = self.user_karma[0].as_dict()
                elif hasattr(self.user_karma, 'as_dict'):
                    karma_data = self.user_karma.as_dict()
        except (IndexError, AttributeError, TypeError):
            # If there's any issue with karma data, use defaults
            pass

        # Get subscription types
        subscription_types = []
        try:
            from yuuzone.subscriptions.service import SubscriptionService
            subscription_service = SubscriptionService()
            subscription_types = subscription_service.get_user_subscription_types(self.id)
        except Exception:
            # If there's any issue with subscription data, use empty list
            pass

        # Get wallet information
        wallet_data = {}
        try:
            from yuuzone.coins.models import UserWallet
            wallet = UserWallet.query.filter_by(user_id=self.id).first()
            if wallet:
                wallet_data = wallet.as_dict()
            else:
                # Create wallet if it doesn't exist
                from yuuzone.coins.service import CoinService
                coin_service = CoinService()
                coin_service.get_or_create_wallet(self.id)
                wallet = UserWallet.query.filter_by(user_id=self.id).first()
                if wallet:
                    wallet_data = wallet.as_dict()
        except Exception:
            # If there's any issue with wallet data, use defaults
            wallet_data = {"coin_balance": 0}

        base = {
            "username": self.username,
            "avatar": self.avatar,
            "bio": self.bio,
            "language_preference": self.language_preference,
            "theme": self.theme,
            "registrationDate": self.registration_date,
            "karma": karma_data,
            "deleted": self.deleted,
            "subscription_types": subscription_types,  # Add subscription information
            "wallet": wallet_data,  # Add wallet information
        }
        if include_all:
            base["id"] = self.id
            # Do NOT include email in API output
            # base["email"] = self.email
        return base


def username_validator(username: str):
    if db.session.query(User).filter(func.lower(User.username) == username.lower()).first():
        raise ValidationError("Username already exists")


def email_validator(email: str):
    if User.query.filter(func.lower(User.email) == email.lower()).first():
        raise ValidationError("Email already exists")


class UserLoginValidator(ma.SQLAlchemySchema):
    class Meta:
        model = User

    email = fields.Email(required=True)
    password = fields.Str(required=True, validate=[fields.validate.Length(min=8)])


class UserRegisterValidator(ma.SQLAlchemySchema):
    class Meta:
        model = User

    username = fields.Str(
        required=True,
        validate=[
            fields.validate.Length(min=4, max=15, error="Username must be between 1 and 50 characters"),
            fields.validate.Regexp(
                "^[a-zA-Z][a-zA-Z0-9_]*$",
                error="Username must start with a letter, and contain only \
                letters, numbers, and underscores.",
            ),
            username_validator,
        ],
    )
    email = fields.Email(required=True, validate=[email_validator])
    password = fields.Str(required=True, validate=[fields.validate.Length(min=8)])


class UsersKarma(db.Model):
    __tablename__: str = "user_info"
    user_id: int = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, primary_key=True)
    user_karma: int = db.Column(db.Integer, nullable=False)
    comments_count: int = db.Column(db.Integer, nullable=False)
    comments_karma: int = db.Column(db.Integer, nullable=False)
    posts_count: int = db.Column(db.Integer, nullable=False)
    posts_karma: int = db.Column(db.Integer, nullable=False)
    user = db.relationship("User", back_populates="user_karma")

    def as_dict(self) -> dict:
        return {
            "user_karma": self.user_karma,
            "comments_count": self.comments_count,
            "comments_karma": self.comments_karma,
            "posts_count": self.posts_count,
            "posts_karma": self.posts_karma,
        }
