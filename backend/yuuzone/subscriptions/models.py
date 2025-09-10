from yuuzone import db
from datetime import datetime, timedelta

class UserTier(db.Model):
    __tablename__ = "user_tiers"
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    name = db.Column(db.String(50), nullable=False)
    slug = db.Column(db.String(50), nullable=False, unique=True)
    price_monthly = db.Column(db.Numeric(10, 2), nullable=False)
    max_subthreads = db.Column(db.Integer)
    can_custom_theme = db.Column(db.Boolean, default=False)
    description = db.Column(db.Text)
    features = db.Column(db.JSON)
    created_at = db.Column(db.DateTime(timezone=True), default=datetime.utcnow)

    def as_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "slug": self.slug,
            "price_monthly": float(self.price_monthly) if self.price_monthly else 0,
            "max_subthreads": self.max_subthreads,
            "can_custom_theme": self.can_custom_theme,
            "description": self.description,
            "features": self.features,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }

class UserSubscription(db.Model):
    __tablename__ = "user_subscriptions"
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    tier_id = db.Column(db.Integer, db.ForeignKey("user_tiers.id"), nullable=False)
    payment_id = db.Column(db.Integer, db.ForeignKey("payments.id"))
    starts_at = db.Column(db.DateTime(timezone=True), default=datetime.utcnow)
    expires_at = db.Column(db.DateTime(timezone=True), nullable=False)
    is_active = db.Column(db.Boolean, default=True)
    auto_renew = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime(timezone=True), default=datetime.utcnow)
    cancelled_at = db.Column(db.DateTime(timezone=True))

    # Relationships
    user = db.relationship("User", backref="subscriptions")
    tier = db.relationship("UserTier")
    payment = db.relationship("Payment")

    def as_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "tier_id": self.tier_id,
            "tier_slug": self.tier.slug if self.tier else None,
            "tier_name": self.tier.name if self.tier else None,
            "payment_id": self.payment_id,
            "starts_at": self.starts_at.isoformat() if self.starts_at else None,
            "expires_at": self.expires_at.isoformat() if self.expires_at else None,
            "is_active": self.is_active_status,
            "auto_renew": self.auto_renew,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "cancelled_at": self.cancelled_at.isoformat() if self.cancelled_at else None,
            "days_remaining": self.days_remaining
        }

    @property
    def is_active_status(self):
        from datetime import timezone
        now = datetime.now(timezone.utc)
        return self.is_active and now < self.expires_at

    @property
    def days_remaining(self):
        if not self.is_active_status:
            return 0
        from datetime import timezone
        now = datetime.now(timezone.utc)
        remaining = self.expires_at - now
        return max(0, remaining.days)

class Payment(db.Model):
    __tablename__ = "payments"
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    tier_id = db.Column(db.Integer, db.ForeignKey("user_tiers.id"), nullable=False)
    amount = db.Column(db.Numeric(10, 2), nullable=False)
    currency = db.Column(db.String(3), default='VND')
    momo_order_id = db.Column(db.String(100))
    momo_request_id = db.Column(db.String(100))
    momo_trans_id = db.Column(db.String(100))
    payment_status = db.Column(db.String(20), default='pending')
    payment_method = db.Column(db.String(50), default='momo')
    payment_url = db.Column(db.Text)
    created_at = db.Column(db.DateTime(timezone=True), default=datetime.utcnow)
    paid_at = db.Column(db.DateTime(timezone=True))
    expires_at = db.Column(db.DateTime(timezone=True))
    callback_data = db.Column(db.JSON)
    notes = db.Column(db.Text)

    # Relationships
    user = db.relationship("User", backref="payments")
    tier = db.relationship("UserTier")

    def as_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "tier_id": self.tier_id,
            "amount": float(self.amount) if self.amount else 0,
            "currency": self.currency,
            "payment_status": self.payment_status,
            "payment_method": self.payment_method,
            "payment_url": self.payment_url,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "paid_at": self.paid_at.isoformat() if self.paid_at else None,
            "expires_at": self.expires_at.isoformat() if self.expires_at else None,
            "notes": self.notes,
            # Add tier information for Pay Now functionality
            "tier_name": self.tier.name if self.tier else None,
            "tier_slug": self.tier.slug if self.tier else None,
            # Add QR URL generation for Pay Now functionality
            "qr_url": self._generate_qr_url() if self.payment_status == 'pending' else None,
            "package_name": self.tier.name if self.tier else None
        }
    
    def _generate_qr_url(self):
        """Generate QR URL for pending payments"""
        try:
            if self.payment_status == 'pending' and self.amount:
                payment_reference = self.notes.replace('Payment reference: ', '') if self.notes else None
                if payment_reference:
                    return f"https://qr.sepay.vn/img?acc=94120903912&bank=TPBank&amount={int(float(self.amount))}&des={payment_reference}"
        except Exception:
            pass
        return None

class UserCustomTheme(db.Model):
    __tablename__ = "custom_themes"
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    theme_name = db.Column(db.String(100), nullable=False)
    theme_data = db.Column(db.JSON, nullable=False)  # Store color palette as JSON
    is_active = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime(timezone=True), default=datetime.utcnow)
    updated_at = db.Column(db.DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    def as_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "theme_name": self.theme_name,
            "theme_data": self.theme_data,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        } 