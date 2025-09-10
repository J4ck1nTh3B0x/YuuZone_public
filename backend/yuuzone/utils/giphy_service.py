import requests
import os
from typing import List, Dict, Optional
import logging

class GiphyService:
    def __init__(self):
        self.api_key = os.environ.get('GIPHY_API_KEY', 'SJivUkcy9Hsw3sJsyg3cJKLVvWipO1ex')
        self.base_url = "https://api.giphy.com/v1/gifs"
    
    def search_gifs(self, query: str, limit: int = 20, offset: int = 0, rating: str = 'g', lang: str = 'en') -> List[Dict]:
        """
        Search for GIFs using Giphy API
        
        Args:
            query (str): Search query
            limit (int): Number of results to return (max 50)
            offset (int): Offset for pagination (max 499)
            rating (str): Content rating (g, pg, pg-13, r)
            lang (str): Language code (default: 'en')
            
        Returns:
            List[Dict]: List of GIF objects with url, title, and other metadata
        """
        try:
            url = f"{self.base_url}/search"
            params = {
                'api_key': self.api_key,
                'q': query,
                'limit': min(limit, 50),  # Giphy max limit is 50
                'offset': min(offset, 499),  # Giphy max offset is 499
                'rating': rating,
                'lang': lang
            }
            
            response = requests.get(url, params=params, timeout=10)
            response.raise_for_status()
            
            data = response.json()
            
            # Check for synthetic response (error state)
            if data.get('meta', {}).get('response_id') == '' and data.get('meta', {}).get('status') == 200:
                logging.warning("Giphy API returned synthetic response - treating as error")
                return []
            
            gifs = []
            
            for gif in data.get('data', []):
                gif_info = self._parse_gif_data(gif)
                if gif_info:
                    gifs.append(gif_info)
            
            return gifs
            
        except requests.RequestException as e:
            logging.error(f"Giphy API request failed: {e}")
            return []
        except Exception as e:
            logging.error(f"Giphy service error: {e}")
            return []
    
    def get_trending_gifs(self, limit: int = 20, offset: int = 0, rating: str = 'g') -> List[Dict]:
        """
        Get trending GIFs from Giphy
        
        Args:
            limit (int): Number of results to return (max 50)
            offset (int): Offset for pagination (max 499)
            rating (str): Content rating (g, pg, pg-13, r)
            
        Returns:
            List[Dict]: List of trending GIF objects
        """
        try:
            url = f"{self.base_url}/trending"
            params = {
                'api_key': self.api_key,
                'limit': min(limit, 50),
                'offset': min(offset, 499),
                'rating': rating
            }
            
            response = requests.get(url, params=params, timeout=10)
            response.raise_for_status()
            
            data = response.json()
            
            # Check for synthetic response (error state)
            if data.get('meta', {}).get('response_id') == '' and data.get('meta', {}).get('status') == 200:
                logging.warning("Giphy API returned synthetic response - treating as error")
                return []
            
            gifs = []
            
            for gif in data.get('data', []):
                gif_info = self._parse_gif_data(gif)
                if gif_info:
                    gifs.append(gif_info)
            
            return gifs
            
        except requests.RequestException as e:
            logging.error(f"Giphy trending API request failed: {e}")
            return []
        except Exception as e:
            logging.error(f"Giphy trending service error: {e}")
            return []
    
    def get_gif_by_id(self, gif_id: str) -> Optional[Dict]:
        """
        Get a specific GIF by ID
        
        Args:
            gif_id (str): Giphy GIF ID
            
        Returns:
            Optional[Dict]: GIF object or None if not found
        """
        try:
            url = f"{self.base_url}/{gif_id}"
            params = {
                'api_key': self.api_key
            }
            
            response = requests.get(url, params=params, timeout=10)
            response.raise_for_status()
            
            data = response.json()
            
            # Check for synthetic response (error state)
            if data.get('meta', {}).get('response_id') == '' and data.get('meta', {}).get('status') == 200:
                logging.warning("Giphy API returned synthetic response - treating as error")
                return None
            
            gif = data.get('data', {})
            
            if gif:
                return self._parse_gif_data(gif)
            
            return None
            
        except requests.RequestException as e:
            logging.error(f"Giphy GIF ID API request failed: {e}")
            return None
        except Exception as e:
            logging.error(f"Giphy GIF ID service error: {e}")
            return None
    
    def _parse_gif_data(self, gif: Dict) -> Optional[Dict]:
        """
        Parse Giphy GIF data into standardized format
        
        Args:
            gif (Dict): Raw GIF data from Giphy API
            
        Returns:
            Optional[Dict]: Parsed GIF data or None if invalid
        """
        try:
            images = gif.get('images', {})
            
            # Get the best available URLs for different use cases
            original = images.get('original', {})
            preview_gif = images.get('preview_gif', {})
            fixed_height = images.get('fixed_height', {})
            fixed_width = images.get('fixed_width', {})
            downsized = images.get('downsized', {})
            downsized_small = images.get('downsized_small', {})
            
            gif_info = {
                'id': gif.get('id'),
                'title': gif.get('title', ''),
                'url': original.get('url') or fixed_height.get('url') or fixed_width.get('url'),
                'preview_url': preview_gif.get('url') or downsized.get('url') or downsized_small.get('url'),
                'width': original.get('width'),
                'height': original.get('height'),
                'size': original.get('size'),
                'webp_url': original.get('webp'),
                'mp4_url': images.get('original_mp4', {}).get('mp4'),
                'analytics': gif.get('analytics', {}),
                'rating': gif.get('rating'),
                'username': gif.get('username'),
                'source': gif.get('source'),
                'source_tld': gif.get('source_tld'),
                'source_post_url': gif.get('source_post_url'),
                'is_sticker': gif.get('is_sticker', False),
                'import_datetime': gif.get('import_datetime'),
                'trending_datetime': gif.get('trending_datetime'),
                'user': gif.get('user', {})
            }
            
            return gif_info
            
        except Exception as e:
            logging.error(f"Error parsing GIF data: {e}")
            return None
    
    def register_action(self, gif_id: str, action_type: str, user_id: str = None) -> bool:
        """
        Register user actions for analytics (view, click, send)
        
        Args:
            gif_id (str): Giphy GIF ID
            action_type (str): Action type ('onload', 'onclick', 'onsent')
            user_id (str): Optional user ID for tracking
            
        Returns:
            bool: True if action was registered successfully
        """
        try:
            # First get the GIF to get analytics URLs
            gif_data = self.get_gif_by_id(gif_id)
            if not gif_data or not gif_data.get('analytics'):
                return False
            
            analytics = gif_data['analytics']
            action_url = analytics.get(action_type, {}).get('url')
            
            if not action_url:
                return False
            
            # Make the analytics request
            response = requests.get(action_url, timeout=5)
            return response.status_code == 200
            
        except Exception as e:
            logging.error(f"Failed to register Giphy action: {e}")
            return False 