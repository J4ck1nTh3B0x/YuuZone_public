from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
from yuuzone.coins.service import CoinService
from yuuzone.auth.decorators import super_manager_required
from yuuzone.subscriptions.service import SubscriptionService
import logging
import time

coins_bp = Blueprint('coins', __name__)
coin_service = CoinService()

@coins_bp.route('/wallet', methods=['GET'])
@login_required
def get_wallet():
    """Get user's coin wallet balance"""
    try:
        # Add rate limiting - only allow one request per 5 seconds per user
        from yuuzone.utils.rate_limiter import rate_limiter
        
        # Check rate limit manually
        if rate_limiter.is_rate_limited('wallet'):
            remaining_time = rate_limiter.get_reset_time('wallet')
            return jsonify({
                'success': False,
                'error': 'Rate limited. Please wait before checking wallet again.',
                'remaining_time': remaining_time
            }), 429
        
        balance = coin_service.get_wallet_balance(current_user.id)
        return jsonify({
            'success': True,
            'balance': balance
        })
    except Exception as e:
        logging.error(f"Error getting wallet: {e}")
        return jsonify({
            'success': False,
            'error': 'Failed to get wallet balance'
        }), 500

@coins_bp.route('/transactions', methods=['GET'])
@login_required
def get_transactions():
    """Get user's transaction history"""
    try:
        limit = request.args.get('limit', 50, type=int)
        offset = request.args.get('offset', 0, type=int)
        
        transactions = coin_service.get_user_transactions(current_user.id, limit, offset)
        return jsonify({
            'success': True,
            'transactions': transactions
        })
    except Exception as e:
        logging.error(f"Error getting transactions: {e}")
        return jsonify({
            'success': False,
            'error': 'Failed to get transactions'
        }), 500

@coins_bp.route('/packages', methods=['GET'])
def get_coin_packages():
    """Get available coin packages"""
    try:
        packages = coin_service.get_coin_packages()
        return jsonify({
            'success': True,
            'packages': packages
        })
    except Exception as e:
        logging.error(f"Error getting coin packages: {e}")
        return jsonify({
            'success': False,
            'error': 'Failed to get coin packages'
        }), 500

@coins_bp.route('/purchase', methods=['POST'])
@login_required
def purchase_coins():
    """Purchase coins"""
    try:
        data = request.get_json()
        package_id = data.get('package_id')
        
        if not package_id:
            return jsonify({
                'success': False,
                'error': 'Package ID is required'
            }), 400
        
        payment = coin_service.purchase_coins(current_user.id, package_id)
        
        # Generate payment QR using existing subscription service
        subscription_service = SubscriptionService()
        qr_data = subscription_service.generate_coin_payment_qr(
            current_user.username, payment.id
        )
        
        return jsonify({
            'success': True,
            'payment': payment.as_dict(),
            'qr_data': qr_data
        })
    except Exception as e:
        logging.error(f"Error purchasing coins: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@coins_bp.route('/tip', methods=['POST'])
@login_required
def tip_user():
    """Send coins to another user"""
    try:
        data = request.get_json()
        to_username = data.get('to_username')
        amount = data.get('amount')
        
        if not to_username or not amount:
            return jsonify({
                'success': False,
                'error': 'Username and amount are required'
            }), 400
        
        if amount <= 0:
            return jsonify({
                'success': False,
                'error': 'Amount must be positive'
            }), 400
        
        # Get target user
        from yuuzone.users.models import User
        to_user = User.query.filter_by(username=to_username).first()
        if not to_user:
            return jsonify({
                'success': False,
                'error': 'User not found'
            }), 404
        
        # Transfer coins
        coin_service.transfer_coins(current_user.id, to_user.id, amount)
        
        return jsonify({
            'success': True,
            'message': f'Successfully sent {amount} coins to {to_username}'
        })
    except Exception as e:
        logging.error(f"Error tipping user: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@coins_bp.route('/avatars', methods=['GET'])
def get_avatars():
    """Get available avatars"""
    try:
        user_id = current_user.id if current_user.is_authenticated else None
        avatars = coin_service.get_available_avatars(user_id)
        
        return jsonify({
            'success': True,
            'avatars': avatars
        })
    except Exception as e:
        logging.error(f"Error getting avatars: {e}")
        return jsonify({
            'success': False,
            'error': 'Failed to get avatars'
        }), 500

@coins_bp.route('/avatars/purchase', methods=['POST'])
@login_required
def purchase_avatar():
    """Purchase avatar with coins"""
    try:
        data = request.get_json()
        avatar_id = data.get('avatar_id')
        
        if not avatar_id:
            return jsonify({
                'success': False,
                'error': 'Avatar ID is required'
            }), 400
        
        user_avatar = coin_service.purchase_avatar(current_user.id, avatar_id)
        
        return jsonify({
            'success': True,
            'user_avatar': user_avatar.as_dict(),
            'message': 'Avatar purchased successfully'
        })
    except Exception as e:
        logging.error(f"Error purchasing avatar: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@coins_bp.route('/avatars/equip', methods=['PUT'])
@login_required
def equip_avatar():
    """Equip an owned avatar"""
    try:
        data = request.get_json()
        avatar_id = data.get('avatar_id')
        
        if not avatar_id:
            return jsonify({
                'success': False,
                'error': 'Avatar ID is required'
            }), 400
        
        user_avatar = coin_service.equip_avatar(current_user.id, avatar_id)
        
        return jsonify({
            'success': True,
            'user_avatar': user_avatar.as_dict(),
            'message': 'Avatar equipped successfully'
        })
    except Exception as e:
        logging.error(f"Error equipping avatar: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@coins_bp.route('/avatars/owned', methods=['GET'])
@login_required
def get_owned_avatars():
    """Get user's owned avatars"""
    try:
        avatars = coin_service.get_user_avatars(current_user.id)
        
        return jsonify({
            'success': True,
            'avatars': avatars
        })
    except Exception as e:
        logging.error(f"Error getting owned avatars: {e}")
        return jsonify({
            'success': False,
            'error': 'Failed to get owned avatars'
        }), 500

@coins_bp.route('/posts/boost', methods=['POST'])
@login_required
def boost_post():
    """Boost a post"""
    try:
        data = request.get_json()
        post_id = data.get('post_id')
        
        if not post_id:
            return jsonify({
                'success': False,
                'error': 'Post ID is required'
            }), 400
        
        boost = coin_service.boost_post(current_user.id, post_id)
        
        return jsonify({
            'success': True,
            'boost': boost.as_dict(),
            'message': 'Post boosted successfully'
        })
    except Exception as e:
        logging.error(f"Error boosting post: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@coins_bp.route('/posts/boosted', methods=['GET'])
def get_boosted_posts():
    """Get currently boosted posts"""
    try:
        boosted_posts = coin_service.get_boosted_posts()
        
        return jsonify({
            'success': True,
            'boosted_posts': boosted_posts
        })
    except Exception as e:
        logging.error(f"Error getting boosted posts: {e}")
        return jsonify({
            'success': False,
            'error': 'Failed to get boosted posts'
        }), 500

@coins_bp.route('/tier/purchase', methods=['POST'])
@login_required
def purchase_tier_with_coins():
    """Purchase tier subscription with coins"""
    try:
        data = request.get_json()
        tier_slug = data.get('tier_slug')
        
        if not tier_slug:
            return jsonify({
                'success': False,
                'error': 'Tier slug is required'
            }), 400
        
        subscription = coin_service.purchase_tier_with_coins(current_user.id, tier_slug)
        
        return jsonify({
            'success': True,
            'subscription': subscription,
            'message': 'Tier purchased successfully with coins'
        })
    except Exception as e:
        logging.error(f"Error purchasing tier with coins: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

# SuperManager routes for avatar management
@coins_bp.route('/admin/avatar-categories', methods=['GET'])
@super_manager_required
def get_avatar_categories():
    """Get all avatar categories (SuperManager only)"""
    try:
        from yuuzone.coins.models import AvatarCategory
        categories = AvatarCategory.query.all()
        
        return jsonify({
            'success': True,
            'categories': [category.as_dict() for category in categories]
        })
    except Exception as e:
        logging.error(f"Error getting avatar categories: {e}")
        return jsonify({
            'success': False,
            'error': 'Failed to get avatar categories'
        }), 500

@coins_bp.route('/admin/avatar-categories', methods=['POST'])
@super_manager_required
def create_avatar_category():
    """Create new avatar category (SuperManager only)"""
    try:
        data = request.get_json()
        name = data.get('name')
        description = data.get('description', '')
        
        if not name:
            return jsonify({
                'success': False,
                'error': 'Category name is required'
            }), 400
        
        from yuuzone.coins.models import AvatarCategory
        category = AvatarCategory(name=name, description=description)
        
        from yuuzone import db
        db.session.add(category)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'category': category.as_dict(),
            'message': 'Avatar category created successfully'
        })
    except Exception as e:
        logging.error(f"Error creating avatar category: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@coins_bp.route('/admin/avatars', methods=['POST'])
@super_manager_required
def create_avatar():
    """Create new avatar with URL (SuperManager only) - Auto uploads to Cloudinary"""
    try:
        data = request.get_json()
        category_id = data.get('category_id')
        name = data.get('name')
        description = data.get('description', '')
        image_url = data.get('image_url')
        price_coins = data.get('price_coins')
        
        if not all([category_id, name, image_url, price_coins]):
            return jsonify({
                'success': False,
                'error': 'All fields are required'
            }), 400
        
        # Download and upload image to Cloudinary
        import cloudinary.uploader
        import requests
        import io
        import uuid
        
        try:
            # Download the image from the URL
            headers = {
                "User-Agent": "Mozilla/5.0 (compatible; YuuZoneBot/1.0)"
            }
            response = requests.get(image_url, headers=headers, stream=True, timeout=10)
            response.raise_for_status()
            
            # Check if it's actually an image
            content_type = response.headers.get('content-type', '')
            if not content_type.startswith('image/'):
                return jsonify({
                    'success': False,
                    'error': 'URL does not point to a valid image'
                }), 400
            
            # Upload to Cloudinary
            image_bytes = response.content
            upload_result = cloudinary.uploader.upload(
                io.BytesIO(image_bytes),
                folder="yuuzone/avatars",
                public_id=f"avatar_url_{current_user.id}_{uuid.uuid4().hex}",
                overwrite=True,
                resource_type="image"
            )
            
            # Use the Cloudinary URL
            cloudinary_url = upload_result['secure_url']
            
        except requests.RequestException as e:
            return jsonify({
                'success': False,
                'error': f'Failed to download image from URL: {str(e)}'
            }), 400
        except Exception as e:
            return jsonify({
                'success': False,
                'error': f'Failed to upload image to Cloudinary: {str(e)}'
            }), 500
        
        from yuuzone.coins.models import AvatarItem
        avatar = AvatarItem(
            category_id=category_id,
            name=name,
            description=description,
            image_url=cloudinary_url,  # Use Cloudinary URL instead of original URL
            price_coins=price_coins,
            created_by=current_user.id
        )
        
        from yuuzone import db
        db.session.add(avatar)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'avatar': avatar.as_dict(),
            'message': 'Avatar created successfully and uploaded to Cloudinary'
        })
    except Exception as e:
        logging.error(f"Error creating avatar: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@coins_bp.route('/admin/avatars/upload', methods=['POST'])
@super_manager_required
def upload_avatar():
    """Upload new avatar with file (SuperManager only)"""
    try:
        # Check if image file was uploaded
        if 'image' not in request.files:
            return jsonify({
                'success': False,
                'error': 'No image file provided'
            }), 400
        
        image_file = request.files['image']
        
        # Check if file is empty
        if image_file.filename == '':
            return jsonify({
                'success': False,
                'error': 'No image file selected'
            }), 400
        
        # Check file type
        allowed_extensions = {'png', 'jpg', 'jpeg', 'gif', 'webp'}
        if not ('.' in image_file.filename and 
                image_file.filename.rsplit('.', 1)[1].lower() in allowed_extensions):
            return jsonify({
                'success': False,
                'error': 'Invalid file type. Allowed: PNG, JPG, JPEG, GIF, WebP'
            }), 400
        
        # Get form data
        name = request.form.get('name')
        description = request.form.get('description', '')
        price_coins = request.form.get('price_coins')
        category_id = request.form.get('category_id')
        
        if not all([name, price_coins, category_id]):
            return jsonify({
                'success': False,
                'error': 'Name, price, and category are required'
            }), 400
        
        # Upload to Cloudinary
        import cloudinary.uploader
        upload_result = cloudinary.uploader.upload(
            image_file,
            folder="yuuzone/avatars",
            public_id=f"avatar_{current_user.id}_{int(time.time())}",
            overwrite=True,
            resource_type="image"
        )
        
        image_url = upload_result['secure_url']
        
        # Create avatar record
        from yuuzone.coins.models import AvatarItem
        avatar = AvatarItem(
            category_id=category_id,
            name=name,
            description=description,
            image_url=image_url,
            price_coins=price_coins,
            created_by=current_user.id
        )
        
        from yuuzone import db
        db.session.add(avatar)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'avatar': avatar.as_dict(),
            'message': 'Avatar uploaded successfully'
        })
    except Exception as e:
        logging.error(f"Error uploading avatar: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@coins_bp.route('/admin/avatars/<int:avatar_id>', methods=['PUT'])
@super_manager_required
def update_avatar(avatar_id):
    """Update avatar (SuperManager only)"""
    try:
        from yuuzone.coins.models import AvatarItem
        avatar = AvatarItem.query.get(avatar_id)
        
        if not avatar:
            return jsonify({
                'success': False,
                'error': 'Avatar not found'
            }), 404
        
        # Handle both JSON and form data
        if request.content_type and 'application/json' in request.content_type:
            data = request.get_json()
        else:
            data = request.form.to_dict()
        
        if 'name' in data:
            avatar.name = data['name']
        if 'description' in data:
            avatar.description = data['description']
        if 'price_coins' in data:
            avatar.price_coins = int(data['price_coins'])
        if 'is_active' in data:
            avatar.is_active = bool(data['is_active'])
        
        # Handle image upload if provided
        if 'image' in request.files:
            image_file = request.files['image']
            if image_file.filename != '':
                # Check file type
                allowed_extensions = {'png', 'jpg', 'jpeg', 'gif', 'webp'}
                if not ('.' in image_file.filename and 
                        image_file.filename.rsplit('.', 1)[1].lower() in allowed_extensions):
                    return jsonify({
                        'success': False,
                        'error': 'Invalid file type. Allowed: PNG, JPG, JPEG, GIF, WebP'
                    }), 400
                
                # Upload to Cloudinary
                import cloudinary.uploader
                upload_result = cloudinary.uploader.upload(
                    image_file,
                    folder="yuuzone/avatars",
                    public_id=f"avatar_{current_user.id}_{int(time.time())}",
                    overwrite=True,
                    resource_type="image"
                )
                
                avatar.image_url = upload_result['secure_url']
        elif 'image_url' in data:
            # Download and upload new image to Cloudinary
            import cloudinary.uploader
            import requests
            import io
            import uuid
            
            try:
                # Download the image from the URL
                headers = {
                    "User-Agent": "Mozilla/5.0 (compatible; YuuZoneBot/1.0)"
                }
                response = requests.get(data['image_url'], headers=headers, stream=True, timeout=10)
                response.raise_for_status()
                
                # Check if it's actually an image
                content_type = response.headers.get('content-type', '')
                if not content_type.startswith('image/'):
                    return jsonify({
                        'success': False,
                        'error': 'URL does not point to a valid image'
                    }), 400
                
                # Upload to Cloudinary
                image_bytes = response.content
                upload_result = cloudinary.uploader.upload(
                    io.BytesIO(image_bytes),
                    folder="yuuzone/avatars",
                    public_id=f"avatar_update_{current_user.id}_{uuid.uuid4().hex}",
                    overwrite=True,
                    resource_type="image"
                )
                
                # Use the Cloudinary URL
                avatar.image_url = upload_result['secure_url']
                
            except requests.RequestException as e:
                return jsonify({
                    'success': False,
                    'error': f'Failed to download image from URL: {str(e)}'
                }), 400
            except Exception as e:
                return jsonify({
                    'success': False,
                    'error': f'Failed to upload image to Cloudinary: {str(e)}'
                }), 500
        
        from yuuzone import db
        db.session.commit()
        
        return jsonify({
            'success': True,
            'avatar': avatar.as_dict(),
            'message': 'Avatar updated successfully'
        })
    except Exception as e:
        logging.error(f"Error updating avatar: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@coins_bp.route('/admin/coin-packages', methods=['GET'])
@super_manager_required
def get_coin_packages_admin():
    """Get all coin packages (SuperManager only)"""
    try:
        from yuuzone.coins.models import CoinPackage
        packages = CoinPackage.query.all()
        
        return jsonify({
            'success': True,
            'packages': [package.as_dict() for package in packages]
        })
    except Exception as e:
        logging.error(f"Error getting coin packages: {e}")
        return jsonify({
            'success': False,
            'error': 'Failed to get coin packages'
        }), 500

@coins_bp.route('/admin/coin-packages', methods=['POST'])
@super_manager_required
def create_coin_package():
    """Create new coin package (SuperManager only)"""
    try:
        data = request.get_json()
        name = data.get('name')
        coin_amount = data.get('coin_amount')
        price_vnd = data.get('price_vnd')
        
        if not all([name, coin_amount, price_vnd]):
            return jsonify({
                'success': False,
                'error': 'All fields are required'
            }), 400
        
        from yuuzone.coins.models import CoinPackage
        package = CoinPackage(
            name=name,
            coin_amount=coin_amount,
            price_vnd=price_vnd
        )
        
        from yuuzone import db
        db.session.add(package)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'package': package.as_dict(),
            'message': 'Coin package created successfully'
        })
    except Exception as e:
        logging.error(f"Error creating coin package: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@coins_bp.route('/admin/coin-packages/<int:package_id>', methods=['PUT'])
@super_manager_required
def update_coin_package(package_id):
    """Update coin package (SuperManager only)"""
    try:
        from yuuzone.coins.models import CoinPackage
        package = CoinPackage.query.get(package_id)
        
        if not package:
            return jsonify({
                'success': False,
                'error': 'Package not found'
            }), 404
        
        data = request.get_json()
        
        if 'name' in data:
            package.name = data['name']
        if 'coin_amount' in data:
            package.coin_amount = data['coin_amount']
        if 'price_vnd' in data:
            package.price_vnd = data['price_vnd']
        if 'is_active' in data:
            package.is_active = data['is_active']
        
        from yuuzone import db
        db.session.commit()
        
        return jsonify({
            'success': True,
            'package': package.as_dict(),
            'message': 'Coin package updated successfully'
        })
    except Exception as e:
        logging.error(f"Error updating coin package: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@coins_bp.route('/admin/coin-packages/<int:package_id>', methods=['DELETE'])
@super_manager_required
def delete_coin_package(package_id):
    """Delete coin package (SuperManager only)"""
    try:
        from yuuzone.coins.models import CoinPackage
        package = CoinPackage.query.get(package_id)
        
        if not package:
            return jsonify({
                'success': False,
                'error': 'Package not found'
            }), 404
        
        from yuuzone import db
        db.session.delete(package)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Coin package deleted successfully'
        })
    except Exception as e:
        logging.error(f"Error deleting coin package: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@coins_bp.route('/admin/avatar-categories/<int:category_id>', methods=['DELETE'])
@super_manager_required
def delete_avatar_category(category_id):
    """Delete avatar category (SuperManager only)"""
    try:
        from yuuzone.coins.models import AvatarCategory, AvatarItem
        category = AvatarCategory.query.get(category_id)
        
        if not category:
            return jsonify({
                'success': False,
                'error': 'Category not found'
            }), 404
        
        # Check if category has avatars
        avatars_count = AvatarItem.query.filter_by(category_id=category_id).count()
        if avatars_count > 0:
            return jsonify({
                'success': False,
                'error': f'Cannot delete category with {avatars_count} avatars. Please remove avatars first.'
            }), 400
        
        from yuuzone import db
        db.session.delete(category)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Avatar category deleted successfully'
        })
    except Exception as e:
        logging.error(f"Error deleting avatar category: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@coins_bp.route('/admin/avatar-categories/<int:category_id>', methods=['PUT'])
@super_manager_required
def update_avatar_category(category_id):
    """Update avatar category (SuperManager only)"""
    try:
        from yuuzone.coins.models import AvatarCategory
        category = AvatarCategory.query.get(category_id)
        
        if not category:
            return jsonify({
                'success': False,
                'error': 'Category not found'
            }), 404
        
        data = request.get_json()
        
        if 'name' in data:
            category.name = data['name']
        if 'description' in data:
            category.description = data['description']
        if 'is_active' in data:
            category.is_active = data['is_active']
        
        from yuuzone import db
        db.session.commit()
        
        return jsonify({
            'success': True,
            'category': category.as_dict(),
            'message': 'Avatar category updated successfully'
        })
    except Exception as e:
        logging.error(f"Error updating avatar category: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@coins_bp.route('/admin/avatar-categories/<int:category_id>/avatars', methods=['GET'])
@super_manager_required
def get_avatars_by_category(category_id):
    """Get avatars by category (SuperManager only)"""
    try:
        from yuuzone.coins.models import AvatarItem, AvatarCategory
        category = AvatarCategory.query.get(category_id)
        
        if not category:
            return jsonify({
                'success': False,
                'error': 'Category not found'
            }), 404
        
        avatars = AvatarItem.query.filter_by(category_id=category_id).all()
        
        return jsonify({
            'success': True,
            'category': category.as_dict(),
            'avatars': [avatar.as_dict() for avatar in avatars]
        })
    except Exception as e:
        logging.error(f"Error getting avatars by category: {e}")
        return jsonify({
            'success': False,
            'error': 'Failed to get avatars by category'
        }), 500

@coins_bp.route('/admin/avatars/<int:avatar_id>', methods=['DELETE'])
@super_manager_required
def delete_avatar(avatar_id):
    """Delete avatar (SuperManager only)"""
    try:
        from yuuzone.coins.models import AvatarItem, UserAvatar
        avatar = AvatarItem.query.get(avatar_id)
        
        if not avatar:
            return jsonify({
                'success': False,
                'error': 'Avatar not found'
            }), 404
        
        # Check if avatar is owned by users
        owned_count = UserAvatar.query.filter_by(avatar_id=avatar_id).count()
        if owned_count > 0:
            return jsonify({
                'success': False,
                'error': f'Cannot delete avatar owned by {owned_count} users. Please refund users first.'
            }), 400
        
        from yuuzone import db
        db.session.delete(avatar)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Avatar deleted successfully'
        })
    except Exception as e:
        logging.error(f"Error deleting avatar: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@coins_bp.route('/admin/avatar-categories/<int:category_id>/toggle', methods=['PATCH'])
@super_manager_required
def toggle_avatar_category(category_id):
    """Toggle avatar category active status (SuperManager only)"""
    try:
        from yuuzone.coins.models import AvatarCategory
        category = AvatarCategory.query.get(category_id)
        
        if not category:
            return jsonify({
                'success': False,
                'error': 'Category not found'
            }), 404
        
        data = request.get_json()
        is_active = data.get('is_active', not category.is_active)
        
        category.is_active = is_active
        from yuuzone import db
        db.session.commit()
        
        return jsonify({
            'success': True,
            'category': category.as_dict(),
            'message': f'Category {"enabled" if is_active else "disabled"} successfully'
        })
    except Exception as e:
        logging.error(f"Error toggling avatar category: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@coins_bp.route('/admin/coin-packages/<int:package_id>/toggle', methods=['PATCH'])
@super_manager_required
def toggle_coin_package(package_id):
    """Toggle coin package active status (SuperManager only)"""
    try:
        from yuuzone.coins.models import CoinPackage
        package = CoinPackage.query.get(package_id)
        
        if not package:
            return jsonify({
                'success': False,
                'error': 'Package not found'
            }), 404
        
        data = request.get_json()
        is_active = data.get('is_active', not package.is_active)
        
        package.is_active = is_active
        from yuuzone import db
        db.session.commit()
        
        return jsonify({
            'success': True,
            'package': package.as_dict(),
            'message': f'Package {"enabled" if is_active else "disabled"} successfully'
        })
    except Exception as e:
        logging.error(f"Error toggling coin package: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500 

@coins_bp.route('/payment/pending', methods=['GET'])
@login_required
def get_pending_coin_payments():
    """Get user's pending coin payments"""
    try:
        from yuuzone.coins.models import CoinPayment
        from datetime import timezone, datetime
        
        # Use timezone-aware datetime for comparison
        current_time = datetime.now(timezone.utc)
        
        pending_payments = CoinPayment.query.filter_by(
            user_id=current_user.id,
            payment_status='pending'
        ).filter(
            CoinPayment.expires_at > current_time
        ).order_by(CoinPayment.created_at.desc()).all()
        
        return jsonify({
            "success": True,
            "pending_payments": [payment.as_dict() for payment in pending_payments]
        }), 200
        
    except Exception as e:
        logging.error(f"Error getting pending coin payments: {e}")
        return jsonify({
            "success": False,
            "error": "Failed to get pending payments"
        }), 500 

@coins_bp.route("/posts/boost/daily-info", methods=["GET"])
@login_required
def get_daily_boost_info():
    """Get user's daily boost information"""
    try:
        user_id = current_user.id
        coin_service = CoinService()
        daily_info = coin_service.get_user_daily_boost_info(user_id)
        
        if daily_info:
            return jsonify({
                'success': True,
                'data': daily_info
            }), 200
        else:
            return jsonify({
                'success': False,
                'message': 'Failed to get daily boost information'
            }), 500
            
    except Exception as e:
        logging.error(f"Error getting daily boost info: {e}")
        return jsonify({
            'success': False,
            'message': 'Internal server error'
        }), 500 