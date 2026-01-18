from marshmallow import validate
from yuuzone import db, ma, app
import uuid
from flask import url_for
from datetime import datetime, timedelta
import cloudinary.uploader as uploader
from werkzeug.utils import secure_filename
from yuuzone.subthreads.models import Subthread
from flask_marshmallow.fields import fields
from marshmallow.exceptions import ValidationError
from yuuzone.reactions.models import Reactions
import logging
import io


class Media(db.Model):
    __tablename__ = "media"
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    post_id = db.Column(db.Integer, db.ForeignKey("posts.id"))
    comment_id = db.Column(db.Integer, db.ForeignKey("comments.id"))
    media_url = db.Column(db.Text, nullable=False)
    media_type = db.Column(db.Text, nullable=False)  # 'image', 'video', 'gif'
    media_order = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=db.func.now())
    
    post = db.relationship("Posts", back_populates="media_items")
    comment = db.relationship("Comments", back_populates="media_items")

    def __init__(self, media_url, media_type, post_id=None, comment_id=None, media_order=0):
        self.media_url = media_url
        self.media_type = media_type
        self.post_id = post_id
        self.comment_id = comment_id
        self.media_order = media_order

    @classmethod
    def add_media(cls, media_list, post_id=None, comment_id=None):
        """Add multiple media items to a post or comment"""
        media_items = []
        for i, media_data in enumerate(media_list):
            media_item = cls(
                media_url=media_data['url'],
                media_type=media_data['type'],
                post_id=post_id,
                comment_id=comment_id,
                media_order=i
            )
            db.session.add(media_item)
            media_items.append(media_item)
        
        db.session.commit()
        return media_items

    @classmethod
    def get_media_for_post(cls, post_id):
        """Get all media items for a post, ordered by media_order"""
        return cls.query.filter_by(post_id=post_id).order_by(cls.media_order).all()

    @classmethod
    def get_media_for_comment(cls, comment_id):
        """Get all media items for a comment, ordered by media_order"""
        return cls.query.filter_by(comment_id=comment_id).order_by(cls.media_order).all()

    @classmethod
    def delete_media_for_post(cls, post_id):
        """Delete all media items for a post"""
        cls.query.filter_by(post_id=post_id).delete()
        db.session.commit()

    @classmethod
    def delete_media_for_comment(cls, comment_id):
        """Delete all media items for a comment"""
        cls.query.filter_by(comment_id=comment_id).delete()
        db.session.commit()


class Posts(db.Model):
    __tablename__ = "posts"
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"))
    subthread_id = db.Column(db.Integer, db.ForeignKey("subthreads.id"))
    title = db.Column(db.Text, nullable=False)
    media = db.Column(db.Text)  # Keep for backward compatibility
    is_edited = db.Column(db.Boolean, default=False)
    content = db.Column(db.Text)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=db.func.now())
    user = db.relationship("User", back_populates="post")
    subthread = db.relationship("Subthread", back_populates="post")
    post_info = db.relationship("PostInfo", back_populates="post")
    reaction = db.relationship("Reactions", back_populates="post")
    comment = db.relationship("Comments", back_populates="post")
    comment_info = db.relationship("CommentInfo", back_populates="post")
    saved_post = db.relationship("SavedPosts", back_populates="post")
    media_items = db.relationship("Media", back_populates="post", cascade="all, delete-orphan", lazy="select")

    def get_media(self):
        # After migration, all media should be HTTP URLs
        # If there's still legacy media that doesn't start with http, it's likely a local file that needs to be handled
        if self.media and not self.media.startswith("http"):
            # Check if there's a corresponding media item in the new system
            try:
                from yuuzone.posts.models import Media
                media_item = Media.query.filter_by(post_id=self.id).first()
                if media_item:
                    return media_item.media_url
                else:
                    # If no media item found, return the original media (might be a local file path)
                    # This should be rare after migration, but handle it gracefully
                    return self.media
            except Exception:
                # If query fails, return the original media
                return self.media
        return self.media

    def get_all_media(self):
        """Get all media items for this post, including the legacy media field"""
        media_list = []
        
        # First, try to get new media items from the media table
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
                media_items = Media.query.filter_by(post_id=self.id).order_by(Media.media_order).all()
                for media_item in media_items:
                    media_list.append({
                        'url': media_item.media_url,
                        'type': media_item.media_type,
                        'order': media_item.media_order
                    })
            except Exception as query_error:
                # If query fails, continue to legacy media
                pass
        
        # If no new media items found, fall back to legacy media
        if not media_list and self.media:
            media_list.append({
                'url': self.get_media(),
                'type': 'image' if self.media.lower().endswith(('.jpg', '.jpeg', '.png', '.gif', '.webp')) else 'video',
                'order': 0
            })
        
        # Sort by order
        media_list.sort(key=lambda x: x['order'])
        return media_list

    def patch(self, form_data, image):
        import logging

        try:
            # Update basic fields
            self.content = form_data.get("content", self.content)
            self.title = form_data.get("title", self.title)

            # Handle media update (most likely to fail)
            self.handle_media(form_data.get("content_type"), image, form_data.get("content_url"))

            # Mark as edited and commit
            self.is_edited = True
            db.session.commit()

            #logging.info(f"Post patched successfully: ID {self.id}")

        except ValueError as ve:
            # Handle validation errors (from handle_media)
            db.session.rollback()
            logging.error(f"Post patch failed - validation error for post {self.id}: {ve}")
            raise ve

        except Exception as e:
            # Handle database or other unexpected errors
            db.session.rollback()
            logging.error(f"Post patch failed - unexpected error for post {self.id}: {e}")
            raise ValueError(f"Failed to update post: {str(e)}")

    @classmethod
    def add(cls, form_data, images, user_id):
        # Create new post instance
        new_post = Posts(
            user_id=user_id,
            subthread_id=form_data.get("subthread_id"),
            title=form_data.get("title"),
        )

        try:
            # Handle media upload first (most likely to fail)
            new_post.handle_media(form_data.get("content_type"), images, form_data.get("content_url"))

            # Set content if provided
            if form_data.get("content"):
                new_post.content = form_data.get("content")

            # Add to session and commit
            db.session.add(new_post)
            db.session.commit()

            # After commit, handle any temporary media that was stored
            if hasattr(new_post, '_temp_media_list') and new_post._temp_media_list:
                Media.add_media(new_post._temp_media_list, post_id=new_post.id)
                # Clean up the temporary attribute
                delattr(new_post, '_temp_media_list')

            #logging.info(f"Post added successfully: ID {new_post.id}, Title: {new_post.title}")
            return new_post

        except ValueError as ve:
            # Handle validation errors (from handle_media or other validation)
            db.session.rollback()
            logging.error(f"Post creation failed - validation error: {ve}")
            raise ve

        except Exception as e:
            # Handle database or other unexpected errors
            db.session.rollback()
            logging.error(f"Post creation failed - unexpected error: {e}")
            raise ValueError(f"Failed to create post: {str(e)}")

    def handle_media(self, content_type, images=None, urls=None):
        import logging

        # Clear existing media items only if this is an existing post (has an ID)
        if self.id:
            Media.delete_media_for_post(self.id)

        if content_type == "media" and images:
            try:
                self.delete_media()
                media_list = []
                
                # Handle multiple images
                if isinstance(images, list):
                    image_files = images
                else:
                    image_files = [images]
                
                for i, image in enumerate(image_files):
                    if not image:
                        continue
                        
                    filename = secure_filename(image.filename)
                    media_type = 'image' if image.content_type.startswith("image/") else 'video'
                    
                    if image.content_type.startswith("image/"):
                        try:
                            image_data = uploader.upload(
                                image,
                                public_id=f"{uuid.uuid4().hex}_{filename.rsplit('.')[0]}",
                            )
                            if not image_data or not image_data.get('public_id'):
                                raise ValueError("Cloudinary upload failed: no public_id returned")
                            url = f"https://res.cloudinary.com/{app.config['CLOUDINARY_NAME']}/image/upload/c_auto,g_auto/{image_data.get('public_id')}"
                            media_list.append({
                                'url': url,
                                'type': media_type
                            })
                        except Exception as e:
                            logging.error(f"Failed to upload image to Cloudinary: {e}")
                            raise ValueError(f"Failed to upload image: {str(e)}")

                    elif image.content_type.startswith("video/"):
                        try:
                            video_data = uploader.upload(
                                image,
                                resource_type="video",
                                public_id=f"{uuid.uuid4().hex}_{filename.rsplit('.')[0]}",
                            )
                            if not video_data or not video_data.get('playback_url'):
                                raise ValueError("Cloudinary video upload failed: no playback_url returned")
                            url = video_data.get("playback_url")
                            media_list.append({
                                'url': url,
                                'type': media_type
                            })
                        except Exception as e:
                            logging.error(f"Failed to upload video to Cloudinary: {e}")
                            raise ValueError(f"Failed to upload video: {str(e)}")
                    else:
                        raise ValueError(f"Unsupported media type: {image.content_type}")

                # Add media items to database only if post has an ID
                if media_list and self.id:
                    Media.add_media(media_list, post_id=self.id)
                    # Set the first media as legacy media for backward compatibility
                    self.media = media_list[0]['url']
                elif media_list:
                    # For new posts, store the media list temporarily
                    # It will be added to the database after the post is committed
                    self._temp_media_list = media_list
                    # Set the first media as legacy media for backward compatibility
                    self.media = media_list[0]['url']

            except ValueError:
                raise
            except Exception as e:
                logging.error(f"Unexpected error in handle_media: {e}")
                raise ValueError(f"Media processing failed: {str(e)}")

        elif content_type == "url" and urls:
            try:
                from yuuzone.utils.security import SecureURLValidator, URLUploadRateLimit

                # Check rate limit for this user (if user_id is available)
                if hasattr(self, 'user_id') and self.user_id:
                    URLUploadRateLimit.check_rate_limit(self.user_id)

                media_list = []
                
                # Handle multiple URLs
                if isinstance(urls, list):
                    url_list = urls
                else:
                    url_list = [urls]
                
                for i, url in enumerate(url_list):
                    if not url or not url.strip():
                        continue
                        
                    # Validate media URL (supports images, videos, and platforms)
                    media_info = SecureURLValidator.validate_media_url(url)

                    if media_info['type'] == 'video_platform':
                        # For video platforms (YouTube, Vimeo, etc.), store the URL directly
                        media_list.append({
                            'url': media_info['url'],
                            'type': 'video'
                        })

                    elif media_info['type'] == 'video':
                        # For direct video URLs, store the URL directly (don't download)
                        media_list.append({
                            'url': media_info['url'],
                            'type': 'video'
                        })

                    elif media_info['type'] == 'image' and media_info['needs_download']:
                        # For images, download and upload to Cloudinary
                        image_bytes = SecureURLValidator.safe_download_image(url)

                        # Upload to Cloudinary
                        image_data = uploader.upload(
                            io.BytesIO(image_bytes),
                            public_id=f"secure_url_upload_{uuid.uuid4().hex}",
                            resource_type="image"
                        )
                        if not image_data or not image_data.get('public_id'):
                            raise ValueError("Cloudinary upload failed: no public_id returned")

                        # Use the Cloudinary URL with auto optimization
                        cloud_url = f"https://res.cloudinary.com/{app.config['CLOUDINARY_NAME']}/image/upload/c_auto,g_auto/{image_data.get('public_id')}"
                        media_list.append({
                            'url': cloud_url,
                            'type': 'image'
                        })

                    else:
                        # For other image types that don't need download
                        media_list.append({
                            'url': media_info['url'],
                            'type': 'image'
                        })

                # Add media items to database
                if media_list:
                    Media.add_media(media_list, post_id=self.id)
                    # Set the first media as legacy media for backward compatibility
                    self.media = media_list[0]['url']

            except ValueError as e:
                # Security or validation error - log and re-raise with user-friendly message
                logging.warning(f"URL validation failed for {urls}: {e}")
                raise ValueError(f"URL validation failed: {str(e)}")
            except Exception as e:
                logging.error(f"Failed to process media URL: {e}")
                raise ValueError(f"Failed to process media: {str(e)}")

    def __init__(self, user_id, subthread_id, title, media=None, content=None):
        self.user_id = user_id
        self.subthread_id = subthread_id
        self.title = title
        self.media = media
        self.content = content

    def delete_media(self):
        if self.media and self.media.startswith(f"https://res.cloudinary.com/{app.config['CLOUDINARY_NAME']}"):
            res = uploader.destroy(self.media.split("/")[-1])
            # print(f"fCloudinary Image Destory Response for {self.title}: ", res)

    def as_dict(self):
        return {
            "post_id": self.id,
            "is_edited": self.is_edited,
            "user_id": self.user_id,
            "subthread_id": self.subthread_id,
            "title": self.title,
            "media": self.get_media(),
            "content": self.content,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class SavedPosts(db.Model):
    __tablename__ = "saved"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"))
    post_id = db.Column(db.Integer, db.ForeignKey("posts.id"))
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=db.func.now())
    user = db.relationship("User", back_populates="saved_post")
    post = db.relationship("Posts", back_populates="saved_post")

    def __init__(self, user_id, post_id):
        self.user_id = user_id
        self.post_id = post_id


class PostInfo(db.Model):
    __tablename__ = "post_info"
    thread_id = db.Column(db.Integer, db.ForeignKey("subthreads.id"))
    thread_name = db.Column(db.Text)
    thread_logo = db.Column(db.Text)
    post_id = db.Column(db.Integer, db.ForeignKey("posts.id"), primary_key=True)
    title = db.Column(db.Text)
    is_edited = db.Column(db.Boolean, default=False)
    media = db.Column(db.Text)
    content = db.Column(db.Text)
    created_at = db.Column(db.DateTime(timezone=True))
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"))
    user_name = db.Column(db.Text)
    user_avatar = db.Column(db.Text)
    post_karma = db.Column(db.Integer)
    comments_count = db.Column(db.Integer)
    post = db.relationship("Posts", back_populates="post_info")
    subthread = db.relationship("Subthread", back_populates="post_info")
    user = db.relationship("User", back_populates="post_info")

    def as_dict(self, cur_user=None):
        # Get author's roles in this subthread
        author_roles = []
        if self.user:
            from yuuzone.models import UserRole
            user_roles = UserRole.query.filter_by(
                user_id=self.user.id,
                subthread_id=self.thread_id
            ).join(UserRole.role).all()

            for user_role in user_roles:
                if user_role.role.slug in ["admin", "mod"]:
                    author_roles.append(user_role.role.slug)

        # Get author's subscription types
        subscription_types = []
        if self.user:
            from yuuzone.subscriptions.service import SubscriptionService
            subscription_service = SubscriptionService()
            subscription_types = subscription_service.get_user_subscription_types(self.user.id)

        # Handle deleted users - show content but with deleted user styling
        user_name = self.user_name
        user_avatar = self.user_avatar
        
        # Check if user is deleted (has del_ prefix or deleted flag)
        is_deleted_user = False
        if self.user and (self.user.deleted or (self.user_name and self.user_name.startswith("del_"))):
            is_deleted_user = True
            # For deleted users, set user_name to None so frontend shows [deleted]
            user_name = None
            # Use default avatar for deleted users
            user_avatar = None

        # Get all media for this post
        all_media = []
        if self.post:
            all_media = self.post.get_all_media()

        # Calculate upvotes and downvotes from reactions
        from yuuzone.reactions.models import Reactions
        upvotes_count = Reactions.query.filter_by(post_id=self.post_id, is_upvote=True).count()
        downvotes_count = Reactions.query.filter_by(post_id=self.post_id, is_upvote=False).count()

        p_info = {
            "user_info": {
                "user_name": user_name,
                "user_avatar": user_avatar,
                "roles": author_roles,  # Add role information
                "subscription_types": subscription_types,  # Add subscription information
            },
            "thread_info": {
                "thread_id": self.thread_id,
                "thread_name": self.thread_name,
                "thread_logo": self.thread_logo,
            },
            "post_info": {
                "id": self.post_id,
                "title": self.title,
                "media": self.media,  # Keep for backward compatibility
                "all_media": all_media,  # New field for multiple media
                "is_edited": self.is_edited,
                "content": self.content,
                "created_at": self.created_at,
                "post_karma": self.post_karma,
                "upvotes": upvotes_count,
                "downvotes": downvotes_count,
                "comments_count": self.comments_count,
            },
        }
        if cur_user:
            has_reaction = Reactions.query.filter_by(post_id=self.post_id, user_id=cur_user).first()
            p_info["current_user"] = {
                "has_upvoted": has_reaction.is_upvote if has_reaction else None,
                "saved": bool(SavedPosts.query.filter_by(user_id=cur_user, post_id=self.post_id).first()),
            }
        return p_info


def doesSubthreadExist(subthread_id):
    if not Subthread.query.filter_by(id=subthread_id).first():
        raise ValidationError("Subthread does not exist")


class PostValidator(ma.SQLAlchemySchema):
    class Meta:
        model = Posts

    subthread_id = fields.Int(required=True, validate=[doesSubthreadExist])
    title = fields.Str(required=True, validate=validate.Length(min=1, max=256))
    content = fields.Str(required=False)


def get_filters(sortby, duration):
    sortBy, durationBy = None, None
    match sortby:
        case "top":
            sortBy = PostInfo.post_karma.desc()
        case "new":
            sortBy = PostInfo.created_at.desc()
        case "hot":
            sortBy = PostInfo.comments_count.desc()
        case _:
            raise Exception("Invalid Sortby Request")
    match duration:
        case "day":
            durationBy = PostInfo.created_at.between(datetime.now() - timedelta(days=1), datetime.now())
        case "week":
            durationBy = PostInfo.created_at.between(datetime.now() - timedelta(days=7), datetime.now())
        case "month":
            durationBy = PostInfo.created_at.between(datetime.now() - timedelta(days=30), datetime.now())
        case "year":
            durationBy = PostInfo.created_at.between(datetime.now() - timedelta(days=365), datetime.now())
        case "alltime":
            durationBy = True
        case _:
            raise Exception("Invalid Duration Request")
    return sortBy, durationBy
