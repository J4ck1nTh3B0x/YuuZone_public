import logging
from yuuzone import db, app
import cloudinary.uploader as uploader
import uuid
from PIL import Image, ImageDraw, ImageFont
import io
import random
import requests
import re


class Subthread(db.Model):
    __tablename__ = "subthreads"
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    name = db.Column(db.Text, nullable=False)
    description = db.Column(db.Text)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=db.func.now())
    logo = db.Column(db.Text)
    created_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    user = db.relationship("User", back_populates="subthread")
    user_role = db.relationship("UserRole", back_populates="subthread")
    subscription = db.relationship("Subscription", back_populates="subthread")
    # Note: subthread_info is a view, so no relationship to avoid update conflicts
    post = db.relationship("Posts", back_populates="subthread")
    post_info = db.relationship("PostInfo", back_populates="subthread")

    @classmethod
    def add(cls, form_data, image, created_by):
        """
        Create and add a new Subthread to the database.

        Args:
            form_data (dict): Dictionary containing subthread data, expects 'name', 'description', 'content_type', and 'content_url'.
            image (FileStorage): Image file uploaded for the subthread logo.
            created_by (int): User ID of the creator.

        Returns:
            Subthread: The newly created Subthread object.

        Raises:
            ValueError: If the 'name' field is missing or invalid.
        """
        name = form_data.get("name", "").strip()
        if not name:
            raise ValueError("Subthread name is required. Please enter a name for your subthread.")

        # Validate name length
        if len(name) < 3:
            raise ValueError("Subthread name is too short. Please use at least 3 characters.")
        if len(name) > 30:
            raise ValueError("Subthread name is too long. Please use 30 characters or less.")

        # Validate allowed characters
        if not re.match(r"^[A-Za-z0-9_]+$", name):
            raise ValueError("Invalid characters in subthread name. Only letters, numbers, and underscores are allowed.")

        # Reject names that are only underscores
        if re.fullmatch(r"_+", name):
            raise ValueError("Subthread name cannot contain only underscores. Please include letters or numbers.")

        # Add prefix if not present
        if not name.startswith("t/"):
            name = f"t/{name}"

        # Check if subthread name already exists
        existing_subthread = cls.query.filter_by(name=name).first()
        if existing_subthread:
            raise ValueError(f"The subthread name '{name}' is already taken. Please choose a different name.")

        new_sub = Subthread(
            name=name,
            description=form_data.get("description"),
            created_by=created_by,
        )
        # Handle logo upload (errors are handled within the method)
        new_sub.handle_logo(form_data.get("content_type"), image, form_data.get("content_url"))

        db.session.add(new_sub)
        # Don't commit here - let the caller handle the transaction
        # Note: SubthreadInfo is a view that automatically updates, no manual sync needed

        return new_sub

    def patch(self, form_data, image):
        self.handle_logo(form_data.get("content_type"), image, form_data.get("content_url"))
        if form_data.get("description"):
            self.description = form_data.get("description")
        db.session.commit()
        # Note: SubthreadInfo is a view that automatically updates, no manual sync needed

    def handle_logo(self, content_type, image=None, url=None):
        if content_type == "image" and image:
            try:
                self.delete_logo()
                image_data = uploader.upload(image, public_id=f"{uuid.uuid4().hex}_{image.filename.rsplit('.')[0]}")
                url = f"https://res.cloudinary.com/{app.config['CLOUDINARY_NAME']}/image/upload/f_auto,q_auto/{image_data.get('public_id')}"
                self.logo = url
            except Exception as e:
                error_str = str(e).lower()
                if "nameresolutionerror" in error_str or "lookup timed out" in error_str or "api.cloudinary.com" in error_str:
                    logging.error(f"Error uploading image for subthread {self.name}: Cloudinary connection failed - {e}")
                    #logging.info(f"Using fallback logo for subthread {self.name}")
                    self.logo = self._generate_fallback_logo()
                else:
                    logging.error(f"Error uploading image for subthread {self.name}: {e}")
                    # Don't raise the exception, just set logo to None and continue
                    self.logo = None
        elif content_type == "url" and url:
            # Validate URL points to an image
            try:
                self.delete_logo()
                headers = {
                    "User-Agent": "Mozilla/5.0 (compatible; YuuZoneBot/1.0)"
                }
                response = requests.head(url, headers=headers, allow_redirects=True, timeout=5)
                content_type_header = response.headers.get("Content-Type", "")
                if not content_type_header.startswith("image/"):
                    raise ValueError("That link won't lead up to an image that the code can't download")
                # Download the image content
                response = requests.get(url, headers=headers, stream=True, timeout=10)
                response.raise_for_status()
                image_bytes = response.content
                # Upload to Cloudinary
                image_data = uploader.upload(io.BytesIO(image_bytes), public_id=f"url_upload_{uuid.uuid4().hex}", resource_type="image")
                if not image_data or not image_data.get('public_id'):
                    raise ValueError("Cloudinary upload failed: no public_id returned")
                cloud_url = f"https://res.cloudinary.com/{app.config['CLOUDINARY_NAME']}/image/upload/f_auto,q_auto/{image_data.get('public_id')}"
                self.logo = cloud_url
            except Exception as e:
                error_str = str(e).lower()
                if "nameresolutionerror" in error_str or "lookup timed out" in error_str or "api.cloudinary.com" in error_str:
                    logging.error(f"Error validating or uploading image URL for subthread {self.name}: Cloudinary connection failed - {e}")
                    #logging.info(f"Using fallback logo for subthread {self.name}")
                    self.logo = self._generate_fallback_logo()
                else:
                    logging.error(f"Error validating or uploading image URL for subthread {self.name}: {e}")
                    # Don't raise the exception, just set logo to None and continue
                    self.logo = None
        else:
            try:
                # Generate default logo with pixel art background and first 3 letters
                self.delete_logo()
                img_size = (720, 720)

                # Generate a random base color with good saturation
                import colorsys
                base_hue = random.randint(0, 360)  # Random hue (0-360)
                base_saturation = random.randint(70, 100)  # High saturation (70-100%)
                base_value = random.randint(60, 90)  # Medium-high value (60-90%)

                #logging.info(f"Base color for {self.name}: Hue={base_hue}°, Saturation={base_saturation}%, Value={base_value}%")

                # Create base background color (darker version of the main color)
                bg_r, bg_g, bg_b = colorsys.hsv_to_rgb(base_hue/360, base_saturation/100, max(20, base_value-40)/100)
                background_color = (int(bg_r*255), int(bg_g*255), int(bg_b*255))

                # Create image with tonal background instead of black
                img = Image.new("RGB", img_size, background_color)
                draw = ImageDraw.Draw(img)

                # Generate pixel art background
                pixel_size = 24  # Size of each pixel block (30x30 grid)

                # Create pixelated background with tonal variations
                for y in range(0, img_size[1], pixel_size):
                    for x in range(0, img_size[0], pixel_size):
                        # Always draw a pixel (100% coverage, no black gaps)
                        # Vary only the saturation and value within the same hue tone
                        # Keep hue the same for tonal consistency
                        pixel_hue = base_hue  # Same hue for all pixels

                        # Vary saturation within ±25% of base saturation
                        saturation_variation = 25
                        pixel_saturation = max(30, min(100, base_saturation + random.randint(-saturation_variation, saturation_variation)))

                        # Vary value (brightness) within ±30% of base value
                        value_variation = 30
                        pixel_value = max(25, min(95, base_value + random.randint(-value_variation, value_variation)))

                        # Convert HSV to RGB for this pixel
                        r, g, b = colorsys.hsv_to_rgb(pixel_hue/360, pixel_saturation/100, pixel_value/100)
                        pixel_color = (int(r*255), int(g*255), int(b*255))

                        # Draw the pixel block
                        draw.rectangle([x, y, x + pixel_size - 1, y + pixel_size - 1], fill=pixel_color)

                # Use a random truetype font from 5 main font types (including pixel fonts)
                font_types = [
                    # Type 1: Arial (Sans-serif, clean)
                    [("arial.ttf", "Arial"), ("C:/Windows/Fonts/arial.ttf", "Arial"),
                     ("/System/Library/Fonts/Arial.ttf", "Arial"), ("/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf", "Liberation Sans")],

                    # Type 2: Arial Bold (Sans-serif, bold)
                    [("arialbd.ttf", "Arial Bold"), ("C:/Windows/Fonts/arialbd.ttf", "Arial Bold"),
                     ("/Library/Fonts/Arial Bold.ttf", "Arial Bold"), ("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", "DejaVu Sans Bold")],

                    # Type 3: Times (Serif, classic)
                    [("times.ttf", "Times New Roman"), ("C:/Windows/Fonts/times.ttf", "Times New Roman"),
                     ("/System/Library/Fonts/Times.ttc", "Times"), ("/usr/share/fonts/truetype/liberation/LiberationSerif-Regular.ttf", "Liberation Serif")],

                    # Type 4: Calibri (Modern sans-serif)
                    [("calibri.ttf", "Calibri"), ("C:/Windows/Fonts/calibri.ttf", "Calibri"),
                     ("/System/Library/Fonts/Helvetica.ttc", "Helvetica"), ("/usr/share/fonts/truetype/ubuntu/Ubuntu-R.ttf", "Ubuntu")],

                    # Type 5: Bold serif
                    [("timesbd.ttf", "Times Bold"), ("C:/Windows/Fonts/timesbd.ttf", "Times Bold"),
                     ("/usr/share/fonts/truetype/liberation/LiberationSerif-Bold.ttf", "Liberation Serif Bold"), ("/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf", "DejaVu Serif Bold")]
                ]

                # Randomly select one of the 5 font types
                selected_font_type = random.choice(font_types)

                # Shuffle the options within the selected type
                random.shuffle(selected_font_type)

                font = None
                font_name = "Default"

                # Calculate font size to make text 88% of logo size
                target_size = int(img_size[0] * 0.88)  # 88% of 720 = 633 pixels

                # Try to load fonts from the selected type in random order
                for font_path, name in selected_font_type:
                    try:
                        font = ImageFont.truetype(font_path, 500)  # Start with very large font
                        font_name = name
                        #logging.info(f"Using font '{name}' for subthread {self.name}")
                        break
                    except (IOError, OSError):
                        continue

                # Fallback to default font if none found
                if font is None:
                    font = ImageFont.load_default()
                    font_name = "Default"
                    #logging.info(f"Using default font for subthread {self.name}")

                text = (self.name[2:5].upper() if len(self.name) > 4 else self.name[2:].upper()) or "SUB"

                # Dynamically adjust font size to make text 88% of logo size
                if font and hasattr(font, 'path'):
                    #logging.info(f"Adjusting font size to make text 88% of logo size for {self.name}...")

                    # Binary search for optimal font size
                    min_size = 50
                    max_size = 800
                    optimal_size = 500

                    for _ in range(15):  # Max 15 iterations
                        try:
                            test_font = ImageFont.truetype(font.path, optimal_size)

                            # Get text dimensions
                            try:
                                bbox = draw.textbbox((0, 0), text, font=test_font)
                                text_width = bbox[2] - bbox[0]
                                text_height = bbox[3] - bbox[1]
                            except AttributeError:
                                text_width, text_height = draw.textsize(text, font=test_font)

                            # Check if text size is close to 88% of logo
                            max_dimension = max(text_width, text_height)

                            if abs(max_dimension - target_size) < 15:  # Close enough
                                font = test_font
                                #logging.info(f"Optimal font size found: {optimal_size}px (text size: {max_dimension}px) for {self.name}")
                                break
                            elif max_dimension < target_size:
                                min_size = optimal_size
                            else:
                                max_size = optimal_size

                            optimal_size = (min_size + max_size) // 2

                        except (IOError, OSError):
                            break
                # Use textbbox for newer Pillow versions (10.0.0+), fallback to textsize for older versions
                try:
                    bbox = draw.textbbox((0, 0), text, font=font)
                    text_width = bbox[2] - bbox[0]
                    text_height = bbox[3] - bbox[1]
                except AttributeError:
                    # Fallback for older Pillow versions that still have textsize
                    try:
                        text_width, text_height = draw.textsize(text, font=font)
                    except AttributeError:
                        # Ultimate fallback if neither method exists - estimate text size
                        logging.warning(f"Neither textbbox nor textsize available, using estimated text size for {self.name}")
                        # Rough estimation for massive font: assume each character is about 300 pixels wide and 500 pixels tall
                        text_width = len(text) * 300
                        text_height = 500
                text_x = (img_size[0] - text_width) / 2
                text_y = (img_size[1] - text_height) / 2

                # Draw text with black outline for better visibility on pixel background
                # Much larger outline proportional to massive text size
                outline_offset = max(20, int(max(text_width, text_height) * 0.03))  # 3% of text size
                #logging.info(f"Using outline offset: {outline_offset}px for text size: {max(text_width, text_height)}px on {self.name}")

                for offset_x, offset_y in [(0, outline_offset), (outline_offset, 0),
                                          (0, -outline_offset), (-outline_offset, 0),
                                          (outline_offset, outline_offset), (-outline_offset, -outline_offset),
                                          (outline_offset, -outline_offset), (-outline_offset, outline_offset)]:
                    draw.text((text_x + offset_x, text_y + offset_y), text, font=font, fill=(0, 0, 0))

                # Draw main text with white color
                draw.text((text_x, text_y), text, font=font, fill=(255, 255, 255))

                # Save image to bytes buffer
                buffer = io.BytesIO()
                img.save(buffer, format="PNG")
                buffer.seek(0)

                # Upload to Cloudinary
                image_data = uploader.upload(buffer, public_id=f"default_logo_{uuid.uuid4().hex}", resource_type="image")
                if not image_data or not image_data.get('public_id'):
                    raise ValueError("Cloudinary upload failed: no public_id returned")
                url = f"https://res.cloudinary.com/{app.config['CLOUDINARY_NAME']}/image/upload/f_auto,q_auto/{image_data.get('public_id')}"
                self.logo = url
            except Exception as e:
                error_str = str(e).lower()
                if "nameresolutionerror" in error_str or "lookup timed out" in error_str or "api.cloudinary.com" in error_str:
                    logging.error(f"Error generating or uploading default logo for subthread {self.name}: Cloudinary connection failed - {e}")
                    #logging.info(f"Setting fallback logo URL for subthread {self.name}")
                    # Use a fallback logo URL or generate a simple data URL
                    self.logo = self._generate_fallback_logo()
                else:
                    logging.error(f"Error generating or uploading default logo for subthread {self.name}: Unexpected error - {e}")
                    # Don't raise the exception, just set logo to None and continue
                    self.logo = None

    def _generate_fallback_logo(self):
        """Generate a simple fallback logo when Cloudinary is unavailable"""
        try:
            # Create a simple colored square with text as base64 data URL
            import base64
            img_size = (200, 200)
            background_color = tuple(random.randint(100, 200) for _ in range(3))
            img = Image.new("RGB", img_size, background_color)
            draw = ImageDraw.Draw(img)

            # Get text from subthread name
            text = (self.name[2:5].upper() if len(self.name) > 4 else self.name[2:].upper()) or "SUB"

            # Use default font
            try:
                font = ImageFont.load_default()
            except:
                font = None

            # Calculate text position
            if font:
                bbox = draw.textbbox((0, 0), text, font=font)
                text_width = bbox[2] - bbox[0]
                text_height = bbox[3] - bbox[1]
            else:
                text_width, text_height = 60, 20  # Approximate default size

            x = (img_size[0] - text_width) // 2
            y = (img_size[1] - text_height) // 2

            # Draw text
            text_color = (255, 255, 255)  # White text
            if font:
                draw.text((x, y), text, fill=text_color, font=font)
            else:
                draw.text((x, y), text, fill=text_color)

            # Convert to base64 data URL
            buffer = io.BytesIO()
            img.save(buffer, format="PNG")
            img_data = base64.b64encode(buffer.getvalue()).decode()
            return f"data:image/png;base64,{img_data}"

        except Exception as e:
            logging.error(f"Failed to generate fallback logo: {e}")
            # Return a simple placeholder URL
            return "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjY2NjIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIyNCIgZmlsbD0iIzMzMyIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkxPR088L3RleHQ+PC9zdmc+"

    def delete_logo(self):
        if self.logo and self.logo.startswith(f"https://res.cloudinary.com/{app.config['CLOUDINARY_NAME']}"):
            # Extract public_id from URL correctly by removing the base URL and transformations
            try:
                base_url = f"https://res.cloudinary.com/{app.config['CLOUDINARY_NAME']}/image/upload/"
                public_id_with_ext = self.logo[len(base_url):]
                # Remove any transformations (e.g., f_auto,q_auto) by splitting on '/'
                parts = public_id_with_ext.split('/')
                # The public_id is everything after transformations joined by '/'
                # Find index of last transformation segment (usually last before public_id)
                # Here, assume transformations end before the public_id which includes extension
                # So join all parts after transformations
                # For simplicity, join all parts after last transformation segment
                # Usually transformations are at the start, so public_id is last part(s)
                public_id = '/'.join(parts[-1:])
                # Remove file extension if present
                if '.' in public_id:
                    public_id = public_id.rsplit('.', 1)[0]
                res = uploader.destroy(public_id)
                # print(f"fCloudinary Image Destroy Response for {self.name}: ", res)
            except Exception as e:
                logging.error(f"Error deleting Cloudinary image for {self.name}: {e}")

    def as_dict(self, cur_user_id=None):
        data = {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "created_at": self.created_at,
            "logo": self.logo,
            "PostsCount": 0,
            "CommentsCount": 0,
            "created_by": None,
            "subscriberCount": 0,
            "modList": [],
        }
        
        # Safely count posts and comments
        try:
            if self.post:
                data["PostsCount"] = len(self.post)
                # Count comments more carefully to avoid triggering media_items relationship
                comments_count = 0
                for p in self.post:
                    try:
                        if hasattr(p, 'comment') and p.comment:
                            comments_count += len(p.comment)
                    except Exception as e:
                        logging.error(f"Error counting comments for post {p.id}: {e}")
                        continue
                data["CommentsCount"] = comments_count
        except Exception as e:
            logging.error(f"Error counting posts/comments in Subthread.as_dict: {e}")
        
        # Safely count subscribers
        try:
            if self.subscription:
                data["subscriberCount"] = len(self.subscription)
        except Exception as e:
            logging.error(f"Error counting subscribers in Subthread.as_dict: {e}")
        
        try:
            if self.user and self.user.username:
                data["created_by"] = self.user.username
            if self.user_role:
                data["modList"] = [r.user.username for r in self.user_role if r.role and r.role.slug == "mod" and r.user]
        except Exception as e:
            logging.error(f"Error in Subthread.as_dict: {e}")
            # Ensure modList is always an array even if there's an error
            data["modList"] = []

        if cur_user_id:
            try:
                from yuuzone.subthreads.models import Subscription, SubthreadBan
                data["has_subscribed"] = bool(
                    Subscription.query.filter_by(user_id=cur_user_id, subthread_id=self.id).first()
                )
                banned = SubthreadBan.query.filter_by(user_id=cur_user_id, subthread_id=self.id).first()
                data["is_banned"] = bool(banned)
            except Exception as e:
                logging.error(f"Error checking subscription or ban status in Subthread.as_dict: {e}")

        return data

    def __init__(self, name, created_by, description=None, logo=None):
        self.name = name
        self.description = description
        self.logo = logo
        self.created_by = created_by


class Subscription(db.Model):
    __tablename__ = "subscriptions"
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    subthread_id = db.Column(db.Integer, db.ForeignKey("subthreads.id"), nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=db.func.now())
    user = db.relationship("User", back_populates="subscription")
    subthread = db.relationship("Subthread", back_populates="subscription")

    @classmethod
    def add(cls, thread_id, user_id):
        new_sub = Subscription(user_id=user_id, subthread_id=thread_id)
        db.session.add(new_sub)
        # Don't commit here - let the caller handle the transaction

    def __init__(self, user_id, subthread_id):
        self.user_id = user_id
        self.subthread_id = subthread_id


class SubthreadBan(db.Model):
    __tablename__ = "subthread_bans"
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    subthread_id = db.Column(db.Integer, db.ForeignKey("subthreads.id"), nullable=False)
    banned_at = db.Column(db.DateTime(timezone=True), nullable=False, default=db.func.now())
    banned_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    reason = db.Column(db.Text, nullable=False, default="Unspecific Ban Reason")

    __table_args__ = (
        db.UniqueConstraint("user_id", "subthread_id", name="subthread_bans_user_subthread_unique"),
    )

    def __init__(self, user_id, subthread_id, banned_by, reason="Unspecific Ban Reason"):
        self.user_id = user_id
        self.subthread_id = subthread_id
        self.banned_by = banned_by
        self.reason = reason

    def as_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "subthread_id": self.subthread_id,
            "banned_at": self.banned_at.isoformat() if self.banned_at else None,
            "banned_by": self.banned_by,
            "reason": self.reason
        }


class SubthreadInfo(db.Model):
    __tablename__ = "subthread_info"
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    name = db.Column(db.Text)  # Remove foreign key since this is a view
    logo = db.Column(db.Text)
    members_count = db.Column(db.Integer)
    posts_count = db.Column(db.Integer)
    comments_count = db.Column(db.Integer)
    # Note: No relationship since this is a view, not a table

    def as_dict(self, user_id=None):
        """
        Convert the SubthreadInfo instance to a dictionary.
        Optionally include user-specific data if user_id is provided.
        """
        result = {
            "id": self.id,
            "name": self.name,
            "logo": self.logo,
            "subscriberCount": self.members_count or 0,
            "PostsCount": self.posts_count or 0,
            "CommentsCount": self.comments_count or 0,
        }
        if user_id is not None:
            # Add user-specific data to the dictionary
            result['user_id'] = user_id
        return result
