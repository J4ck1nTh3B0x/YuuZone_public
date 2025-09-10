import { useEffect, useCallback, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import AuthConsumer from '../components/AuthContext';

/**
 * Enhanced real-time updates hook that provides additional functionality
 * including live user counts, user activity tracking, and system status updates
 */
export default function useEnhancedRealtimeUpdates(options = {}) {
  const { socket } = AuthConsumer();
  const queryClient = useQueryClient();
  const [liveUserCount, setLiveUserCount] = useState(0);
  const [activeUsers, setActiveUsers] = useState([]);
  const [userActivity, setUserActivity] = useState([]);
  const [systemStatus, setSystemStatus] = useState(null);
  const [performanceAlerts, setPerformanceAlerts] = useState([]);
  const activityTimeoutRef = useRef(new Map());

  const {
    subthreadId,
    enableLiveUserCount = true,
    enableUserActivity = true,
    enableSystemStatus = true,
    activityTimeout = 30000, // 30 seconds
    maxActivityItems = 50
  } = options;

  // Handle live user count updates
  const handleLiveUserCountUpdate = useCallback((data) => {
    const { user_count, active_users } = data;
    setLiveUserCount(user_count);
    setActiveUsers(active_users || []);
  }, []);

  // Handle user activity updates
  const handleUserActivity = useCallback((data) => {
    const { username, activity_type, timestamp } = data;
    
    setUserActivity(prev => {
      const newActivity = {
        username,
        activity_type,
        timestamp: timestamp || new Date().toISOString(),
        id: Date.now() + Math.random()
      };
      
      // Add new activity to the beginning
      const updatedActivity = [newActivity, ...prev];
      
      // Keep only the latest items
      return updatedActivity.slice(0, maxActivityItems);
    });

    // Clear activity after timeout
    if (activityTimeoutRef.current.has(username)) {
      clearTimeout(activityTimeoutRef.current.get(username));
    }
    
    activityTimeoutRef.current.set(username, setTimeout(() => {
      setUserActivity(prev => prev.filter(activity => activity.username !== username));
      activityTimeoutRef.current.delete(username);
    }, activityTimeout));
  }, [maxActivityItems]);

  // Handle system status updates
  const handleSystemStatusUpdate = useCallback((data) => {
    const { status_type, message, severity, timestamp } = data;
    setSystemStatus({
      type: status_type,
      message,
      severity,
      timestamp: timestamp || new Date().toISOString()
    });
  }, []);

  // Handle performance alerts
  const handlePerformanceAlert = useCallback((data) => {
    const { metrics_type, value, threshold, timestamp } = data;
    
    setPerformanceAlerts(prev => {
      const newAlert = {
        type: metrics_type,
        value,
        threshold,
        timestamp: timestamp || new Date().toISOString(),
        id: Date.now() + Math.random()
      };
      
      return [newAlert, ...prev].slice(0, 10); // Keep last 10 alerts
    });
  }, []);

  // Handle subthread stats updates
  const handleSubthreadStatsUpdate = useCallback((data) => {
    const { stats_type, new_value, updated_by } = data;
    
    if (subthreadId) {
      queryClient.setQueryData(['thread', subthreadId], (oldData) => {
        if (!oldData?.threadData) return oldData;
        
        const updatedThreadData = { ...oldData.threadData };
        
        switch (stats_type) {
          case 'posts_count':
            updatedThreadData.PostsCount = Math.max(0, (updatedThreadData.PostsCount || 0) + new_value);
            break;
          case 'subscriber_count':
            updatedThreadData.subscriberCount = Math.max(0, (updatedThreadData.subscriberCount || 0) + new_value);
            break;
          case 'active_users':
            updatedThreadData.activeUsers = new_value;
            break;
          default:
            break;
        }
        
        return {
          ...oldData,
          threadData: updatedThreadData
        };
      });
    }
  }, [queryClient, subthreadId]);

  // Emit user activity
  const emitUserActivity = useCallback((activityType, postId = null) => {
    if (!socket) return;
    
    socket.emit('user_activity', {
      activity_type: activityType,
      subthread_id: subthreadId,
      post_id: postId,
      timestamp: new Date().toISOString()
    });
  }, [socket, subthreadId]);

  // Emit post share
  const emitPostShare = useCallback((postId, sharePlatform) => {
    if (!socket) return;
    
    socket.emit('post_shared', {
      post_id: postId,
      share_platform: sharePlatform,
      subthread_id: subthreadId
    });
  }, [socket, subthreadId]);

  // Emit mention
  const emitMention = useCallback((mentionedUser, postId, commentId, content) => {
    if (!socket) return;
    
    socket.emit('mention', {
      mentioned_user: mentionedUser,
      post_id: postId,
      comment_id: commentId,
      content
    });
  }, [socket]);

  // Clear system status after delay
  useEffect(() => {
    if (systemStatus) {
      const timer = setTimeout(() => {
        setSystemStatus(null);
      }, 5000); // Clear after 5 seconds
      
      return () => clearTimeout(timer);
    }
  }, [systemStatus]);

  // Clear performance alerts after delay
  useEffect(() => {
    if (performanceAlerts && Array.isArray(performanceAlerts) && performanceAlerts.length > 0) {
      const timer = setTimeout(() => {
        setPerformanceAlerts(prev => prev.slice(1)); // Remove oldest alert
      }, 10000); // Clear after 10 seconds
      
      return () => clearTimeout(timer);
    }
  }, [performanceAlerts]);

  // Set up event listeners
  useEffect(() => {
    if (!socket) return;

    // Join subthread room if provided
    if (subthreadId) {
      socket.emit('join', { room: subthreadId });
    }

    // Set up event listeners
    if (enableLiveUserCount) {
      socket.on('live_user_count_updated', handleLiveUserCountUpdate);
    }
    
    if (enableUserActivity) {
      socket.on('user_activity', handleUserActivity);
    }
    
    if (enableSystemStatus) {
      socket.on('system_status_update', handleSystemStatusUpdate);
      socket.on('performance_alert', handlePerformanceAlert);
    }

    socket.on('subthread_stats_updated', handleSubthreadStatsUpdate);

    return () => {
      // Leave subthread room
      if (subthreadId) {
        socket.emit('leave', { room: subthreadId });
      }
      
      // Clean up event listeners
      socket.off('live_user_count_updated', handleLiveUserCountUpdate);
      socket.off('user_activity', handleUserActivity);
      socket.off('system_status_update', handleSystemStatusUpdate);
      socket.off('performance_alert', handlePerformanceAlert);
      socket.off('subthread_stats_updated', handleSubthreadStatsUpdate);
      
      // Clear activity timeouts
      activityTimeoutRef.current.forEach(timeout => clearTimeout(timeout));
      activityTimeoutRef.current.clear();
    };
  }, [
    socket, 
    subthreadId, 
    enableLiveUserCount, 
    enableUserActivity, 
    enableSystemStatus,
    handleLiveUserCountUpdate,
    handleUserActivity,
    handleSystemStatusUpdate,
    handlePerformanceAlert,
    handleSubthreadStatsUpdate
  ]);

  return {
    // State
    liveUserCount,
    activeUsers,
    userActivity,
    systemStatus,
    performanceAlerts,
    
    // Actions
    emitUserActivity,
    emitPostShare,
    emitMention,
    
    // Utilities
    clearSystemStatus: () => setSystemStatus(null),
    clearPerformanceAlerts: () => setPerformanceAlerts([]),
    clearUserActivity: () => setUserActivity([])
  };
} 