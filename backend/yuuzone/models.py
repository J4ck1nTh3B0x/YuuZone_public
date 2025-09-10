from yuuzone import db
from datetime import datetime


class Role(db.Model):
    __tablename__: str = "roles"
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    name = db.Column(db.Text, nullable=False)
    slug = db.Column(db.Text, unique=True, nullable=False)
    user_role = db.relationship("UserRole", back_populates="role")


class UserRole(db.Model):
    __tablename__ = "user_roles"
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    role_id = db.Column(db.Integer, db.ForeignKey("roles.id"), nullable=False)
    subthread_id = db.Column(db.Integer, db.ForeignKey("subthreads.id"))
    user = db.relationship("User", back_populates="user_role")
    role = db.relationship("Role", back_populates="user_role")
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=db.func.now())
    subthread = db.relationship("Subthread", back_populates="user_role")

    __table_args__ = (
        db.UniqueConstraint("user_id", "role_id", "subthread_id", name="user_roles_user_id_role_id_subthread_id_key"),
    )

    def __init__(self, user_id: int, subthread_id: int, role_id: int) -> None:
        self.user_id = user_id
        self.subthread_id = subthread_id
        self.role_id = role_id

    @classmethod
    def add_moderator(cls, user_id, subthread_id):
        check_mod = UserRole.query.filter_by(user_id=user_id, subthread_id=subthread_id, role_id=1).first()
        if check_mod:
            return  # Already exists, do nothing
        new_mod = UserRole(user_id=user_id, subthread_id=subthread_id, role_id=1)
        db.session.add(new_mod)
        # Don't commit here - let the caller handle the transaction

    @classmethod
    def add_admin(cls, user_id, subthread_id):
        if subthread_id is None:
            raise ValueError("subthread_id must be specified for admin role")
        check_admin = UserRole.query.filter_by(user_id=user_id, subthread_id=subthread_id, role_id=2).first()
        if check_admin:
            return  # Already exists, do nothing
        new_admin = UserRole(user_id=user_id, subthread_id=subthread_id, role_id=2)
        db.session.add(new_admin)
        # Don't commit here - let the caller handle the transaction

    def as_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "role_id": self.role_id,
            "subthread_id": self.subthread_id,
        }

# Coin System Models
class UserWallet(db.Model):
    __tablename__ = "user_wallets"
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    coin_balance = db.Column(db.Integer, nullable=False, default=0)
    created_at = db.Column(db.DateTime(timezone=True), default=datetime.utcnow)
    updated_at = db.Column(db.DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = db.relationship("User", backref="wallet")

    def as_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "coin_balance": self.coin_balance,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }

class CoinTransaction(db.Model):
    __tablename__ = "coin_transactions"
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    transaction_type = db.Column(db.String(50), nullable=False)
    amount = db.Column(db.Integer, nullable=False)
    balance_after = db.Column(db.Integer, nullable=False)
    reference_id = db.Column(db.Integer)
    reference_type = db.Column(db.String(50))
    description = db.Column(db.Text)
    created_at = db.Column(db.DateTime(timezone=True), default=datetime.utcnow)

    # Relationships
    user = db.relationship("User", backref="coin_transactions")

    def as_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "transaction_type": self.transaction_type,
            "amount": self.amount,
            "balance_after": self.balance_after,
            "reference_id": self.reference_id,
            "reference_type": self.reference_type,
            "description": self.description,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }

class CoinPackage(db.Model):
    __tablename__ = "coin_packages"
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    name = db.Column(db.String(100), nullable=False)
    coin_amount = db.Column(db.Integer, nullable=False)
    price_vnd = db.Column(db.Integer, nullable=False)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime(timezone=True), default=datetime.utcnow)
    updated_at = db.Column(db.DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    def as_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "coin_amount": self.coin_amount,
            "price_vnd": self.price_vnd,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }

class AvatarCategory(db.Model):
    __tablename__ = "avatar_categories"
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime(timezone=True), default=datetime.utcnow)
    updated_at = db.Column(db.DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    avatar_items = db.relationship("AvatarItem", backref="category", lazy="dynamic")

    def as_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }

class AvatarItem(db.Model):
    __tablename__ = "avatar_items"
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    category_id = db.Column(db.Integer, db.ForeignKey("avatar_categories.id"), nullable=False)
    name = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    image_url = db.Column(db.Text, nullable=False)
    price_coins = db.Column(db.Integer, nullable=False)
    is_active = db.Column(db.Boolean, default=True)
    created_by = db.Column(db.Integer, db.ForeignKey("users.id"))
    created_at = db.Column(db.DateTime(timezone=True), default=datetime.utcnow)
    updated_at = db.Column(db.DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    creator = db.relationship("User", backref="created_avatars")

    def as_dict(self):
        return {
            "id": self.id,
            "category_id": self.category_id,
            "category_name": self.category.name if self.category else None,
            "name": self.name,
            "description": self.description,
            "image_url": self.image_url,
            "price_coins": self.price_coins,
            "is_active": self.is_active,
            "created_by": self.created_by,
            "creator_name": self.creator.username if self.creator else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }

class UserAvatar(db.Model):
    __tablename__ = "user_avatars"
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    avatar_id = db.Column(db.Integer, db.ForeignKey("avatar_items.id"), nullable=False)
    is_equipped = db.Column(db.Boolean, default=False)
    purchased_at = db.Column(db.DateTime(timezone=True), default=datetime.utcnow)

    # Relationships
    user = db.relationship("User", backref="owned_avatars")
    avatar_item = db.relationship("AvatarItem", backref="owners")

    def as_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "avatar_id": self.avatar_id,
            "avatar_data": self.avatar_item.as_dict() if self.avatar_item else None,
            "is_equipped": self.is_equipped,
            "purchased_at": self.purchased_at.isoformat() if self.purchased_at else None
        }

class PostBoost(db.Model):
    __tablename__ = "post_boosts"
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    post_id = db.Column(db.Integer, db.ForeignKey("posts.id"), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    boost_start = db.Column(db.DateTime(timezone=True), default=datetime.utcnow)
    boost_end = db.Column(db.DateTime(timezone=True), nullable=False)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime(timezone=True), default=datetime.utcnow)

    # Relationships
    post = db.relationship("Posts", backref="boosts")
    user = db.relationship("User", backref="post_boosts")

    def as_dict(self):
        return {
            "id": self.id,
            "post_id": self.post_id,
            "user_id": self.user_id,
            "boost_start": self.boost_start.isoformat() if self.boost_start else None,
            "boost_end": self.boost_end.isoformat() if self.boost_end else None,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }

class CoinPayment(db.Model):
    __tablename__ = "coin_payments"
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    package_id = db.Column(db.Integer, db.ForeignKey("coin_packages.id"), nullable=False)
    amount_vnd = db.Column(db.Integer, nullable=False)
    coin_amount = db.Column(db.Integer, nullable=False)
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
    is_first_purchase = db.Column(db.Boolean, default=False)

    # Relationships
    user = db.relationship("User", backref="coin_payments")
    package = db.relationship("CoinPackage")

    def as_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "package_id": self.package_id,
            "package_name": self.package.name if self.package else None,
            "amount_vnd": self.amount_vnd if self.amount_vnd else 0,
            "coin_amount": self.coin_amount,
            "currency": self.currency,
            "payment_status": self.payment_status,
            "payment_method": self.payment_method,
            "payment_url": self.payment_url,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "paid_at": self.paid_at.isoformat() if self.paid_at else None,
            "expires_at": self.expires_at.isoformat() if self.expires_at else None,
            "notes": self.notes,
            "is_first_purchase": self.is_first_purchase
        }
