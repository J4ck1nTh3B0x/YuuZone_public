import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import PropTypes from 'prop-types';

SmartNotificationSystem.propTypes = {
  children: PropTypes.node.isRequired,
  updateStats: PropTypes.object,
  showUpdateIndicator: PropTypes.bool
};

export default function SmartNotificationSystem({ children, updateStats, showUpdateIndicator = true }) {
  const { t } = useTranslation();
  const [notifications, setNotifications] = useState([]);
  const [showUpdateBanner, setShowUpdateBanner] = useState(false);
  const [lastUpdateCount, setLastUpdateCount] = useState(0);
  const notificationTimeoutRef = useRef(null);
  const bannerTimeoutRef = useRef(null);

  // Handle new updates
  const addNotification = useCallback((message, type = 'info', duration = 3000) => {
    const id = Date.now() + Math.random();
    const notification = { id, message, type, timestamp: Date.now() };
    
    setNotifications(prev => [...prev, notification]);
    
    // Auto-remove notification
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, duration);
  }, []);

  // Show update banner when there are significant updates
  useEffect(() => {
    if (!updateStats || !showUpdateIndicator) return;
    
    const currentUpdates = updateStats.totalUpdates || 0;
    const updateDifference = currentUpdates - lastUpdateCount;
    
    if (updateDifference > 0 && updateDifference % 5 === 0) {
      // Show banner every 5 updates
      setShowUpdateBanner(true);
      
      // Clear existing timeout
      if (bannerTimeoutRef.current) {
        clearTimeout(bannerTimeoutRef.current);
      }
      
      // Hide banner after 3 seconds
      bannerTimeoutRef.current = setTimeout(() => {
        setShowUpdateBanner(false);
      }, 3000);
    }
    
    setLastUpdateCount(currentUpdates);
  }, [updateStats, lastUpdateCount, showUpdateIndicator]);

  // Notification variants
  const notificationVariants = {
    initial: { 
      opacity: 0, 
      y: -50, 
      scale: 0.8,
      x: '100%'
    },
    animate: { 
      opacity: 1, 
      y: 0, 
      scale: 1,
      x: 0,
      transition: {
        type: "spring",
        stiffness: 300,
        damping: 30
      }
    },
    exit: { 
      opacity: 0, 
      y: -50, 
      scale: 0.8,
      x: '100%',
      transition: {
        duration: 0.2
      }
    }
  };

  const bannerVariants = {
    initial: { 
      opacity: 0, 
      y: -100,
      scale: 0.95
    },
    animate: { 
      opacity: 1, 
      y: 0,
      scale: 1,
      transition: {
        type: "spring",
        stiffness: 200,
        damping: 25
      }
    },
    exit: { 
      opacity: 0, 
      y: -100,
      scale: 0.95,
      transition: {
        duration: 0.3
      }
    }
  };

  return (
    <div className="relative">
      {/* Update banner */}
      <AnimatePresence>
        {showUpdateBanner && (
          <motion.div
            className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center space-x-2"
            variants={bannerVariants}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
            <span className="text-sm font-medium">
              {t('notifications.newUpdatesAvailable')}
            </span>
            <button
              onClick={() => setShowUpdateBanner(false)}
              className="ml-2 text-white hover:text-gray-200 transition-colors"
            >
              ×
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Notification stack */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        <AnimatePresence>
          {notifications.map((notification) => (
            <motion.div
              key={notification.id}
              className={`px-4 py-3 rounded-lg shadow-lg max-w-sm ${
                notification.type === 'success' ? 'bg-green-500 text-white' :
                notification.type === 'error' ? 'bg-red-500 text-white' :
                notification.type === 'warning' ? 'bg-yellow-500 text-white' :
                'bg-blue-500 text-white'
              }`}
              variants={notificationVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              layout
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{notification.message}</span>
                <button
                  onClick={() => setNotifications(prev => 
                    prev.filter(n => n.id !== notification.id)
                  )}
                  className="ml-2 text-white hover:text-gray-200 transition-colors"
                >
                  ×
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Main content */}
      {children}

      {/* Update stats indicator (debug mode) */}
      {process.env.NODE_ENV === 'development' && updateStats && (
        <div className="fixed bottom-4 right-4 bg-gray-800 text-white px-3 py-2 rounded-lg text-xs opacity-75">
          <div>Updates: {updateStats.totalUpdates}</div>
          <div>Batched: {updateStats.batchedUpdates}</div>
          <div>Skipped: {updateStats.skippedUpdates}</div>
        </div>
      )}
    </div>
  );
}

// Export utility functions for other components
export const useSmartNotifications = () => {
  const [notifications, setNotifications] = useState([]);
  
  const addNotification = useCallback((message, type = 'info', duration = 3000) => {
    const id = Date.now() + Math.random();
    const notification = { id, message, type, timestamp: Date.now() };
    
    setNotifications(prev => [...prev, notification]);
    
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, duration);
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  return {
    notifications,
    addNotification,
    clearNotifications
  };
}; 