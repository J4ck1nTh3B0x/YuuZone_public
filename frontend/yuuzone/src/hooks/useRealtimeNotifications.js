import { useEffect, useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import AuthConsumer from '../components/AuthContext';

/**
 * Custom hook for handling real-time notifications
 * Handles mentions, replies, mod actions, bans, and other notification types
 */
export default function useRealtimeNotifications() {
  const { socket, user } = AuthConsumer();
  const queryClient = useQueryClient();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Handle incoming notifications
  const handleNotification = useCallback((data) => {
    const { type, title, message, action_url, sender, timestamp } = data;
    
    const notification = {
      id: Date.now() + Math.random(), // Simple ID generation
      type,
      title,
      message,
      action_url,
      sender,
      timestamp: timestamp || new Date().toISOString(),
      read: false
    };

    // Add notification to state
    setNotifications(prev => [notification, ...prev.slice(0, 49)]); // Keep last 50 notifications
    setUnreadCount(prev => prev + 1);

    // Show browser notification if permission granted
    if (Notification.permission === 'granted') {
      new Notification(title, {
        body: message,
        icon: '/favicon.ico',
        tag: notification.id
      });
    }

    // Update notifications query if it exists
    queryClient.setQueryData(['notifications'], (oldData) => {
      if (!oldData) return [notification];
      return [notification, ...oldData.slice(0, 49)];
    });

    
  }, [queryClient]);

  // Handle profile updates from other users
  const handleProfileUpdated = useCallback((data) => {
    const { username, updated_fields, avatar_url } = data;
    
    // Update user data in relevant queries
    const userQueries = [
      ['search/user'],
      ['subthreadSubscribers'],
      ['comments'],
      ['posts']
    ];

    userQueries.forEach(queryKey => {
      queryClient.setQueryData(queryKey, (oldData) => {
        if (!oldData) return oldData;

        const updateUserData = (item) => {
          if (item.username === username || item.user?.username === username) {
            return {
              ...item,
              ...updated_fields,
              avatar: avatar_url || item.avatar,
              user: item.user ? { ...item.user, ...updated_fields, avatar: avatar_url || item.user.avatar } : item.user
            };
          }
          return item;
        };

        if (Array.isArray(oldData)) {
          return oldData.map(updateUserData);
        } else if (oldData.pages) {
          // Infinite query structure
          return {
            ...oldData,
            pages: oldData.pages.map(page => 
              Array.isArray(page) ? page.map(updateUserData) : page
            )
          };
        }

        return oldData;
      });
    });
  }, [queryClient]);

  // Handle user status changes (online/offline)
  const handleUserStatusChanged = useCallback((data) => {
    const { username, status } = data;
    
    // Update user status in relevant queries
    queryClient.setQueryData(['userStatus', username], status);
    
    // Could also update user lists to show online status
    
  }, [queryClient]);

  // Request notification permission
  const requestNotificationPermission = useCallback(async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }
    return Notification.permission === 'granted';
  }, []);

  // Mark notification as read
  const markAsRead = useCallback((notificationId) => {
    setNotifications(prev => 
      prev.map(notif => 
        notif.id === notificationId ? { ...notif, read: true } : notif
      )
    );
    setUnreadCount(prev => Math.max(0, prev - 1));

    // Update notifications query
    queryClient.setQueryData(['notifications'], (oldData) => {
      if (!oldData) return oldData;
      return oldData.map(notif => 
        notif.id === notificationId ? { ...notif, read: true } : notif
      );
    });
  }, [queryClient]);

  // Mark all notifications as read
  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(notif => ({ ...notif, read: true })));
    setUnreadCount(0);

    // Update notifications query
    queryClient.setQueryData(['notifications'], (oldData) => {
      if (!oldData) return oldData;
      return oldData.map(notif => ({ ...notif, read: true }));
    });
  }, [queryClient]);

  // Clear all notifications
  const clearAllNotifications = useCallback(() => {
    setNotifications([]);
    setUnreadCount(0);
    queryClient.setQueryData(['notifications'], []);
  }, [queryClient]);

  useEffect(() => {
    if (!socket || !user?.username) return;

    // Debounce room joining to prevent spam
    const timeoutId = setTimeout(() => {
    // Join personal room for notifications
    socket.emit('join', { room: `user_${user.username}` });
    }, 500);

    // Set up event listeners
    socket.on('notification', handleNotification);
    socket.on('profile_updated', handleProfileUpdated);
    socket.on('user_status_changed', handleUserStatusChanged);

    return () => {
      clearTimeout(timeoutId);
      // Leave personal room
      socket.emit('leave', { room: `user_${user.username}` });
      
      // Clean up event listeners
      socket.off('notification', handleNotification);
      socket.off('profile_updated', handleProfileUpdated);
      socket.off('user_status_changed', handleUserStatusChanged);
    };
  }, [socket, user?.username, handleNotification, handleProfileUpdated, handleUserStatusChanged]);

  // Send notification to another user
  const sendNotification = useCallback((recipientUsername, type, title, message, actionUrl = null) => {
    if (!socket) return;
    
    socket.emit('notification', {
      recipient_username: recipientUsername,
      type,
      title,
      message,
      action_url: actionUrl,
      sender: user?.username,
      timestamp: new Date().toISOString()
    });
  }, [socket, user?.username]);

  return {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    clearAllNotifications,
    requestNotificationPermission,
    sendNotification
  };
}
