from flask import Blueprint, jsonify, request
from flask_login import login_required, current_user
from yuuzone import db
from yuuzone.posts.models import Posts
from yuuzone.comments.models import Comments
from yuuzone.translation.models import TranslationUsage, UserTranslationStats, TranslationLimits
from yuuzone.utils.translation_service import TranslationService
from yuuzone.utils.translations import get_translation
from yuuzone.users.routes import get_user_language
from datetime import date, datetime
import logging

translation = Blueprint("translation", __name__, url_prefix="/api/translate")

# Initialize translation service
translation_service = TranslationService()

@translation.route("/post/<int:post_id>", methods=["POST"])
@login_required
def translate_post(post_id):
    """Translate a post to the target language"""
    try:
        # Get the post
        post = Posts.query.get(post_id)
        if not post:
            user_lang = get_user_language()
            return jsonify({"error": get_translation('post_not_found', user_lang)}), 404

        # Check user's translation limit
        can_translate, limit, used, remaining = translation_service.check_user_translation_limit(current_user.id)
        
        if not can_translate:
            user_lang = get_user_language()
            return jsonify({
                "error": get_translation('translation_limit_exceeded', user_lang),
                "limit": limit,
                "used": used,
                "remaining": remaining
            }), 429

        # Get target language from request
        target_language = request.json.get('target_language') if request.json else None
        
        # Check cache first
        text_to_translate = f"{post.title}\n\n{post.content or ''}"
        cached_result = translation_service.check_translation_cache(
            text_to_translate, 
            target_language=target_language
        )
        
        if cached_result:
            # Return cached translation without incrementing usage
            translated_lines = cached_result["translated_text"].split('\n\n', 1)
            translated_title = translated_lines[0] if translated_lines else cached_result["translated_text"]
            translated_content = translated_lines[1] if len(translated_lines) > 1 else ""

            return jsonify({
                "translated_title": translated_title,
                "translated_content": translated_content,
                "source_language": cached_result["source_language"],
                "target_language": cached_result["target_language"],
                "original_title": post.title,
                "original_content": post.content or "",
                "cached": True,
                "limit": limit,
                "used": used,
                "remaining": remaining
            }), 200
        
        # Combine title and content for translation
        text_to_translate = f"{post.title}\n\n{post.content or ''}"
        
        # Translate the content
        result = translation_service.translate_text(text_to_translate, current_user.id, target_language)
        
        if "error" in result:
            user_lang = get_user_language()
            return jsonify({"error": result["error"]}), 400

        # Save to cache
        cache_success = translation_service.save_translation_cache(
            source_language=result["source_language"],
            target_language=result["target_language"],
            original_text=text_to_translate,
            translated_text=result["translated_text"],
            translation_method="libretranslate",
            confidence_score=result.get("confidence_score")
        )
        
        # Increment usage
        success = translation_service.increment_translation_usage(
            current_user.id,
            result["source_language"],
            result["target_language"],
            text_to_translate,
            result["translated_text"],
            post_id=post_id
        )
        
        if not success:
            user_lang = get_user_language()
            return jsonify({"error": get_translation('translation_failed', user_lang)}), 500

        # Emit real-time update for translation stats
        try:
            from yuuzone.socketio_app import emit_translation_stats_updated
            # Get updated stats after increment
            updated_can_translate, updated_limit, updated_used, updated_remaining = translation_service.check_user_translation_limit(current_user.id)
            emit_translation_stats_updated(current_user.id, {
                'used_count': updated_used,
                'limit': updated_limit,
                'remaining': updated_remaining,
                'reset_date': datetime.utcnow().strftime('%Y-%m')
            })
        except Exception as e:
            logging.error(f"Failed to emit translation stats update: {e}")

        # Split translated text back into title and content
        translated_lines = result["translated_text"].split('\n\n', 1)
        translated_title = translated_lines[0] if translated_lines else result["translated_text"]
        translated_content = translated_lines[1] if len(translated_lines) > 1 else ""

        return jsonify({
            "translated_title": translated_title,
            "translated_content": translated_content,
            "source_language": result["source_language"],
            "target_language": result["target_language"],
            "original_title": post.title,
            "original_content": post.content or "",
            "limit": limit,
            "used": used + 1,
            "remaining": remaining - 1 if remaining != -1 else -1
        }), 200

    except Exception as e:
        logging.error(f"Translation error: {e}")
        user_lang = get_user_language()
        return jsonify({"error": get_translation('translation_failed', user_lang)}), 500


@translation.route("/comment/<int:comment_id>", methods=["POST"])
@login_required
def translate_comment(comment_id):
    """Translate a comment to the target language"""
    try:
        # Get the comment
        comment = Comments.query.get(comment_id)
        if not comment:
            user_lang = get_user_language()
            return jsonify({"error": get_translation('comment_not_found', user_lang)}), 404

        # Check user's translation limit
        can_translate, limit, used, remaining = translation_service.check_user_translation_limit(current_user.id)
        
        if not can_translate:
            user_lang = get_user_language()
            return jsonify({
                "error": get_translation('translation_limit_exceeded', user_lang),
                "limit": limit,
                "used": used,
                "remaining": remaining
            }), 429

        # Get target language from request
        target_language = request.json.get('target_language') if request.json else None
        
        # Check cache first
        cached_result = translation_service.check_translation_cache(
            comment.content, 
            target_language=target_language
        )
        
        if cached_result:
            # Return cached translation without incrementing usage
            return jsonify({
                "translated_content": cached_result["translated_text"],
                "source_language": cached_result["source_language"],
                "target_language": cached_result["target_language"],
                "original_content": comment.content,
                "cached": True,
                "limit": limit,
                "used": used,
                "remaining": remaining
            }), 200
        
        # Translate the content
        result = translation_service.translate_text(comment.content, current_user.id, target_language)
        
        if "error" in result:
            user_lang = get_user_language()
            return jsonify({"error": result["error"]}), 400

        # Save to cache
        cache_success = translation_service.save_translation_cache(
            source_language=result["source_language"],
            target_language=result["target_language"],
            original_text=comment.content,
            translated_text=result["translated_text"],
            translation_method="libretranslate",
            confidence_score=result.get("confidence_score")
        )
        
        # Increment usage
        success = translation_service.increment_translation_usage(
            current_user.id,
            result["source_language"],
            result["target_language"],
            comment.content,
            result["translated_text"],
            comment_id=comment_id
        )
        
        if not success:
            user_lang = get_user_language()
            return jsonify({"error": get_translation('translation_failed', user_lang)}), 500

        # Emit real-time update for translation stats
        try:
            from yuuzone.socketio_app import emit_translation_stats_updated
            # Get updated stats after increment
            updated_can_translate, updated_limit, updated_used, updated_remaining = translation_service.check_user_translation_limit(current_user.id)
            emit_translation_stats_updated(current_user.id, {
                'used_count': updated_used,
                'limit': updated_limit,
                'remaining': updated_remaining,
                'reset_date': datetime.utcnow().strftime('%Y-%m')
            })
        except Exception as e:
            logging.error(f"Failed to emit translation stats update: {e}")

        return jsonify({
            "translated_content": result["translated_text"],
            "source_language": result["source_language"],
            "target_language": result["target_language"],
            "original_content": comment.content,
            "limit": limit,
            "used": used + 1,
            "remaining": remaining - 1 if remaining != -1 else -1
        }), 200

    except Exception as e:
        logging.error(f"Translation error: {e}")
        user_lang = get_user_language()
        return jsonify({"error": get_translation('translation_failed', user_lang)}), 500


@translation.route("/post/<int:post_id>/translate-it", methods=["POST"])
@login_required
def translate_post_to_multiple_languages(post_id):
    """Translate a post to multiple languages"""
    try:
        # Get the post
        post = Posts.query.get(post_id)
        if not post:
            user_lang = get_user_language()
            return jsonify({"error": get_translation('post_not_found', user_lang)}), 404

        # Check user's translation limit
        can_translate, limit, used, remaining = translation_service.check_user_translation_limit(current_user.id)
        
        if not can_translate:
            user_lang = get_user_language()
            return jsonify({
                "error": get_translation('translation_limit_exceeded', user_lang),
                "limit": limit,
                "used": used,
                "remaining": remaining
            }), 429

        # Check cache first for translate-it (always translates to English)
        text_to_translate = f"{post.title}\n\n{post.content or ''}"
        cached_result = translation_service.check_translation_cache(
            text_to_translate, 
            target_language="en"
        )
        
        if cached_result:
            # Return cached translation without incrementing usage
            translated_lines = cached_result["translated_text"].split('\n\n', 1)
            translated_title = translated_lines[0] if translated_lines else cached_result["translated_text"]
            translated_content = translated_lines[1] if len(translated_lines) > 1 else ""

            return jsonify({
                "source_language": cached_result["source_language"],
                "translations": {
                    "en": {
                        "translated_title": translated_title,
                        "translated_content": translated_content,
                        "confidence_score": cached_result["confidence_score"]
                    }
                },
                "original_title": post.title,
                "original_content": post.content or "",
                "cached": True,
                "limit": limit,
                "used": used,
                "remaining": remaining
            }), 200
        
        # Combine title and content for translation
        text_to_translate = f"{post.title}\n\n{post.content or ''}"
        
        # Translate to multiple languages
        result = translation_service.translate_to_multiple_languages(text_to_translate, current_user.id)
        
        if "error" in result:
            user_lang = get_user_language()
            return jsonify({"error": result["error"]}), 400

        # Save to cache
        cache_success = translation_service.save_translation_cache(
            source_language=result["source_language"],
            target_language="en",  # translate-it always translates to English
            original_text=text_to_translate,
            translated_text=result["translations"]["en"]["translated_text"],
            translation_method="libretranslate",
            confidence_score=result["translations"]["en"]["confidence_score"]
        )
        
        # Increment usage for each translation
        success = True
        for target_lang, translation_data in result["translations"].items():
            success = translation_service.increment_translation_usage(
                current_user.id,
                result["source_language"],
                target_lang,
                text_to_translate,
                translation_data["translated_text"],
                post_id=post_id
            )
            if not success:
                break
        
        if not success:
            user_lang = get_user_language()
            return jsonify({"error": get_translation('translation_failed', user_lang)}), 500

        # Emit real-time update for translation stats
        try:
            from yuuzone.socketio_app import emit_translation_stats_updated
            # Get updated stats after increment
            updated_can_translate, updated_limit, updated_used, updated_remaining = translation_service.check_user_translation_limit(current_user.id)
            emit_translation_stats_updated(current_user.id, {
                'used_count': updated_used,
                'limit': updated_limit,
                'remaining': updated_remaining,
                'reset_date': datetime.utcnow().strftime('%Y-%m')
            })
        except Exception as e:
            logging.error(f"Failed to emit translation stats update: {e}")

        # Split translated texts back into title and content
        translated_results = {}
        for target_lang, translation_data in result["translations"].items():
            translated_lines = translation_data["translated_text"].split('\n\n', 1)
            translated_title = translated_lines[0] if translated_lines else translation_data["translated_text"]
            translated_content = translated_lines[1] if len(translated_lines) > 1 else ""
            
            translated_results[target_lang] = {
                "translated_title": translated_title,
                "translated_content": translated_content,
                "confidence_score": translation_data["confidence_score"]
            }

        return jsonify({
            "source_language": result["source_language"],
            "translations": translated_results,
            "original_title": post.title,
            "original_content": post.content or "",
            "limit": limit,
            "used": used + 1,  # Only increment by 1 since we only translate to one language
            "remaining": remaining - 1 if remaining != -1 else -1
        }), 200

    except Exception as e:
        logging.error(f"Multi-language translation error: {e}")
        user_lang = get_user_language()
        return jsonify({"error": get_translation('translation_failed', user_lang)}), 500


@translation.route("/comment/<int:comment_id>/translate-it", methods=["POST"])
@login_required
def translate_comment_to_multiple_languages(comment_id):
    """Translate a comment to multiple languages"""
    try:
        # Get the comment
        comment = Comments.query.get(comment_id)
        if not comment:
            user_lang = get_user_language()
            return jsonify({"error": get_translation('comment_not_found', user_lang)}), 404

        # Check user's translation limit
        can_translate, limit, used, remaining = translation_service.check_user_translation_limit(current_user.id)
        
        if not can_translate:
            user_lang = get_user_language()
            return jsonify({
                "error": get_translation('translation_limit_exceeded', user_lang),
                "limit": limit,
                "used": used,
                "remaining": remaining
            }), 429

        # Check cache first for translate-it (always translates to English)
        cached_result = translation_service.check_translation_cache(
            comment.content, 
            target_language="en"
        )
        
        if cached_result:
            # Return cached translation without incrementing usage
            return jsonify({
                "source_language": cached_result["source_language"],
                "translations": {
                    "en": {
                        "translated_text": cached_result["translated_text"],
                        "confidence_score": cached_result["confidence_score"]
                    }
                },
                "original_content": comment.content,
                "cached": True,
                "limit": limit,
                "used": used,
                "remaining": remaining
            }), 200
        
        # Translate to multiple languages
        result = translation_service.translate_to_multiple_languages(comment.content, current_user.id)
        
        if "error" in result:
            user_lang = get_user_language()
            return jsonify({"error": result["error"]}), 400

        # Save to cache
        cache_success = translation_service.save_translation_cache(
            source_language=result["source_language"],
            target_language="en",  # translate-it always translates to English
            original_text=comment.content,
            translated_text=result["translations"]["en"]["translated_text"],
            translation_method="libretranslate",
            confidence_score=result["translations"]["en"]["confidence_score"]
        )
        
        # Increment usage for each translation
        success = True
        for target_lang, translation_data in result["translations"].items():
            success = translation_service.increment_translation_usage(
                current_user.id,
                result["source_language"],
                target_lang,
                comment.content,
                translation_data["translated_text"],
                comment_id=comment_id
            )
            if not success:
                break
        
        if not success:
            user_lang = get_user_language()
            return jsonify({"error": get_translation('translation_failed', user_lang)}), 500

        # Emit real-time update for translation stats
        try:
            from yuuzone.socketio_app import emit_translation_stats_updated
            # Get updated stats after increment
            updated_can_translate, updated_limit, updated_used, updated_remaining = translation_service.check_user_translation_limit(current_user.id)
            emit_translation_stats_updated(current_user.id, {
                'used_count': updated_used,
                'limit': updated_limit,
                'remaining': updated_remaining,
                'reset_date': datetime.utcnow().strftime('%Y-%m')
            })
        except Exception as e:
            logging.error(f"Failed to emit translation stats update: {e}")

        return jsonify({
            "source_language": result["source_language"],
            "translations": result["translations"],
            "original_content": comment.content,
            "limit": limit,
            "used": used + 1,  # Only increment by 1 since we only translate to one language
            "remaining": remaining - 1 if remaining != -1 else -1
        }), 200

    except Exception as e:
        logging.error(f"Multi-language translation error: {e}")
        user_lang = get_user_language()
        return jsonify({"error": get_translation('translation_failed', user_lang)}), 500


@translation.route("/stats", methods=["GET"])
@login_required
def get_translation_stats():
    """Get user's translation stats for current month"""
    try:
        current_month = datetime.utcnow().strftime('%Y-%m')
        
        # Get current month's stats
        stats = UserTranslationStats.query.filter_by(
            user_id=current_user.id, 
            year_month=current_month
        ).first()
        
        # Get user's subscription tier (VIP and Support are subscription tiers)
        from yuuzone.subscriptions.service import SubscriptionService
        subscription_service = SubscriptionService()
        current_tier = subscription_service.get_user_current_tier(current_user.id)
        
        # Map subscription tiers to role slugs for translation limits
        # 'free' tier maps to 'member' role for translation limits
        tier_to_role_map = {
            'free': 'member',
            'support': 'support', 
            'vip': 'vip'
        }
        role_slug = tier_to_role_map.get(current_tier, 'member')
        
        # Fetch limit from database
        limit_record = TranslationLimits.query.filter_by(role_slug=role_slug).first()
        if not limit_record:
            # If no record found, use default member limit
            monthly_limit = 100
        else:
            monthly_limit = limit_record.monthly_limit
        
        used = stats.translations_used if stats else 0
        remaining = monthly_limit - used if monthly_limit != -1 else -1
        
        return jsonify({
            "limit": monthly_limit,
            "used": used,
            "remaining": remaining,
            "role": role_slug
        }), 200
        
    except Exception as e:
        logging.error(f"Error getting translation stats: {e}")
        return jsonify({"error": "Failed to get translation stats"}), 500


@translation.route("/history", methods=["GET"])
@login_required
def get_translation_history():
    """Get user's translation history with optional month filtering"""
    try:
        # Get month parameter from query string, default to current month
        month_param = request.args.get('month')
        if month_param:
            try:
                # Validate month format (YYYY-MM)
                datetime.strptime(month_param, '%Y-%m')
                selected_month = month_param
            except ValueError:
                return jsonify({"error": "Invalid month format. Use YYYY-MM"}), 400
        else:
            selected_month = datetime.utcnow().strftime('%Y-%m')
        
        history = translation_service.get_user_translation_history(current_user.id, selected_month)
        
        return jsonify({
            "history": history,
            "month": selected_month
        }), 200
        
    except Exception as e:
        logging.error(f"Error getting translation history: {e}")
        return jsonify({"error": "Failed to get translation history"}), 500
