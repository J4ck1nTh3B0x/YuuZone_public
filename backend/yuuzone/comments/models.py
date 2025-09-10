from yuuzone import db
from yuuzone.reactions.models import Reactions


class Comments(db.Model):
    __tablename__ = "comments"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"))
    post_id = db.Column(db.Integer, db.ForeignKey("posts.id"))
    parent_id = db.Column(db.Integer, db.ForeignKey("comments.id"))
    is_edited = db.Column(db.Boolean, default=False)
    has_parent = db.Column(db.Boolean)
    content = db.Column(db.Text)
    media = db.Column(db.Text)  # Keep for backward compatibility
    created_at = db.Column(
        db.DateTime(timezone=True), nullable=False, default=db.func.now()
    )
    updated_at = db.Column(
        db.DateTime(timezone=True), nullable=False, default=db.func.now(), onupdate=db.func.now()
    )
    reaction = db.relationship("Reactions", back_populates="comment")
    user = db.relationship("User", back_populates="comment")
    post = db.relationship("Posts", back_populates="comment")
    comment_info = db.relationship("CommentInfo", back_populates="comment")
    media_items = db.relationship("Media", back_populates="comment", cascade="all, delete-orphan", lazy="select")

    @classmethod
    def add(cls, form_data, user_id):
        new_comment = Comments(
            user_id=user_id,
            content=form_data["content"],
            post_id=form_data["post_id"],
        )
        # Fix: Check for has_parent as string or boolean
        has_parent = form_data.get("has_parent", False)
        if has_parent and (has_parent is True or has_parent == "true" or has_parent == True):
            new_comment.has_parent = True
            new_comment.parent_id = form_data["parent_id"]
        else:
            new_comment.has_parent = False
            new_comment.parent_id = None
        
        db.session.add(new_comment)
        db.session.commit()
        
        # Handle media if provided
        if form_data.get("media_list"):
            from yuuzone.posts.models import Media
            Media.add_media(form_data["media_list"], comment_id=new_comment.id)
        
        return new_comment.comment_info[0].as_dict(user_id)

    def patch(self, content):
        if content:
            self.content = content
            self.is_edited = True
            self.updated_at = db.func.now()
            db.session.commit()

    def get_all_media(self):
        """Get all media items for this comment, including the legacy media field"""
        media_list = []
        
        # Add legacy media if it exists
        if self.media:
            media_list.append({
                'url': self.media,
                'type': 'image' if self.media.lower().endswith(('.jpg', '.jpeg', '.png', '.gif', '.webp')) else 'video',
                'order': 0
            })
        
        # Add new media items - handle cases where relationship might not be loaded
        try:
            for media_item in self.media_items:
                media_list.append({
                    'url': media_item.media_url,
                    'type': media_item.media_type,
                    'order': media_item.media_order
                })
        except Exception as e:
            # If relationship is not loaded, try to query directly
            try:
                from yuuzone.posts.models import Media
                media_items = Media.query.filter_by(comment_id=self.id).order_by(Media.media_order).all()
                for media_item in media_items:
                    media_list.append({
                        'url': media_item.media_url,
                        'type': media_item.media_type,
                        'order': media_item.media_order
                    })
            except Exception as query_error:
                # If query fails, just return the legacy media
                pass
        
        # Sort by order
        media_list.sort(key=lambda x: x['order'])
        return media_list

    def __init__(self, user_id, content, post_id=None, has_parent=None, parent_id=None):
        self.user_id = user_id
        self.post_id = post_id
        self.content = content
        self.has_parent = has_parent
        self.parent_id = parent_id


class CommentInfo(db.Model):
    __tablename__ = "comment_info"
    comment_id = db.Column(db.Integer, db.ForeignKey("comments.id"), primary_key=True)
    user_name = db.Column(db.Text)
    user_avatar = db.Column(db.Text)
    comment_karma = db.Column(db.Integer)
    has_parent = db.Column(db.Boolean)
    parent_id = db.Column(db.Integer)
    content = db.Column(db.Text)
    is_edited = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime(timezone=True))
    post_id = db.Column(db.Integer, db.ForeignKey("posts.id"))
    post = db.relationship("Posts", back_populates="comment_info")
    comment = db.relationship("Comments", back_populates="comment_info")

    def as_dict(self, cur_user):
        # Get author's roles in this subthread
        author_roles = []
        if self.comment and self.comment.user:
            from yuuzone.models import UserRole
            user_roles = UserRole.query.filter_by(
                user_id=self.comment.user.id,
                subthread_id=self.post.subthread_id
            ).join(UserRole.role).all()

            for user_role in user_roles:
                if user_role.role.slug in ["admin", "mod"]:
                    author_roles.append(user_role.role.slug)

        # Get author's subscription types
        subscription_types = []
        if self.comment and self.comment.user:
            from yuuzone.subscriptions.service import SubscriptionService
            subscription_service = SubscriptionService()
            subscription_types = subscription_service.get_user_subscription_types(self.comment.user.id)

        # Handle deleted users - show content but with deleted user styling
        user_name = self.user_name
        user_avatar = self.user_avatar
        
        # Check if user is deleted (has del_ prefix or deleted flag)
        is_deleted_user = False
        if self.comment and self.comment.user and (self.comment.user.deleted or (self.user_name and self.user_name.startswith("del_"))):
            is_deleted_user = True
            # For deleted users, set user_name to None so frontend shows [deleted]
            user_name = None
            # Use default avatar for deleted users
            user_avatar = None

        # Get all media for this comment
        all_media = []
        legacy_media = None
        
        if self.comment:
            try:
                all_media = self.comment.get_all_media()
                # Safely access the media field
                legacy_media = getattr(self.comment, 'media', None)
            except Exception as e:
                # If there's an error accessing the comment relationship, try to get media directly
                try:
                    from yuuzone.posts.models import Media
                    media_items = Media.query.filter_by(comment_id=self.comment_id).order_by(Media.media_order).all()
                    for media_item in media_items:
                        all_media.append({
                            'url': media_item.media_url,
                            'type': media_item.media_type,
                            'order': media_item.media_order
                        })
                except Exception:
                    # If all else fails, just continue with empty media
                    pass

        comment_info = {
            "user_info": {
                "user_name": user_name,
                "user_avatar": user_avatar,
                "roles": author_roles,  # Add role information
                "subscription_types": subscription_types,  # Add subscription information
            },
            "comment_info": {
                "id": self.comment_id,
                "content": self.content,
                "created_at": self.created_at.isoformat() if self.created_at else None,
                "comment_karma": self.comment_karma,
                "has_parent": self.has_parent,
                "is_edited": self.is_edited,
                "parent_id": self.parent_id,
                "media": legacy_media,  # Keep for backward compatibility
                "all_media": all_media,  # New field for multiple media
            },
        }
        if cur_user:
            has_reaction = Reactions.query.filter_by(comment_id=self.comment_id, user_id=cur_user).first()
            comment_info["current_user"] = {
                "has_upvoted": has_reaction.is_upvote if has_reaction else None,
            }
        return comment_info
