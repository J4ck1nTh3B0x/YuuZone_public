import { useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import AuthConsumer from '../components/AuthContext';

/**
 * Custom hook for handling real-time subthread updates
 * Handles subthread joins/leaves, subscriber counts, new subthread creation, subthread updates
 */
export default function useRealtimeSubthread(subthreadId, subthreadName) {
  const { socket } = AuthConsumer();
  const location = useLocation();
  const queryClient = useQueryClient();

  // Check if current page should disable thread API calls
  const shouldDisableThreadApis = useCallback(() => {
    const pathname = location.pathname;
    
    // Pages where thread APIs should be disabled
    const disabledPages = [
      '/profile', // My profile
      '/coin-shop', // Coin shop
      '/subscription', // Subscription
      '/settings', // Settings
      '/login', // Login
      '/register', // Signup
      '/forgot-password', // Forgot password
      '/verify-email', // Email verification
      '/password-reset', // Password reset
      '/account-deletion', // Account deletion
      '/banned', // Banned pages
    ];
    
    // Check if current path matches any disabled page
    return disabledPages.some(page => pathname.startsWith(page));
  }, [location.pathname]);

  // Handle user joining subthread
  const handleSubthreadJoined = useCallback((data) => {
    const { subthreadId: joinedSubthreadId } = data;
    
    if (joinedSubthreadId === subthreadId) {
      console.log('🟢 Subthread joined event received in useRealtimeSubthread:', data);
      
      // Update subscriber count for individual thread
      queryClient.setQueryData(['thread', subthreadName], (oldData) => {
        if (!oldData?.threadData) return oldData;
        
        return {
          ...oldData,
          threadData: {
            ...oldData.threadData,
            subscriberCount: (oldData.threadData.subscriberCount || 0) + 1
          }
        };
      });

      // ALSO update the sidebar cache to keep it in sync
      queryClient.setQueryData(['threads/all'], (oldData) => {
        if (!oldData) return oldData;
        
        const updateSubthreadCount = (threadList) => {
          if (!Array.isArray(threadList)) return threadList;
          return threadList.map(thread => 
            thread.id === subthreadId 
              ? { ...thread, subscriberCount: (thread.subscriberCount || 0) + 1 }
              : thread
          );
        };

        return {
          ...oldData,
          subscribed: updateSubthreadCount(oldData.subscribed),
          all: updateSubthreadCount(oldData.all),
          popular: updateSubthreadCount(oldData.popular)
        };
      });

      // Update subscribers list directly instead of invalidating
      queryClient.setQueryData(['subthreadSubscribers', subthreadId], (oldData) => {
        if (!Array.isArray(oldData)) return oldData;
        return oldData;
      });
    }
  }, [queryClient, subthreadId, subthreadName]);

  // Handle user leaving subthread
  const handleSubthreadLeft = useCallback((data) => {
    const { subthreadId: leftSubthreadId } = data;
    
    if (leftSubthreadId === subthreadId) {
      console.log('🔴 Subthread left event received in useRealtimeSubthread:', data);
      
      // Update subscriber count for individual thread
      queryClient.setQueryData(['thread', subthreadName], (oldData) => {
        if (!oldData?.threadData) return oldData;
        
        return {
          ...oldData,
          threadData: {
            ...oldData.threadData,
            subscriberCount: Math.max(0, (oldData.threadData.subscriberCount || 0) - 1)
          }
        };
      });

      // ALSO update the sidebar cache to keep it in sync
      queryClient.setQueryData(['threads/all'], (oldData) => {
        if (!oldData) return oldData;
        
        const updateSubthreadCount = (threadList) => {
          if (!Array.isArray(threadList)) return threadList;
          return threadList.map(thread => 
            thread.id === subthreadId 
              ? { ...thread, subscriberCount: Math.max(0, (thread.subscriberCount || 0) - 1) }
              : thread
          );
        };

        return {
          ...oldData,
          subscribed: updateSubthreadCount(oldData.subscribed),
          all: updateSubthreadCount(oldData.all),
          popular: updateSubthreadCount(oldData.popular)
        };
      });

      // Update subscribers list directly instead of invalidating
      queryClient.setQueryData(['subthreadSubscribers', subthreadId], (oldData) => {
        if (!Array.isArray(oldData)) return oldData;
        return oldData;
      });
    }
  }, [queryClient, subthreadId, subthreadName]);

  // Handle subthread creation
  const handleSubthreadCreated = useCallback((data) => {
    const { id, name, description, logo } = data;
    const newSubthread = { id, name, description, logo };
    
    queryClient.setQueryData(["subthreads"], (oldData) => {
      if (!Array.isArray(oldData)) return [newSubthread];
      return [newSubthread, ...oldData];
      });
  }, [queryClient]);

  // Handle subthread updates
  const handleSubthreadUpdated = useCallback((data) => {
    const { id, updated_fields } = data;
    
    queryClient.setQueryData(["subthreads"], (oldData) => {
      if (!Array.isArray(oldData)) return oldData;
      return oldData.map(subthread =>
        subthread.id === id ? { ...subthread, ...updated_fields } : subthread
      );
    });
  }, [queryClient]);

  useEffect(() => {
    if (!socket) return;

    // Don't join rooms or set up listeners on disabled pages
    if (shouldDisableThreadApis()) {
      return;
    }

    // Join the subthread room to receive updates
    if (subthreadId) {
      socket.emit('join', { room: subthreadId });
    }

    // Set up event listeners
    socket.on('subthread_joined', handleSubthreadJoined);
    socket.on('subthread_left', handleSubthreadLeft);
    socket.on('subthread_created', handleSubthreadCreated);
    socket.on('subthread_updated', handleSubthreadUpdated);

    return () => {
      // Don't leave rooms on disabled pages (we never joined them)
      if (shouldDisableThreadApis()) {
        return;
      }

      // Leave the subthread room
      if (subthreadId) {
        socket.emit('leave', { room: subthreadId });
      }
      
      // Clean up event listeners
      socket.off('subthread_joined', handleSubthreadJoined);
      socket.off('subthread_left', handleSubthreadLeft);
      socket.off('subthread_created', handleSubthreadCreated);
      socket.off('subthread_updated', handleSubthreadUpdated);
    };
  }, [socket, subthreadId, handleSubthreadJoined, handleSubthreadLeft, handleSubthreadCreated, handleSubthreadUpdated, shouldDisableThreadApis]);

  // Return functions to emit subthread events
  const emitSubthreadUpdate = useCallback((updatedFields, updatedBy) => {
    if (!socket) return;
    
    socket.emit('subthread_updated', {
      subthread_id: subthreadId,
      updated_fields: updatedFields,
      updated_by: updatedBy
    });
  }, [socket, subthreadId]);

  return {
    emitSubthreadUpdate
  };
}
