from yuuzone import db
from datetime import datetime, date
import hashlib

class TranslationUsage(db.Model):
    __tablename__ = "translation_usage"
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    post_id = db.Column(db.Integer, db.ForeignKey("posts.id"), nullable=True)
    comment_id = db.Column(db.Integer, db.ForeignKey("comments.id"), nullable=True)
    source_language = db.Column(db.String(10), nullable=False)
    target_language = db.Column(db.String(10), nullable=False)
    original_text = db.Column(db.Text, nullable=False)
    translated_text = db.Column(db.Text, nullable=False)
    translation_method = db.Column(db.String(50), nullable=False)
    confidence_score = db.Column(db.Float, nullable=True)
    translated_at = db.Column(db.DateTime(timezone=True), nullable=False, default=datetime.utcnow)

    def __init__(self, user_id, source_language, target_language, original_text, translated_text, translation_method, post_id=None, comment_id=None, confidence_score=None):
        self.user_id = user_id
        self.source_language = source_language
        self.target_language = target_language
        self.original_text = original_text
        self.translated_text = translated_text
        self.translation_method = translation_method
        self.post_id = post_id
        self.comment_id = comment_id
        self.confidence_score = confidence_score

    def as_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "post_id": self.post_id,
            "comment_id": self.comment_id,
            "source_language": self.source_language,
            "target_language": self.target_language,
            "original_text": self.original_text,
            "translated_text": self.translated_text,
            "translation_method": self.translation_method,
            "confidence_score": self.confidence_score,
            "translated_at": self.translated_at.isoformat(),
        }

class TranslationLimits(db.Model):
    __tablename__ = "translation_limits"
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    role_slug = db.Column(db.String(20), nullable=False)
    monthly_limit = db.Column(db.Integer, nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime(timezone=True), nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    def as_dict(self):
        return {
            "id": self.id,
            "role_slug": self.role_slug,
            "monthly_limit": self.monthly_limit,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }

class UserTranslationStats(db.Model):
    __tablename__ = "user_translation_stats"
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    year_month = db.Column(db.String(7), nullable=False, default=lambda: datetime.utcnow().strftime('%Y-%m'))
    translations_used = db.Column(db.Integer, nullable=False, default=0)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime(timezone=True), nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    def as_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "year_month": self.year_month,
            "translations_used": self.translations_used,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }

class TranslationCache(db.Model):
    __tablename__ = "translation_cache"
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    content_hash = db.Column(db.String(64), nullable=True)
    source_language = db.Column(db.String(10), nullable=True)
    target_language = db.Column(db.String(10), nullable=True)
    original_text = db.Column(db.Text, nullable=True)
    translated_text = db.Column(db.Text, nullable=True)
    translation_method = db.Column(db.String(50), nullable=True)
    confidence_score = db.Column(db.Float, nullable=True)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    last_used = db.Column(db.DateTime(timezone=True), nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    usage_count = db.Column(db.Integer, nullable=False, default=1)

    def __init__(self, content_hash, source_language, target_language, 
                 original_text, translated_text, translation_method, confidence_score=None):
        self.content_hash = content_hash
        self.source_language = source_language
        self.target_language = target_language
        self.original_text = original_text
        self.translated_text = translated_text
        self.translation_method = translation_method
        self.confidence_score = confidence_score

    def as_dict(self):
        return {
            "id": self.id,
            "content_hash": self.content_hash,
            "source_language": self.source_language,
            "target_language": self.target_language,
            "original_text": self.original_text,
            "translated_text": self.translated_text,
            "translation_method": self.translation_method,
            "confidence_score": self.confidence_score,
            "created_at": self.created_at.isoformat(),
            "last_used": self.last_used.isoformat(),
            "usage_count": self.usage_count
        }

    @staticmethod
    def generate_content_hash(text):
        """Generate a hash for the content to check if it has changed"""
        return hashlib.sha256(text.encode('utf-8')).hexdigest()
