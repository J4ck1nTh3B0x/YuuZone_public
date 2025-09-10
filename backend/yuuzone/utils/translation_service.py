import requests
import logging
import gc
import time
import hashlib
from datetime import datetime, date
from typing import Dict, Optional
from yuuzone import db
from yuuzone.translation.models import TranslationUsage, UserTranslationStats, TranslationLimits, TranslationCache
from yuuzone.config import TRANSLATE_URL
from .connection_manager import connection_manager
from .system_monitor import system_monitor

class TranslationService:
    def __init__(self):
        self.api_url = f"{TRANSLATE_URL}/translate"
        self.detect_url = f"{TRANSLATE_URL}/detect"
        # Support English, Japanese, and Vietnamese
        self.supported_languages = ['en', 'ja', 'vi']
        
        # Connection management
        self.request_timeout = 10  # 10 second timeout
        self.max_retries = 3
        self.retry_delay = 1  # seconds
        
        # In-memory cache for frequently translated content
        self.memory_cache: Dict[str, Dict] = {}
        self.cache_size_limit = 1000
        self.cache_ttl = 3600  # 1 hour
        
        # Rate limiting
        self.request_timestamps = []
        self.max_requests_per_minute = 60
        
    def _check_rate_limit(self) -> bool:
        """Check if we're within rate limits"""
        now = time.time()
        # Remove old timestamps (older than 1 minute)
        self.request_timestamps = [ts for ts in self.request_timestamps if now - ts < 60]
        
        if len(self.request_timestamps) >= self.max_requests_per_minute:
            logging.warning("Translation API rate limit reached")
            return False
        
        self.request_timestamps.append(now)
        return True
    
    def _get_cache_key(self, text: str, target_language: str) -> str:
        """Generate cache key for text and target language"""
        content_hash = hashlib.md5(f"{text}:{target_language}".encode()).hexdigest()
        return f"trans_{content_hash}"
    
    def _get_from_cache(self, text: str, target_language: str) -> Optional[Dict]:
        """Get translation from memory cache"""
        cache_key = self._get_cache_key(text, target_language)
        
        if cache_key in self.memory_cache:
            cache_entry = self.memory_cache[cache_key]
            if time.time() - cache_entry['timestamp'] < self.cache_ttl:
                return cache_entry['data']
            else:
                # Remove expired cache entry
                del self.memory_cache[cache_key]
        
        return None
    
    def _add_to_cache(self, text: str, target_language: str, translation_data: Dict):
        """Add translation to memory cache"""
        cache_key = self._get_cache_key(text, target_language)
        
        # Clean up cache if it's too large
        if len(self.memory_cache) >= self.cache_size_limit:
            # Remove oldest entries
            oldest_keys = sorted(self.memory_cache.keys(), 
                               key=lambda k: self.memory_cache[k]['timestamp'])[:100]
            for key in oldest_keys:
                del self.memory_cache[key]
        
        self.memory_cache[cache_key] = {
            'data': translation_data,
            'timestamp': time.time()
        }
    
    def _make_api_request(self, payload: Dict, headers: Dict) -> Optional[Dict]:
        """Make API request with retry logic and connection management"""
        connection_id = f"translation_{int(time.time() * 1000)}"
        
        # Check if system can handle new connections
        if not system_monitor.should_accept_connections():
            logging.warning("System overloaded, rejecting translation request")
            return None
        
        # Register connection
        if not connection_manager.register_connection(connection_id, "translation"):
            logging.warning("Failed to register translation connection")
            return None
        
        try:
            for attempt in range(self.max_retries):
                try:
                    # Update connection activity
                    connection_manager.update_connection_activity(connection_id, 100)
                    
                    response = requests.post(
                        self.api_url, 
                        json=payload, 
                        headers=headers, 
                        timeout=self.request_timeout
                    )
                    
                    if response.status_code == 200:
                        return response.json()
                    else:
                        logging.warning(f"Translation API error: {response.status_code}")
                        
                except requests.exceptions.Timeout:
                    logging.warning(f"Translation API timeout (attempt {attempt + 1})")
                    if attempt < self.max_retries - 1:
                        time.sleep(self.retry_delay * (attempt + 1))
                    continue
                    
                except requests.exceptions.RequestException as e:
                    logging.error(f"Translation API request error: {e}")
                    if attempt < self.max_retries - 1:
                        time.sleep(self.retry_delay * (attempt + 1))
                    continue
            
            return None
            
        finally:
            # Always cleanup connection
            connection_manager.remove_connection(connection_id, "api_request_complete")
    
    def translate_text(self, text, user_id, target_language=None):
        """
        Translate text using LibreTranslate API with auto-detection, caching, and connection management
        Supports English, Japanese, and Vietnamese
        """
        try:
            # Check rate limits
            if not self._check_rate_limit():
                return {"error": "Rate limit exceeded"}
            
            # Set target language
            if target_language and target_language in self.supported_languages:
                target = target_language
            else:
                target = "en"
            
            # Check memory cache first
            cached_result = self._get_from_cache(text, target)
            if cached_result:
                logging.info(f"Translation served from cache for user {user_id}")
                return {
                    **cached_result,
                    "cached": True
                }
            
            # Check database cache
            db_cache_result = self.check_translation_cache(text, target)
            if db_cache_result:
                logging.info(f"Translation served from database cache for user {user_id}")
                # Add to memory cache
                self._add_to_cache(text, target, db_cache_result)
                return {
                    **db_cache_result,
                    "cached": True
                }
            
            # Make API request
            translate_payload = {
                'q': text,
                'source': 'auto',
                'target': target,
                'format': 'text',
                'alternatives': 0,
                'api_key': ''
            }
            translate_headers = {'Content-Type': 'application/json'}
            
            response_data = self._make_api_request(translate_payload, translate_headers)
            
            if not response_data:
                return {"error": "Translation failed"}
                
            translated_text = response_data.get("translatedText")
            
            if not translated_text:
                return {"error": "Translation failed"}
            
            # Get detected language from response if available
            detected_lang = response_data.get("detectedLanguage", {}).get("language", "unknown")
            
            result = {
                "translated_text": translated_text,
                "source_language": detected_lang,
                "target_language": target,
                "confidence_score": response_data.get("detectedLanguage", {}).get("confidence", 0.0),
                "cached": False
            }
            
            # Add to memory cache
            self._add_to_cache(text, target, result)
            
            return result
            
        except Exception as e:
            logging.error(f"Translation error: {e}")
            return {"error": "Translation service error"}

    def translate_to_multiple_languages(self, text, user_id):
        """
        Translate text to the other supported languages using auto-detection
        Supports English, Japanese, and Vietnamese
        """
        try:
            # Use auto-detection and translate to English (most common target)
            translate_payload = {
                'q': text,
                'source': 'auto',
                'target': 'en',
                'format': 'text',
                'alternatives': 0,
                'api_key': ''
            }
            translate_headers = {'Content-Type': 'application/json'}
            
            response = requests.post(self.api_url, json=translate_payload, headers=translate_headers)
            
            if response.status_code != 200:
                return {"error": "Translation failed"}
                
            response_data = response.json()
            translated_text = response_data.get("translatedText")
            
            if not translated_text:
                return {"error": "Translation failed"}
            
            # Get detected language from response if available
            detected_lang = response_data.get("detectedLanguage", {}).get("language", "unknown")
            
            return {
                "source_language": detected_lang,
                "translations": {
                    "en": {
                        "translated_text": translated_text,
                        "confidence_score": response_data.get("detectedLanguage", {}).get("confidence", 0.0)
                    }
                },
                "original_text": text
            }
            
        except Exception as e:
            logging.error(f"Multi-language translation error: {e}")
            return {"error": "Translation service error"}
    
    def check_user_translation_limit(self, user_id):
        """
        Check if user has translation limit remaining for this month
        Returns: (can_translate, limit, used, remaining)
        """
        try:
            current_month = datetime.utcnow().strftime('%Y-%m')
            
            # Get user's subscription tier (VIP and Support are subscription tiers)
            from yuuzone.subscriptions.service import SubscriptionService
            subscription_service = SubscriptionService()
            current_tier = subscription_service.get_user_current_tier(user_id)
            
            # Map subscription tiers to role slugs for translation limits
            # 'free' tier maps to 'member' role for translation limits
            tier_to_role_map = {
                'free': 'member',
                'support': 'support', 
                'vip': 'vip'
            }
            role_slug = tier_to_role_map.get(current_tier, 'member')
            
            # Get translation limit for this role from database
            limit_record = TranslationLimits.query.filter_by(role_slug=role_slug).first()
            if not limit_record:
                # If no record found, use default member limit
                monthly_limit = 100
            else:
                monthly_limit = limit_record.monthly_limit
            
            # Check if unlimited (VIP)
            if monthly_limit == -1:
                return True, -1, 0, -1
            
            # Get this month's usage
            stats = UserTranslationStats.query.filter_by(
                user_id=user_id, 
                year_month=current_month
            ).first()
            
            if not stats:
                # First translation of the month
                return True, monthly_limit, 0, monthly_limit
            
            used = stats.translations_used
            remaining = monthly_limit - used
            
            return remaining > 0, monthly_limit, used, remaining
            
        except Exception as e:
            logging.error(f"Error checking translation limit: {e}")
            return False, 100, 0, 0
    
    def increment_translation_usage(self, user_id, source_language, target_language, 
                                  original_text, translated_text, post_id=None, comment_id=None):
        """
        Increment user's translation usage for this month
        """
        try:
            current_month = datetime.utcnow().strftime('%Y-%m')
            
            # Get or create this month's stats
            stats = UserTranslationStats.query.filter_by(
                user_id=user_id, 
                year_month=current_month
            ).first()
            
            if not stats:
                stats = UserTranslationStats(user_id=user_id, year_month=current_month, translations_used=0)
                db.session.add(stats)
            
            # Ensure translations_used is not None before incrementing
            if stats.translations_used is None:
                stats.translations_used = 0
            stats.translations_used += 1
            stats.updated_at = datetime.utcnow()
            
            # Log the translation usage
            usage = TranslationUsage(
                user_id=user_id,
                source_language=source_language,
                target_language=target_language,
                original_text=original_text,
                translated_text=translated_text,
                translation_method="libretranslate",
                post_id=post_id,
                comment_id=comment_id
            )
            
            db.session.add(usage)
            db.session.commit()
            
            # Force garbage collection to help with memory management
            gc.collect()
            
            return True
            
        except Exception as e:
            logging.error(f"Error incrementing translation usage: {e}")
            try:
                db.session.rollback()
            except Exception as rollback_error:
                logging.error(f"Error during rollback: {rollback_error}")
            return False
    
    def get_user_translation_history(self, user_id, year_month=None):
        """
        Get user's translation history for a specific month (defaults to current month)
        """
        try:
            if year_month is None:
                year_month = datetime.utcnow().strftime('%Y-%m')
            
            translations = TranslationUsage.query.filter_by(
                user_id=user_id
            ).filter(
                db.func.to_char(TranslationUsage.translated_at, 'YYYY-MM') == year_month
            ).order_by(TranslationUsage.translated_at.desc()).all()
            
            return [translation.as_dict() for translation in translations]
            
        except Exception as e:
            logging.error(f"Error getting translation history: {e}")
            return []

    def check_translation_cache(self, content, target_language=None):
        """
        Check if there's a cached translation for the given content
        Returns cached translation if found and content hasn't changed, None otherwise
        """
        try:
            # Generate hash for current content
            current_hash = TranslationCache.generate_content_hash(content)

            # Look for cached translation
            cache_query = TranslationCache.query.filter_by(content_hash=current_hash)

            if target_language:
                cache_query = cache_query.filter_by(target_language=target_language)

            cached_translation = cache_query.first()

            if cached_translation:
                # Content hasn't changed, update usage count and return cached translation
                cached_translation.usage_count += 1
                cached_translation.last_used = datetime.utcnow()
                db.session.commit()

                return {
                    "cached": True,
                    "source_language": cached_translation.source_language,
                    "target_language": cached_translation.target_language,
                    "translated_text": cached_translation.translated_text,
                    "confidence_score": cached_translation.confidence_score,
                    "original_text": cached_translation.original_text
                }

            return None

        except Exception as e:
            logging.error(f"Error checking translation cache: {e}")
            return None

    def save_translation_cache(self, source_language, target_language, 
                             original_text, translated_text, translation_method, confidence_score=None):
        """
        Save translation to cache
        """
        try:
            # Generate content hash
            content_hash = TranslationCache.generate_content_hash(original_text)

            # Check if cache entry already exists
            existing_cache = TranslationCache.query.filter_by(
                content_hash=content_hash,
                target_language=target_language
            ).first()

            if existing_cache:
                # Update existing cache entry
                existing_cache.source_language = source_language
                existing_cache.original_text = original_text
                existing_cache.translated_text = translated_text
                existing_cache.translation_method = translation_method
                existing_cache.confidence_score = confidence_score
                existing_cache.last_used = datetime.utcnow()
                existing_cache.usage_count += 1
            else:
                # Create new cache entry
                cache_entry = TranslationCache(
                    content_hash=content_hash,
                    source_language=source_language,
                    target_language=target_language,
                    original_text=original_text,
                    translated_text=translated_text,
                    translation_method=translation_method,
                    confidence_score=confidence_score
                )
                db.session.add(cache_entry)

            db.session.commit()
            return True

        except Exception as e:
            logging.error(f"Error saving translation cache: {e}")
            try:
                db.session.rollback()
            except Exception as rollback_error:
                logging.error(f"Error during rollback: {rollback_error}")
            return False 