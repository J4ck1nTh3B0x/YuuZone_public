import psutil
import logging
import time
from typing import Dict, List, Optional
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

class SystemMonitor:
    def __init__(self):
        self.cpu_threshold = 90  # CPU usage threshold (%) - increased from 80
        self.memory_threshold = 90  # Memory usage threshold (%) - increased from 85
        self.connection_limit = 150  # Maximum concurrent connections - increased from 100
        self.connection_timeout = 300  # Connection timeout in seconds
        self.active_connections: Dict[str, Dict] = {}
        self.last_cleanup = datetime.now()
        self.cleanup_interval = 120  # Cleanup every 120 seconds - increased from 60
        
    def get_system_stats(self) -> Dict:
        """Get current system statistics"""
        try:
            # Use a shorter interval for CPU check to reduce overhead
            cpu_percent = psutil.cpu_percent(interval=0.1)  # Reduced from 1 second to 0.1 seconds
            memory = psutil.virtual_memory()
            disk = psutil.disk_usage('/')
            
            return {
                'cpu_percent': cpu_percent,
                'memory_percent': memory.percent,
                'memory_available': memory.available,
                'disk_percent': disk.percent,
                'active_connections': len(self.active_connections),
                'timestamp': datetime.now().isoformat()
            }
        except Exception as e:
            logger.error(f"Error getting system stats: {e}")
            return {}
    
    def should_accept_connections(self) -> bool:
        """Auto-decision: Should we accept new connections?"""
        try:
            stats = self.get_system_stats()
            
            # Check CPU usage
            if stats.get('cpu_percent', 0) > self.cpu_threshold:
                logger.warning(f"CPU usage too high: {stats['cpu_percent']}%")
                return False
            
            # Check memory usage
            if stats.get('memory_percent', 0) > self.memory_threshold:
                logger.warning(f"Memory usage too high: {stats['memory_percent']}%")
                return False
            
            # Check connection limit
            if len(self.active_connections) >= self.connection_limit:
                logger.warning(f"Connection limit reached: {len(self.active_connections)}")
                return False
            
            return True
            
        except Exception as e:
            logger.error(f"Error checking connection acceptance: {e}")
            return False
    
    def register_connection(self, connection_id: str, connection_type: str = "unknown") -> bool:
        """Register a new connection"""
        if not self.should_accept_connections():
            return False
        
        self.active_connections[connection_id] = {
            'type': connection_type,
            'created_at': datetime.now(),
            'last_activity': datetime.now(),
            'status': 'active'
        }
        
        logger.info(f"Connection registered: {connection_id} ({connection_type})")
        return True
    
    def update_connection_activity(self, connection_id: str) -> bool:
        """Update connection activity timestamp"""
        if connection_id in self.active_connections:
            self.active_connections[connection_id]['last_activity'] = datetime.now()
            return True
        return False
    
    def remove_connection(self, connection_id: str) -> bool:
        """Remove a connection"""
        if connection_id in self.active_connections:
            connection_info = self.active_connections.pop(connection_id)
            logger.info(f"Connection removed: {connection_id} ({connection_info['type']})")
            return True
        return False
    
    def cleanup_old_connections(self) -> int:
        """Auto-cleanup: Remove stale connections"""
        now = datetime.now()
        removed_count = 0
        
        # Check if it's time for cleanup
        if (now - self.last_cleanup).seconds < self.cleanup_interval:
            return 0
        
        stale_connections = []
        
        for conn_id, conn_info in self.active_connections.items():
            # Check for timeout
            if (now - conn_info['last_activity']).seconds > self.connection_timeout:
                stale_connections.append(conn_id)
        
        # Remove stale connections
        for conn_id in stale_connections:
            if self.remove_connection(conn_id):
                removed_count += 1
        
        if removed_count > 0:
            logger.info(f"Cleaned up {removed_count} stale connections")
        
        self.last_cleanup = now
        return removed_count
    
    def get_connection_stats(self) -> Dict:
        """Get connection statistics"""
        now = datetime.now()
        stats = {
            'total_connections': len(self.active_connections),
            'connection_types': {},
            'oldest_connection': None,
            'newest_connection': None
        }
        
        if self.active_connections:
            for conn_info in self.active_connections.values():
                conn_type = conn_info['type']
                stats['connection_types'][conn_type] = stats['connection_types'].get(conn_type, 0) + 1
            
            # Find oldest and newest connections
            oldest = min(self.active_connections.values(), key=lambda x: x['created_at'])
            newest = max(self.active_connections.values(), key=lambda x: x['created_at'])
            
            stats['oldest_connection'] = {
                'age_seconds': (now - oldest['created_at']).seconds,
                'type': oldest['type']
            }
            stats['newest_connection'] = {
                'age_seconds': (now - newest['created_at']).seconds,
                'type': newest['type']
            }
        
        return stats
    
    def force_cleanup(self) -> int:
        """Force cleanup of all connections"""
        removed_count = len(self.active_connections)
        self.active_connections.clear()
        logger.warning(f"Force cleanup: removed {removed_count} connections")
        return removed_count

# Global instance
system_monitor = SystemMonitor() 