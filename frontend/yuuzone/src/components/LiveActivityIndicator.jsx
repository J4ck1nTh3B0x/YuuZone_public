import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import PropTypes from 'prop-types';
import useEnhancedRealtimeUpdates from '../hooks/useEnhancedRealtimeUpdates';

LiveActivityIndicator.propTypes = {
  subthreadId: PropTypes.string,
  showUserCount: PropTypes.bool,
  showActivity: PropTypes.bool,
  showSystemStatus: PropTypes.bool,
  maxActivityItems: PropTypes.number,
  className: PropTypes.string
};

export default function LiveActivityIndicator({ 
  subthreadId, 
  showUserCount = true, 
  showActivity = true, 
  showSystemStatus = true,
  maxActivityItems = 5,
  className = ""
}) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  
  const {
    liveUserCount,
    activeUsers,
    userActivity,
    systemStatus,
    performanceAlerts,
    emitUserActivity
  } = useEnhancedRealtimeUpdates({
    subthreadId,
    enableLiveUserCount: showUserCount,
    enableUserActivity: showActivity,
    enableSystemStatus: showSystemStatus,
    maxActivityItems
  });

  // Emit browsing activity when component mounts
  useEffect(() => {
    if (subthreadId) {
      emitUserActivity('browsing');
    }
  }, [subthreadId, emitUserActivity]);

  const getActivityIcon = (activityType) => {
    switch (activityType) {
      case 'posting':
        return '📝';
      case 'commenting':
        return '💬';
      case 'voting':
        return '👍';
      case 'browsing':
        return '👀';
      case 'joining':
        return '➕';
      case 'leaving':
        return '➖';
      default:
        return '👤';
    }
  };

  const getActivityText = (activityType) => {
    switch (activityType) {
      case 'posting':
        return t('activity.posting');
      case 'commenting':
        return t('activity.commenting');
      case 'voting':
        return t('activity.voting');
      case 'browsing':
        return t('activity.browsing');
      case 'joining':
        return t('activity.joining');
      case 'leaving':
        return t('activity.leaving');
      default:
        return t('activity.unknown');
    }
  };

  const getSystemStatusColor = (severity) => {
    switch (severity) {
      case 'error':
        return 'text-red-500 bg-red-50 border-red-200';
      case 'warning':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'info':
        return 'text-blue-600 bg-blue-50 border-blue-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getSystemStatusIcon = (type) => {
    switch (type) {
      case 'maintenance':
        return '🔧';
      case 'performance':
        return '⚡';
      case 'error':
        return '⚠️';
      default:
        return 'ℹ️';
    }
  };

  if (!showUserCount && !showActivity && !showSystemStatus) {
    return null;
  }

  return (
    <div className={`live-activity-indicator ${className}`}>
      {/* Live User Count */}
      {showUserCount && liveUserCount > 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 mb-2"
        >
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <span>{t('live.users', { count: liveUserCount })}</span>
          {activeUsers.length > 0 && (
            <span className="text-xs text-gray-500">
              ({activeUsers.slice(0, 3).join(', ')}{activeUsers.length > 3 ? '...' : ''})
            </span>
          )}
        </motion.div>
      )}

      {/* System Status */}
      <AnimatePresence>
        {showSystemStatus && systemStatus && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`p-2 rounded-lg border text-sm mb-2 ${getSystemStatusColor(systemStatus.severity)}`}
          >
            <div className="flex items-center gap-2">
              <span>{getSystemStatusIcon(systemStatus.type)}</span>
              <span className="font-medium">{systemStatus.message}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Performance Alerts */}
      <AnimatePresence>
        {showSystemStatus && performanceAlerts.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-2 rounded-lg border border-orange-200 bg-orange-50 text-orange-700 text-sm mb-2"
          >
            <div className="flex items-center gap-2">
              <span>⚡</span>
              <span>{t('performance.alert')}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* User Activity */}
      {showActivity && userActivity.length > 0 && (
        <div className="space-y-1">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
          >
            {isExpanded ? t('activity.hide') : t('activity.show')} ({userActivity.length})
          </button>
          
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-1"
              >
                {userActivity.slice(0, maxActivityItems).map((activity) => (
                  <motion.div
                    key={activity.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400"
                  >
                    <span>{getActivityIcon(activity.activity_type)}</span>
                    <span className="font-medium">{activity.username}</span>
                    <span>{getActivityText(activity.activity_type)}</span>
                    <span className="text-gray-400">
                      {new Date(activity.timestamp).toLocaleTimeString()}
                    </span>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
} 