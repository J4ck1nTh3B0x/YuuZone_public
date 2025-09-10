"""
YuuZone Security Utilities
Enhanced URL validation and security features
"""

import re
import ipaddress
import urllib.parse
import requests
import logging
from urllib.parse import urlparse


class SecureURLValidator:
    """Enhanced URL validator with comprehensive security features"""
    
    # Private IP ranges to block (SSRF protection)
    PRIVATE_IP_RANGES = [
        '10.0.0.0/8',          # Private Class A
        '172.16.0.0/12',       # Private Class B
        '192.168.0.0/16',      # Private Class C
        '127.0.0.0/8',         # Loopback
        '169.254.0.0/16',      # Link-local (AWS/Cloud metadata)
        '224.0.0.0/4',         # Multicast
        '240.0.0.0/4',         # Reserved
        '::1/128',             # IPv6 localhost
        'fc00::/7',            # IPv6 private
        'fe80::/10',           # IPv6 link-local
    ]
    
    # Suspicious/blocked domains
    BLOCKED_DOMAINS = {
        # Localhost variants
        'localhost', '0.0.0.0', '127.0.0.1',
        # URL shorteners (potential for abuse)
        'bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'ow.ly', 'short.link',
        # File sharing (potential for malware)
        'dropbox.com', 'drive.google.com', 'onedrive.live.com',
        # Known malicious domains (add more as needed)
        'malware.com', 'phishing.com',
    }
    
    # Allowed image extensions
    ALLOWED_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff'}
    
    # Security limits
    MAX_URL_LENGTH = 2048
    MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
    MAX_REDIRECTS = 3
    REQUEST_TIMEOUT = 10
    
    @classmethod
    def validate_url_security(cls, url):
        """
        Comprehensive URL security validation
        Raises ValueError with specific error message if validation fails
        """
        
        # Basic format check
        if not isinstance(url, str):
            raise ValueError("URL must be a string")
            
        if not url.strip():
            raise ValueError("URL cannot be empty")
        
        if not url.startswith(('http://', 'https://')):
            raise ValueError("URL must use HTTP or HTTPS protocol")
        
        # Length check
        if len(url) > cls.MAX_URL_LENGTH:
            raise ValueError(f"URL too long (maximum {cls.MAX_URL_LENGTH} characters)")
        
        # Parse URL
        try:
            parsed = urlparse(url)
        except Exception as e:
            raise ValueError(f"Invalid URL format: {str(e)}")
        
        # Hostname validation
        hostname = parsed.hostname
        if not hostname:
            raise ValueError("Invalid or missing hostname")
        
        hostname_lower = hostname.lower()
        
        # Check blocked domains
        if hostname_lower in cls.BLOCKED_DOMAINS:
            raise ValueError(f"Domain '{hostname}' is not allowed")
        
        # Check for blocked domain patterns
        for blocked_domain in cls.BLOCKED_DOMAINS:
            if blocked_domain in hostname_lower:
                raise ValueError(f"Domain containing '{blocked_domain}' is not allowed")
        
        # Check for private IP addresses (SSRF protection)
        # Only check if hostname looks like an IP address
        if hostname.replace('.', '').replace(':', '').isdigit() or ':' in hostname:
            try:
                ip = ipaddress.ip_address(hostname)
                for private_range in cls.PRIVATE_IP_RANGES:
                    if ip in ipaddress.ip_network(private_range):
                        raise ValueError(f"Private IP address '{hostname}' is not allowed")
            except ipaddress.AddressValueError:
                # Invalid IP format, but that's okay for domain names
                pass
        
        # Additional hostname security checks
        if hostname_lower.startswith('.') or hostname_lower.endswith('.'):
            raise ValueError("Invalid hostname format")
        
        # Check for suspicious patterns
        suspicious_patterns = ['admin', 'api', 'internal', 'private', 'secret']
        for pattern in suspicious_patterns:
            if pattern in hostname_lower:
                logging.warning(f"Suspicious hostname pattern detected: {hostname}")
        
        return True
    
    @classmethod
    def validate_media_url(cls, url):
        """
        Validate a media URL (image, video, or supported platform)
        Returns the media type and whether it needs downloading
        """

        # First validate URL security
        cls.validate_url_security(url)

        # Check for supported video platforms that don't need downloading
        video_platforms = {
            'youtube.com': 'youtube',
            'youtu.be': 'youtube',
            'vimeo.com': 'vimeo',
            'dailymotion.com': 'dailymotion',
            'twitch.tv': 'twitch',
            'streamable.com': 'streamable',
            'tiktok.com': 'tiktok',
            'facebook.com': 'facebook',
            'instagram.com': 'instagram',
            'twitter.com': 'twitter',
            'x.com': 'twitter'
        }

        from urllib.parse import urlparse
        parsed = urlparse(url)
        domain = parsed.netloc.lower()

        # Remove www. prefix for matching
        if domain.startswith('www.'):
            domain = domain[4:]

        # Check if it's a supported video platform
        for platform_domain, platform_type in video_platforms.items():
            if platform_domain in domain:
                #logging.info(f"Detected {platform_type} URL: {url}")
                return {
                    'type': 'video_platform',
                    'platform': platform_type,
                    'needs_download': False,
                    'url': url
                }

        # For other URLs, check content type
        return cls._validate_direct_media_url(url)

    @classmethod
    def _validate_direct_media_url(cls, url):
        """
        Validate direct media URLs (images, videos) that need content checking
        """

        # Set up secure headers
        headers = {
            'User-Agent': 'YuuZone-MediaBot/1.0 (+https://yuuzone.fun)',
            'Accept': 'image/*, video/*, application/octet-stream',
            'Accept-Language': 'en-US,en;q=0.9',
            'Cache-Control': 'no-cache',
            'Connection': 'close',
        }

        try:
            # HEAD request first to check content without downloading
            #logging.info(f"Validating media URL: {url}")

            response = requests.head(
                url,
                headers=headers,
                allow_redirects=True,
                timeout=cls.REQUEST_TIMEOUT,
                stream=True
            )

            # Check for too many redirects
            if len(response.history) > cls.MAX_REDIRECTS:
                raise ValueError(f"Too many redirects (maximum {cls.MAX_REDIRECTS})")

            # Validate final URL after redirects
            final_url = response.url
            if final_url != url:
                cls.validate_url_security(final_url)
                #logging.info(f"URL redirected to: {final_url}")

            # Validate content type
            content_type = response.headers.get("Content-Type", "").lower()

            if content_type.startswith("image/"):
                # Block potentially dangerous image types
                if 'svg' in content_type:
                    raise ValueError("SVG images are not allowed for security reasons")

                return {
                    'type': 'image',
                    'content_type': content_type,
                    'needs_download': True,
                    'url': final_url
                }

            elif content_type.startswith("video/"):
                return {
                    'type': 'video',
                    'content_type': content_type,
                    'needs_download': False,  # Don't download videos, just validate
                    'url': final_url
                }

            else:
                # Check if URL ends with media extensions
                media_extensions = {
                    'image': ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'],
                    'video': ['.mp4', '.webm', '.ogg', '.avi', '.mov', '.wmv', '.flv', '.mkv']
                }

                url_lower = url.lower()
                for media_type, extensions in media_extensions.items():
                    if any(url_lower.endswith(ext) for ext in extensions):
                        return {
                            'type': media_type,
                            'content_type': f'{media_type}/unknown',
                            'needs_download': media_type == 'image',
                            'url': final_url
                        }

                raise ValueError(f"URL does not lead to supported media (Content-Type: {content_type})")

        except requests.exceptions.RequestException as e:
            logging.error(f"Network error validating media URL {url}: {e}")
            raise ValueError(f"Unable to validate media URL: {str(e)}")
        except Exception as e:
            logging.error(f"Unexpected error validating media URL {url}: {e}")
            raise ValueError(f"Media validation failed: {str(e)}")

    @classmethod
    def safe_download_image(cls, url):
        """
        Safely download and validate image with comprehensive security checks
        Returns image bytes if successful, raises ValueError if validation fails
        """
        
        # Security validation first
        cls.validate_url_security(url)
        
        # Secure headers
        headers = {
            'User-Agent': 'YuuZone-ImageBot/1.0 (+https://yuuzone.fun)',
            'Accept': 'image/jpeg, image/png, image/gif, image/webp, image/bmp, image/tiff',
            'Accept-Language': 'en-US,en;q=0.9',
            'Cache-Control': 'no-cache',
            'Connection': 'close',
        }
        
        try:
            # HEAD request first to check content without downloading
            #logging.info(f"Validating image URL: {url}")
            
            response = requests.head(
                url, 
                headers=headers, 
                allow_redirects=True,
                timeout=cls.REQUEST_TIMEOUT,
                stream=True
            )
            
            # Check for too many redirects
            if len(response.history) > cls.MAX_REDIRECTS:
                raise ValueError(f"Too many redirects (maximum {cls.MAX_REDIRECTS})")
            
            # Validate final URL after redirects
            final_url = response.url
            if final_url != url:
                cls.validate_url_security(final_url)
                #logging.info(f"URL redirected to: {final_url}")
            
            # Validate content type
            content_type = response.headers.get("Content-Type", "").lower()
            if not content_type.startswith("image/"):
                raise ValueError(f"URL does not lead to an image (Content-Type: {content_type})")
            
            # Block potentially dangerous image types
            if 'svg' in content_type:
                raise ValueError("SVG images are not allowed for security reasons")
            
            # Check content length
            content_length = response.headers.get("Content-Length")
            if content_length:
                try:
                    size = int(content_length)
                    if size > cls.MAX_FILE_SIZE:
                        raise ValueError(f"Image too large ({size} bytes, maximum {cls.MAX_FILE_SIZE})")
                except ValueError as e:
                    if "too large" in str(e):
                        raise
                    # Invalid content-length header, continue
                    pass
            
            # Download the actual content
            #logging.info(f"Downloading image from: {final_url}")
            
            response = requests.get(
                final_url,
                headers=headers,
                stream=True,
                timeout=cls.REQUEST_TIMEOUT,
                allow_redirects=False  # Already handled redirects above
            )
            response.raise_for_status()
            
            # Validate downloaded size with streaming
            content = b""
            for chunk in response.iter_content(chunk_size=8192):
                content += chunk
                if len(content) > cls.MAX_FILE_SIZE:
                    raise ValueError(f"Image too large during download (maximum {cls.MAX_FILE_SIZE} bytes)")
            
            # Final size check
            if len(content) == 0:
                raise ValueError("Downloaded image is empty")
            
            # Basic image format validation (magic bytes)
            if not cls._validate_image_format(content):
                raise ValueError("Downloaded content is not a valid image")
            
            #logging.info(f"Successfully downloaded and validated image: {len(content)} bytes")
            return content
            
        except requests.exceptions.Timeout:
            raise ValueError("Request timeout - image server took too long to respond")
        except requests.exceptions.ConnectionError:
            raise ValueError("Connection error - unable to reach image server")
        except requests.exceptions.HTTPError as e:
            raise ValueError(f"HTTP error: {e.response.status_code}")
        except requests.exceptions.RequestException as e:
            raise ValueError(f"Request failed: {str(e)}")
    
    @classmethod
    def _validate_image_format(cls, content):
        """
        Validate image format by checking magic bytes
        Returns True if content appears to be a valid image
        """
        if len(content) < 8:
            return False
        
        # Check magic bytes for common image formats
        # JPEG
        if content.startswith(b'\xFF\xD8\xFF'):
            logging.debug("Detected image format: JPEG")
            return True

        # PNG
        if content.startswith(b'\x89PNG\r\n\x1a\n'):
            logging.debug("Detected image format: PNG")
            return True

        # GIF
        if content.startswith(b'GIF87a') or content.startswith(b'GIF89a'):
            logging.debug("Detected image format: GIF")
            return True

        # BMP
        if content.startswith(b'BM'):
            logging.debug("Detected image format: BMP")
            return True

        # TIFF
        if content.startswith(b'II*\x00') or content.startswith(b'MM\x00*'):
            logging.debug("Detected image format: TIFF")
            return True
        
        # Additional WEBP validation
        if content.startswith(b'RIFF') and b'WEBP' in content[:12]:
            logging.debug("Detected image format: WEBP")
            return True
        
        logging.warning("Unknown or invalid image format detected")
        return False


# Rate limiting helper (simple in-memory implementation)
class URLUploadRateLimit:
    """Simple rate limiting for URL uploads"""
    
    _upload_counts = {}  # user_id -> [(timestamp, count), ...]
    MAX_UPLOADS_PER_HOUR = 20
    
    @classmethod
    def check_rate_limit(cls, user_id):
        """
        Check if user has exceeded rate limit
        Raises ValueError if rate limit exceeded
        """
        import time
        
        current_time = time.time()
        hour_ago = current_time - 3600  # 1 hour ago
        
        # Clean old entries
        if user_id in cls._upload_counts:
            cls._upload_counts[user_id] = [
                (timestamp, count) for timestamp, count in cls._upload_counts[user_id]
                if timestamp > hour_ago
            ]
        
        # Count uploads in last hour
        user_uploads = cls._upload_counts.get(user_id, [])
        total_uploads = sum(count for timestamp, count in user_uploads)
        
        if total_uploads >= cls.MAX_UPLOADS_PER_HOUR:
            raise ValueError(f"Rate limit exceeded: maximum {cls.MAX_UPLOADS_PER_HOUR} URL uploads per hour")
        
        # Record this upload
        if user_id not in cls._upload_counts:
            cls._upload_counts[user_id] = []
        cls._upload_counts[user_id].append((current_time, 1))
        
        #logging.info(f"User {user_id} URL upload count: {total_uploads + 1}/{cls.MAX_UPLOADS_PER_HOUR}")
