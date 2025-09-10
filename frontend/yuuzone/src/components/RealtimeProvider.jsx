import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import AuthConsumer from './AuthContext';
import useRealtimeNotifications from '../hooks/useRealtimeNotifications';

/**
 * Global real-time provider that handles app-wide real-time features
 * This component should be placed high in the component tree to ensure
 * real-time functionality is available throughout the app
 */
export default function RealtimeProvider({ children }) {
  const { socket, user } = AuthConsumer();
  const location = useLocation();
  
  // Initialize global real-time notifications
  const { 
    notifications, 
    unreadCount, 
    requestNotificationPermission 
  } = useRealtimeNotifications();

  // Request notification permission on first load
  useEffect(() => {
    if (user && 'Notification' in window) {
      requestNotificationPermission();
    }
  }, [user, requestNotificationPermission]);

  // Handle route changes for socket room management
  useEffect(() => {
    if (!socket || !user) return;

    // Extract route information
    const pathSegments = location.pathname.split('/').filter(Boolean);
    const currentRoute = pathSegments[0];
    const routeParam = pathSegments[1];

    // Debounce room changes to reduce socket spam
    const timeoutId = setTimeout(() => {
    // Join appropriate rooms based on current route
    switch (currentRoute) {
      case 'thread':
        if (routeParam) {
          // Join subthread room
          socket.emit('join', { room: routeParam });
        }
        break;
      
      case 'post':
        if (routeParam) {
          // Join post room for comments
          socket.emit('join', { room: routeParam });
        }
        break;
      
      case 'profile':
        // Already joined personal room in useRealtimeNotifications
        break;
      
      case 'inbox':
        // Join chat rooms as needed
        break;
      
      default:
        // For home page and other routes, join general rooms
        socket.emit('join', { room: 'general' });
        break;
    }
    }, 300); // 300ms debounce for route changes

    // Cleanup function to leave rooms when route changes
    return () => {
      clearTimeout(timeoutId);
      if (currentRoute === 'thread' && routeParam) {
        socket.emit('leave', { room: routeParam });
      } else if (currentRoute === 'post' && routeParam) {
        socket.emit('leave', { room: routeParam });
      } else {
        socket.emit('leave', { room: 'general' });
      }
    };
  }, [socket, user, location.pathname]);

  // Handle global socket events
  useEffect(() => {
    if (!socket) return;

    // Handle connection status
    const handleConnect = () => {

    };

    const handleDisconnect = () => {

    };

    const handleReconnect = () => {

      // Rejoin rooms after reconnection
      if (user?.username) {
        socket.emit('join', { room: `user_${user.username}` });
      }
    };

    // Handle global announcements
    const handleAnnouncement = (data) => {

      // Could show a toast notification or banner
    };

    // Handle server maintenance notifications
    const handleMaintenance = (data) => {

      // Could show a maintenance banner
    };

    // Set up global event listeners
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('reconnect', handleReconnect);
    socket.on('announcement', handleAnnouncement);
    socket.on('maintenance', handleMaintenance);

    return () => {
      // Clean up global event listeners
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('reconnect', handleReconnect);
      socket.off('announcement', handleAnnouncement);
      socket.off('maintenance', handleMaintenance);
    };
  }, [socket, user]);

  // Provide real-time status to child components
  const realtimeStatus = {
    isConnected: socket?.connected || false,
    notifications,
    unreadCount
  };

  return (
    <div data-realtime-provider="true" data-realtime-status={JSON.stringify(realtimeStatus)}>
      {children}
    </div>
  );
}
