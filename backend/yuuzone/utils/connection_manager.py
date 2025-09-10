import logging
import asyncio
import threading
import time
from typing import Dict, List, Optional, Callable
from datetime import datetime, timedelta
from .system_monitor import system_monitor

logger = logging.getLogger(__name__)

class ConnectionManager:
    def __init__(self):
        self.connections: Dict[str, Dict] = {}
        self.health_check_interval = 30  # seconds
        self.max_connection_age = 3600  # 1 hour
        self.auto_cleanup_enabled = True
        self.health_check_thread = None
        self.is_running = False
        
        # Connection type handlers
        self.connection_handlers: Dict[str, Callable] = {
            'websocket': self._handle_websocket_cleanup,
            'http': self._handle_http_cleanup,
            'database': self._handle_database_cleanup,
            'translation': self._handle_translation_cleanup
        }
    
    def start_health_checker(self):
        """Start the health check thread"""
        if self.health_check_thread is None or not self.health_check_thread.is_alive():
            self.is_running = True
            self.health_check_thread = threading.Thread(target=self._health_check_loop, daemon=True)
            self.health_check_thread.start()
            logger.info("Connection health checker started")
    
    def stop_health_checker(self):
        """Stop the health check thread"""
        self.is_running = False
        if self.health_check_thread and self.health_check_thread.is_alive():
            self.health_check_thread.join(timeout=5)
            logger.info("Connection health checker stopped")
    
    def register_connection(self, connection_id: str, connection_type: str, 
                          metadata: Dict = None, cleanup_callback: Callable = None) -> bool:
        """Register a new connection with auto-management"""
        if not system_monitor.should_accept_connections():
            logger.warning(f"System overloaded, rejecting connection: {connection_id}")
            return False
        
        # Register with system monitor
        if not system_monitor.register_connection(connection_id, connection_type):
            return False
        
        # Register with connection manager
        self.connections[connection_id] = {
            'type': connection_type,
            'created_at': datetime.now(),
            'last_activity': datetime.now(),
            'status': 'active',
            'metadata': metadata or {},
            'cleanup_callback': cleanup_callback,
            'health_score': 100,  # 0-100 health score
            'error_count': 0
        }
        
        logger.info(f"Connection registered: {connection_id} ({connection_type})")
        return True
    
    def update_connection_activity(self, connection_id: str, health_score: int = None) -> bool:
        """Update connection activity and health"""
        if connection_id in self.connections:
            self.connections[connection_id]['last_activity'] = datetime.now()
            
            if health_score is not None:
                self.connections[connection_id]['health_score'] = max(0, min(100, health_score))
            
            # Update system monitor
            system_monitor.update_connection_activity(connection_id)
            return True
        return False
    
    def remove_connection(self, connection_id: str, reason: str = "manual") -> bool:
        """Remove a connection with cleanup"""
        if connection_id in self.connections:
            conn_info = self.connections[connection_id]
            
            # Call cleanup callback if exists
            if conn_info.get('cleanup_callback'):
                try:
                    conn_info['cleanup_callback'](connection_id)
                except Exception as e:
                    logger.error(f"Error in cleanup callback for {connection_id}: {e}")
            
            # Remove from connection manager
            self.connections.pop(connection_id)
            
            # Remove from system monitor
            system_monitor.remove_connection(connection_id)
            
            logger.info(f"Connection removed: {connection_id} ({conn_info['type']}) - {reason}")
            return True
        return False
    
    def auto_manage_connections(self) -> Dict:
        """Auto-decision logic for connection management"""
        stats = {
            'total_connections': len(self.connections),
            'connections_removed': 0,
            'connections_health_checked': 0,
            'system_cleanup': 0
        }
        
        # Run system monitor cleanup
        stats['system_cleanup'] = system_monitor.cleanup_old_connections()
        
        # Check each connection
        connections_to_remove = []
        
        for conn_id, conn_info in self.connections.items():
            stats['connections_health_checked'] += 1
            
            # Check connection age
            age_seconds = (datetime.now() - conn_info['created_at']).seconds
            if age_seconds > self.max_connection_age:
                connections_to_remove.append((conn_id, "max_age_exceeded"))
                continue
            
            # Check health score
            if conn_info['health_score'] < 20:  # Very unhealthy
                connections_to_remove.append((conn_id, "health_score_low"))
                continue
            
            # Check last activity
            last_activity_seconds = (datetime.now() - conn_info['last_activity']).seconds
            if last_activity_seconds > 300:  # 5 minutes inactive
                connections_to_remove.append((conn_id, "inactive"))
                continue
        
        # Remove unhealthy connections
        for conn_id, reason in connections_to_remove:
            if self.remove_connection(conn_id, reason):
                stats['connections_removed'] += 1
        
        return stats
    
    def _health_check_loop(self):
        """Background health check loop"""
        while self.is_running:
            try:
                if self.auto_cleanup_enabled:
                    stats = self.auto_manage_connections()
                    
                    if stats['connections_removed'] > 0 or stats['system_cleanup'] > 0:
                        logger.info(f"Health check: {stats}")
                
                time.sleep(self.health_check_interval)
                
            except Exception as e:
                logger.error(f"Error in health check loop: {e}")
                time.sleep(5)  # Short delay on error
    
    def get_connection_stats(self) -> Dict:
        """Get detailed connection statistics"""
        stats = {
            'total_connections': len(self.connections),
            'connection_types': {},
            'health_distribution': {'excellent': 0, 'good': 0, 'poor': 0, 'critical': 0},
            'oldest_connection': None,
            'newest_connection': None,
            'system_stats': system_monitor.get_system_stats()
        }
        
        if self.connections:
            for conn_info in self.connections.values():
                # Count by type
                conn_type = conn_info['type']
                stats['connection_types'][conn_type] = stats['connection_types'].get(conn_type, 0) + 1
                
                # Count by health
                health_score = conn_info['health_score']
                if health_score >= 80:
                    stats['health_distribution']['excellent'] += 1
                elif health_score >= 60:
                    stats['health_distribution']['good'] += 1
                elif health_score >= 30:
                    stats['health_distribution']['poor'] += 1
                else:
                    stats['health_distribution']['critical'] += 1
            
            # Find oldest and newest
            oldest = min(self.connections.values(), key=lambda x: x['created_at'])
            newest = max(self.connections.values(), key=lambda x: x['created_at'])
            
            stats['oldest_connection'] = {
                'age_seconds': (datetime.now() - oldest['created_at']).seconds,
                'type': oldest['type'],
                'health_score': oldest['health_score']
            }
            stats['newest_connection'] = {
                'age_seconds': (datetime.now() - newest['created_at']).seconds,
                'type': newest['type'],
                'health_score': newest['health_score']
            }
        
        return stats
    
    def force_cleanup_all(self) -> int:
        """Force cleanup of all connections"""
        removed_count = 0
        
        for conn_id in list(self.connections.keys()):
            if self.remove_connection(conn_id, "force_cleanup"):
                removed_count += 1
        
        # Also force system monitor cleanup
        system_monitor.force_cleanup()
        
        logger.warning(f"Force cleanup: removed {removed_count} connections")
        return removed_count
    
    # Connection type specific handlers
    def _handle_websocket_cleanup(self, connection_id: str):
        """Handle WebSocket connection cleanup"""
        logger.debug(f"WebSocket cleanup for: {connection_id}")
    
    def _handle_http_cleanup(self, connection_id: str):
        """Handle HTTP connection cleanup"""
        logger.debug(f"HTTP cleanup for: {connection_id}")
    
    def _handle_database_cleanup(self, connection_id: str):
        """Handle database connection cleanup"""
        logger.debug(f"Database cleanup for: {connection_id}")
    
    def _handle_translation_cleanup(self, connection_id: str):
        """Handle translation connection cleanup"""
        logger.debug(f"Translation cleanup for: {connection_id}")

# Global instance
connection_manager = ConnectionManager() 