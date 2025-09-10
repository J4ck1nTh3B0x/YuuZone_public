import { useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import AuthConsumer from '../components/AuthContext';

/**
 * Custom hook for handling real-time user management updates
 * Handles user bans/unbans, mod additions/removals, admin transfers, role changes
 */
export default function useRealtimeUserManagement(subthreadId) {
  const { socket, user } = AuthConsumer();
  const location = useLocation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Check if current page should disable user management API calls
  const shouldDisableThreadApis = useCallback(() => {
    const pathname = location.pathname;
    
    // Pages where user management APIs should be disabled
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

  // Handle user ban
  const handleUserBanned = useCallback((data) => {
    const { user_id } = data;
    
    // Remove user from subscribers list
    queryClient.setQueryData(["subthreadSubscribers", subthreadId], (oldData) => {
      if (!Array.isArray(oldData)) return oldData;
      return oldData.filter(user => user.id !== user_id);
    });
    
    // Update subscriber count
    queryClient.setQueryData(["subthread", subthreadId], (oldData) => {
      if (!oldData?.threadData) return oldData;
      return {
        ...oldData,
        threadData: {
          ...oldData.threadData,
          subscriberCount: Math.max(0, (oldData.threadData.subscriberCount || 0) - 1)
        }
      };
    });


  }, [queryClient, subthreadId]);

  // Handle user unban events
  const handleUserUnbanned = useCallback((data) => {
    const { username, unbanned_by } = data;
    
    // Update user management data with direct cache updates instead of invalidation
    queryClient.setQueryData(['subthreadSubscribers', subthreadId], (oldData) => {
      if (!Array.isArray(oldData)) return oldData;
      // Add the unbanned user back to the list if needed
      return oldData;
    });
    

  }, [queryClient, subthreadId]);

  // Handle when current user gets banned
  const handleYouWereBanned = useCallback((data) => {
    const { subthread_id } = data;
    
    if (subthread_id === subthreadId) {
      // Redirect to banned page
      navigate(`/banned/${subthread_id}`);
      
      // Clear relevant queries
      queryClient.removeQueries(['thread', subthreadId]);
      queryClient.removeQueries(['posts', 'thread', subthreadId]);
    }
  }, [navigate, queryClient, subthreadId]);

  // Handle when current user gets unbanned
  const handleYouWereUnbanned = useCallback((data) => {
    const { subthread_id, unbanned_by } = data;
    
    if (subthread_id === subthreadId) {
      // Update subthread data directly instead of invalidating
      queryClient.setQueryData(['thread', subthreadId], (oldData) => {
        if (!oldData?.threadData) return oldData;
        return {
          ...oldData,
          threadData: {
            ...oldData.threadData,
            // Update any relevant fields for unbanned user
          }
        };
      });
      
      // Show success message or notification
    }
  }, [queryClient, subthreadId]);

  // Handle mod addition events
  const handleModAdded = useCallback((data) => {
    const { thread_id, username } = data;
    
    if (thread_id === subthreadId) {
      // Update subthread data to reflect new mod
      queryClient.setQueryData(['thread', subthreadId], (oldData) => {
        if (!oldData?.threadData) return oldData;
        
        const currentModList = oldData.threadData.modList || [];
        if (!currentModList.includes(username)) {
          return {
            ...oldData,
            threadData: {
              ...oldData.threadData,
              modList: [...currentModList, username]
            }
          };
        }
        
        return oldData;
      });

      // Update user management data directly instead of invalidating
      queryClient.setQueryData(['subthreadSubscribers', subthreadId], (oldData) => {
        if (!Array.isArray(oldData)) return oldData;
        return oldData;
      });
    }
  }, [queryClient, subthreadId]);

  // Handle mod removal events
  const handleModRemoved = useCallback((data) => {
    const { thread_id, username } = data;
    
    if (thread_id === subthreadId) {
      // Update subthread data to remove mod
      queryClient.setQueryData(['thread', subthreadId], (oldData) => {
        if (!oldData?.threadData) return oldData;
        
        const currentModList = oldData.threadData.modList || [];
        return {
          ...oldData,
          threadData: {
            ...oldData.threadData,
            modList: currentModList.filter(mod => mod !== username)
          }
        };
      });

      // Update user management data directly instead of invalidating
      queryClient.setQueryData(['subthreadSubscribers', subthreadId], (oldData) => {
        if (!Array.isArray(oldData)) return oldData;
        return oldData;
      });
    }
  }, [queryClient, subthreadId]);

  // Handle when current user gets demoted
  const handleYouWereDemoted = useCallback((data) => {
    const { subthread_id, removed_by, role } = data;
    
    if (subthread_id === subthreadId) {
      // Update subthread data directly instead of invalidating
      queryClient.setQueryData(['thread', subthreadId], (oldData) => {
        if (!oldData?.threadData) return oldData;
        return {
          ...oldData,
          threadData: {
            ...oldData.threadData,
            // Update user's role in the thread data
          }
        };
      });
      
      // Show notification

    }
  }, [queryClient, subthreadId]);

  // Handle admin transfer events
  const handleAdminTransferred = useCallback((data) => {
    const { old_admin, new_admin } = data;
    
    // Update subthread data directly instead of invalidating
    queryClient.setQueryData(['thread', subthreadId], (oldData) => {
      if (!oldData?.threadData) return oldData;
      return {
        ...oldData,
        threadData: {
          ...oldData.threadData,
          admin: new_admin,
          // Update any other relevant admin fields
        }
      };
    });
    
    queryClient.setQueryData(['subthreadSubscribers', subthreadId], (oldData) => {
      if (!Array.isArray(oldData)) return oldData;
      return oldData;
    });
    
    
  }, [queryClient, subthreadId]);

  // Handle when current user loses admin
  const handleYouLostAdmin = useCallback((data) => {
    const { subthread_id, new_admin } = data;
    
    if (subthread_id === subthreadId) {
      // Update subthread data directly instead of invalidating
      queryClient.setQueryData(['thread', subthreadId], (oldData) => {
        if (!oldData?.threadData) return oldData;
        return {
          ...oldData,
          threadData: {
            ...oldData.threadData,
            admin: new_admin,
            // Update any other relevant admin fields
          }
        };
      });
      

    }
  }, [queryClient, subthreadId]);

  // Handle when current user becomes admin
  const handleYouBecameAdmin = useCallback((data) => {
    const { subthread_id, old_admin } = data;
    
    if (subthread_id === subthreadId) {
      // Update subthread data directly instead of invalidating
      queryClient.setQueryData(['thread', subthreadId], (oldData) => {
        if (!oldData?.threadData) return oldData;
        return {
          ...oldData,
          threadData: {
            ...oldData.threadData,
            admin: user?.username,
            // Update any other relevant admin fields
          }
        };
      });
      

    }
  }, [queryClient, subthreadId, user?.username]);

  useEffect(() => {
    if (!socket) return;

    // Don't join rooms or set up listeners on disabled pages
    if (shouldDisableThreadApis()) {
      return;
    }

    // Join subthread room for management events
    if (subthreadId) {
      socket.emit('join', { room: subthreadId });
    }

    // Join personal room for user-specific events
    if (user?.username) {
      socket.emit('join', { room: `user_${user.username}` });
    }

    // Set up event listeners
    socket.on('user_banned', handleUserBanned);
    socket.on('user_unbanned', handleUserUnbanned);
    socket.on('you_were_banned', handleYouWereBanned);
    socket.on('you_were_unbanned', handleYouWereUnbanned);
    socket.on('mod_added', handleModAdded);
    socket.on('mod_removed', handleModRemoved);
    socket.on('you_were_demoted', handleYouWereDemoted);
    socket.on('admin_transferred', handleAdminTransferred);
    socket.on('you_lost_admin', handleYouLostAdmin);
    socket.on('you_became_admin', handleYouBecameAdmin);

    return () => {
      // Don't leave rooms on disabled pages (we never joined them)
      if (shouldDisableThreadApis()) {
        return;
      }

      // Leave rooms
      if (subthreadId) {
        socket.emit('leave', { room: subthreadId });
      }
      if (user?.username) {
        socket.emit('leave', { room: `user_${user.username}` });
      }
      
      // Clean up event listeners
      socket.off('user_banned', handleUserBanned);
      socket.off('user_unbanned', handleUserUnbanned);
      socket.off('you_were_banned', handleYouWereBanned);
      socket.off('you_were_unbanned', handleYouWereUnbanned);
      socket.off('mod_added', handleModAdded);
      socket.off('mod_removed', handleModRemoved);
      socket.off('you_were_demoted', handleYouWereDemoted);
      socket.off('admin_transferred', handleAdminTransferred);
      socket.off('you_lost_admin', handleYouLostAdmin);
      socket.off('you_became_admin', handleYouBecameAdmin);
    };
  }, [socket, subthreadId, user?.username, handleUserBanned, handleUserUnbanned, handleYouWereBanned, handleYouWereUnbanned, handleModAdded, handleModRemoved, handleYouWereDemoted, handleAdminTransferred, handleYouLostAdmin, handleYouBecameAdmin, shouldDisableThreadApis]);

  // Return functions to emit user management events
  const emitUserBan = useCallback((username, bannedBy, reason) => {
    if (!socket) return;
    
    socket.emit('user_banned', {
      username,
      subthread_id: subthreadId,
      banned_by: bannedBy,
      reason
    });
  }, [socket, subthreadId]);

  const emitUserUnban = useCallback((username, unbannedBy) => {
    if (!socket) return;
    
    socket.emit('user_unbanned', {
      username,
      subthread_id: subthreadId,
      unbanned_by: unbannedBy
    });
  }, [socket, subthreadId]);

  return {
    emitUserBan,
    emitUserUnban
  };
}
