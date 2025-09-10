#!/usr/bin/env python3
"""
Periodic Materialized View Refresher
Automatically refreshes the subthread_stats_mv materialized view every few minutes
to ensure sidebar subscriber counts stay accurate.
"""

import threading
import time
import logging
from datetime import datetime
from sqlalchemy import text

logger = logging.getLogger(__name__)

class MaterializedViewRefresher:
    """Background service to periodically refresh materialized views"""
    
    def __init__(self, app, db, refresh_interval_minutes=5):
        """
        Initialize the refresher
        
        Args:
            app: Flask app instance
            db: SQLAlchemy database instance
            refresh_interval_minutes: How often to refresh (default: 5 minutes)
        """
        self.app = app
        self.db = db
        self.refresh_interval = refresh_interval_minutes * 60  # Convert to seconds
        self.running = False
        self.thread = None
        self.last_refresh = None
        self.refresh_count = 0
        
    def start(self):
        """Start the background refresh thread"""
        if self.running:
            logger.warning("Materialized view refresher is already running")
            return
            
        self.running = True
        self.thread = threading.Thread(target=self._refresh_loop, daemon=True)
        self.thread.start()
        logger.info(f"🔄 Materialized view refresher started (interval: {self.refresh_interval//60} minutes)")
        
    def stop(self):
        """Stop the background refresh thread"""
        self.running = False
        if self.thread:
            self.thread.join(timeout=5)
        logger.info("🛑 Materialized view refresher stopped")
        
    def _refresh_loop(self):
        """Main refresh loop that runs in background thread"""
        while self.running:
            try:
                self._refresh_materialized_view()
                time.sleep(self.refresh_interval)
            except Exception as e:
                logger.error(f"❌ Error in materialized view refresh loop: {e}")
                # Wait a bit before retrying
                time.sleep(60)
                
    def _refresh_materialized_view(self):
        """Refresh the subthread_stats_mv materialized view"""
        try:
            start_time = time.time()
            
            # Use Flask app context for database operations
            with self.app.app_context():
                # Refresh the materialized view
                self.db.session.execute(text("REFRESH MATERIALIZED VIEW subthread_stats_mv"))
                self.db.session.commit()
            
            end_time = time.time()
            self.last_refresh = datetime.now()
            self.refresh_count += 1
            
            logger.info(f"✅ Materialized view refreshed successfully! "
                       f"(#{self.refresh_count}, took {end_time - start_time:.2f}s)")
            
        except Exception as e:
            logger.error(f"❌ Failed to refresh materialized view: {e}")
            # Don't commit on error
            try:
                with self.app.app_context():
                    self.db.session.rollback()
            except:
                pass
            
    def get_status(self):
        """Get the current status of the refresher"""
        return {
            "running": self.running,
            "refresh_interval_minutes": self.refresh_interval // 60,
            "last_refresh": self.last_refresh.isoformat() if self.last_refresh else None,
            "refresh_count": self.refresh_count,
            "thread_alive": self.thread.is_alive() if self.thread else False
        }
        
    def manual_refresh(self):
        """Manually trigger a refresh (for testing/debugging)"""
        logger.info("🔄 Manual materialized view refresh triggered")
        self._refresh_materialized_view()

# Global instance
materialized_view_refresher = None

def init_materialized_view_refresher(app, db, refresh_interval_minutes=5):
    """Initialize and start the materialized view refresher"""
    global materialized_view_refresher
    
    try:
        materialized_view_refresher = MaterializedViewRefresher(app, db, refresh_interval_minutes)
        materialized_view_refresher.start()
        
        # Add cleanup on app shutdown
        import atexit
        atexit.register(materialized_view_refresher.stop)
        
        logger.info(f"✅ Materialized view refresher initialized (interval: {refresh_interval_minutes} minutes)")
        return materialized_view_refresher
        
    except Exception as e:
        logger.error(f"❌ Failed to initialize materialized view refresher: {e}")
        return None

def get_materialized_view_refresher():
    """Get the global materialized view refresher instance"""
    return materialized_view_refresher 