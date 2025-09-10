import time
import logging
from functools import wraps
from flask import request, jsonify, current_app
from flask_login import current_user
from collections import defaultdict, deque
from datetime import datetime, timedelta
import threading

class RateLimiter:
    """Rate limiter for preventing spam and duplicate submissions"""
    
    def __init__(self):
        self.rate_limits = defaultdict(lambda: deque())
        self.lock = threading.Lock()
        
        # Define rate limits for different actions
        self.limits = {
            'login': {'max_attempts': 5, 'window': 300},  # 5 attempts per 5 minutes
            'register': {'max_attempts': 3, 'window': 600},  # 3 attempts per 10 minutes
            'post': {'max_attempts': 10, 'window': 300},  # 10 posts per 5 minutes
            'comment': {'max_attempts': 20, 'window': 300},  # 20 comments per 5 minutes
            'vote': {'max_attempts': 50, 'window': 300},  # 50 votes per 5 minutes
            'password_reset': {'max_attempts': 3, 'window': 1800},  # 3 attempts per 30 minutes
            'email_change': {'max_attempts': 3, 'window': 3600},  # 3 attempts per hour
            'username_change': {'max_attempts': 3, 'window': 3600},  # 3 attempts per hour
            'delete_account': {'max_attempts': 1, 'window': 86400},  # 1 attempt per day
            'join_subthread': {'max_attempts': 20, 'window': 300},  # 20 joins per 5 minutes
            'create_subthread': {'max_attempts': 3, 'window': 3600},  # 3 subthreads per hour
            'send_message': {'max_attempts': 30, 'window': 300},  # 30 messages per 5 minutes
            'wallet': {'max_attempts': 10, 'window': 60},  # 10 attempts per minute (was 1 per 5 seconds)
        }
    
    def _get_identifier(self, action):
        """Get unique identifier for rate limiting (IP for guests, user_id for logged in users)"""
        if current_user.is_authenticated:
            return f"user_{current_user.id}_{action}"
        else:
            # Use IP address for guests
            ip = request.headers.get('X-Forwarded-For', request.remote_addr)
            return f"ip_{ip}_{action}"
    
    def _cleanup_old_entries(self, action):
        """Remove old entries from rate limit tracking"""
        identifier = self._get_identifier(action)
        limit_config = self.limits.get(action, {'max_attempts': 10, 'window': 300})
        cutoff_time = time.time() - limit_config['window']
        
        with self.lock:
            if identifier in self.rate_limits:
                # Remove entries older than the window
                self.rate_limits[identifier] = deque(
                    timestamp for timestamp in self.rate_limits[identifier] 
                    if timestamp > cutoff_time
                )
    
    def is_rate_limited(self, action):
        """Check if the current request is rate limited"""
        if action not in self.limits:
            return False
            
        self._cleanup_old_entries(action)
        identifier = self._get_identifier(action)
        limit_config = self.limits[action]
        
        with self.lock:
            attempts = len(self.rate_limits[identifier])
            if attempts >= limit_config['max_attempts']:
                return True
            
            # Add current attempt
            self.rate_limits[identifier].append(time.time())
            return False
    
    def get_remaining_attempts(self, action):
        """Get remaining attempts for an action"""
        if action not in self.limits:
            return float('inf')
            
        self._cleanup_old_entries(action)
        identifier = self._get_identifier(action)
        limit_config = self.limits[action]
        
        with self.lock:
            attempts = len(self.rate_limits[identifier])
            return max(0, limit_config['max_attempts'] - attempts)
    
    def get_reset_time(self, action):
        """Get time until rate limit resets"""
        if action not in self.limits:
            return 0
            
        identifier = self._get_identifier(action)
        limit_config = self.limits[action]
        
        with self.lock:
            if identifier in self.rate_limits and self.rate_limits[identifier]:
                oldest_timestamp = min(self.rate_limits[identifier])
                reset_time = oldest_timestamp + limit_config['window'] - time.time()
                return max(0, reset_time)
        return 0

# Global rate limiter instance
rate_limiter = RateLimiter()

def rate_limit(action):
    """Decorator to apply rate limiting to Flask routes"""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if rate_limiter.is_rate_limited(action):
                remaining_time = rate_limiter.get_reset_time(action)
                minutes = int(remaining_time // 60)
                seconds = int(remaining_time % 60)
                
                if minutes > 0:
                    time_str = f"{minutes} minute{'s' if minutes != 1 else ''}"
                else:
                    time_str = f"{seconds} second{'s' if seconds != 1 else ''}"
                
                return jsonify({
                    "error": "rate_limited",
                    "message": f"Too many requests. Please try again in {time_str}.",
                    "remaining_time": remaining_time,
                    "action": action
                }), 429
            
            return f(*args, **kwargs)
        return decorated_function
    return decorator

class DuplicateDetector:
    """Detect duplicate submissions to prevent spam"""
    
    def __init__(self):
        self.recent_submissions = defaultdict(lambda: deque())
        self.lock = threading.Lock()
        
        # Define duplicate detection rules
        self.duplicate_rules = {
            'post': {
                'window': 60,  # 1 minute
                'fields': ['title', 'content', 'subthread_id'],  # Fields to check for duplicates
                'max_similarity': 0.9  # 90% similarity threshold
            },
            'comment': {
                'window': 10,  # 10 seconds (increased from 5)
                'fields': ['content', 'post_id'],  # Check both content and post_id
                'max_similarity': 0.95  # 95% similarity threshold (reduced from 99%)
            },
            'message': {
                'window': 10,  # 10 seconds
                'fields': ['content', 'receiver'],
                'max_similarity': 0.98  # 98% similarity threshold
            }
        }
    
    def _get_content_hash(self, content):
        """Create a simple hash of content for comparison"""
        if not content:
            return ""
        # Normalize content: lowercase, remove extra whitespace
        normalized = ' '.join(str(content).lower().split())
        return hash(normalized)
    
    def _calculate_similarity(self, content1, content2):
        """Calculate similarity between two content strings"""
        if not content1 or not content2:
            return 0.0
        
        # Simple similarity calculation
        words1 = set(str(content1).lower().split())
        words2 = set(str(content2).lower().split())
        
        if not words1 or not words2:
            return 0.0
        
        intersection = words1.intersection(words2)
        union = words1.union(words2)
        
        return len(intersection) / len(union)
    
    def is_duplicate(self, action, data):
        """Check if submission is a duplicate"""
        if action not in self.duplicate_rules:
            return False
            
        rule = self.duplicate_rules[action]
        identifier = self._get_identifier(action)
        cutoff_time = time.time() - rule['window']
        
        with self.lock:
            # Clean old entries
            self.recent_submissions[identifier] = deque(
                entry for entry in self.recent_submissions[identifier]
                if entry['timestamp'] > cutoff_time
            )
            
            # Check for duplicates
            for entry in self.recent_submissions[identifier]:
                if self._is_similar_submission(data, entry['data'], rule):
                    return True
            
            # Add current submission
            self.recent_submissions[identifier].append({
                'timestamp': time.time(),
                'data': data.copy()
            })
            
            return False
    
    def _is_similar_submission(self, new_data, old_data, rule):
        """Check if two submissions are similar enough to be considered duplicates"""
        for field in rule['fields']:
            if field in new_data and field in old_data:
                similarity = self._calculate_similarity(new_data[field], old_data[field])
                if similarity >= rule['max_similarity']:
                    return True
        return False
    
    def _get_identifier(self, action):
        """Get unique identifier for duplicate detection"""
        if current_user.is_authenticated:
            return f"user_{current_user.id}_{action}"
        else:
            ip = request.headers.get('X-Forwarded-For', request.remote_addr)
            return f"ip_{ip}_{action}"

# Global duplicate detector instance
duplicate_detector = DuplicateDetector()

def prevent_duplicates(action):
    """Decorator to prevent duplicate submissions"""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            # Extract data from request
            if request.is_json:
                data = request.get_json()
            elif request.form:
                data = request.form.to_dict()
            else:
                data = {}
            
            if duplicate_detector.is_duplicate(action, data):
                return jsonify({
                    "error": "duplicate_submission",
                    "message": "This appears to be a duplicate submission. Please wait before trying again.",
                    "action": action
                }), 409
            
            return f(*args, **kwargs)
        return decorated_function
    return decorator

def combined_protection(action):
    """Combined decorator for both rate limiting and duplicate prevention"""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            # First check rate limiting
            if rate_limiter.is_rate_limited(action):
                remaining_time = rate_limiter.get_reset_time(action)
                minutes = int(remaining_time // 60)
                seconds = int(remaining_time % 60)
                
                if minutes > 0:
                    time_str = f"{minutes} minute{'s' if minutes != 1 else ''}"
                else:
                    time_str = f"{seconds} second{'s' if seconds != 1 else ''}"
                
                return jsonify({
                    "error": "rate_limited",
                    "message": f"Too many requests. Please try again in {time_str}.",
                    "remaining_time": remaining_time,
                    "action": action
                }), 429
            
            # Then check for duplicates
            if request.is_json:
                data = request.get_json()
            elif request.form:
                data = request.form.to_dict()
            else:
                data = {}
            
            if duplicate_detector.is_duplicate(action, data):
                return jsonify({
                    "error": "duplicate_submission",
                    "message": "This appears to be a duplicate submission. Please wait before trying again.",
                    "action": action
                }), 409
            
            return f(*args, **kwargs)
        return decorated_function
    return decorator 