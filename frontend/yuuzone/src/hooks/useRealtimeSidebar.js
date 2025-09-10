import { useEffect, useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import AuthConsumer from '../components/AuthContext';

/**
 * Custom hook for handling real-time sidebar updates
 * Handles subthread joins/leaves, subscriber counts, new subthread creation
 */
export default function useRealtimeSidebar() {
  const { socket } = AuthConsumer();
  const queryClient = useQueryClient();
  const [eventCount, setEventCount] = useState(0);

  // Log socket connection status
  useEffect(() => {
    if (socket) {
      console.log('🔌 Socket available in useRealtimeSidebar:', {
        connected: socket.connected,
        id: socket.id,
        readyState: socket.readyState
      });
    } else {
      console.log('⚠️ No socket available in useRealtimeSidebar');
    }
  }, [socket]);

  // Handle user joining subthread
  const handleSubthreadJoined = useCallback((data) => {
    const { subthreadId } = data;
    
    console.log('🟢 Subthread joined event received:', data);
    setEventCount(prev => prev + 1);
    
    // Log current cache state
    const currentCache = queryClient.getQueryData(['threads/all']);
    console.log('📊 Current cache state before update:', {
      hasData: !!currentCache,
      subscribedCount: currentCache?.subscribed?.length || 0,
      allCount: currentCache?.all?.length || 0,
      popularCount: currentCache?.popular?.length || 0,
      targetSubthread: currentCache?.all?.find(t => t.id === subthreadId) || 
                      currentCache?.subscribed?.find(t => t.id === subthreadId) || 
                      currentCache?.popular?.find(t => t.id === subthreadId)
    });
    
    // Update the threads/all query data
    queryClient.setQueryData(['threads/all'], (oldData) => {
      if (!oldData) {
        console.log('⚠️ No existing data to update');
        return oldData;
      }
      
      console.log('📊 Updating query cache for subthread join:', {
        subthreadId,
        oldSubscribedCount: oldData.subscribed?.length || 0,
        oldAllCount: oldData.all?.length || 0,
        oldPopularCount: oldData.popular?.length || 0
      });
      
      const updateSubthreadCount = (threadList) => {
        if (!Array.isArray(threadList)) return threadList;
        return threadList.map(thread => {
          if (thread.id === subthreadId) {
            const oldCount = thread.subscriberCount || 0;
            const newCount = oldCount + 1;
            console.log(`🔄 Updating subthread ${thread.name}: ${oldCount} → ${newCount}`);
            return { ...thread, subscriberCount: newCount };
          }
          return thread;
        });
      };

      const updatedData = {
        ...oldData,
        subscribed: updateSubthreadCount(oldData.subscribed),
        all: updateSubthreadCount(oldData.all),
        popular: updateSubthreadCount(oldData.popular)
      };

      console.log('✅ Query cache updated successfully');
      
      // Log updated cache state
      const updatedCache = queryClient.getQueryData(['threads/all']);
      console.log('📊 Updated cache state:', {
        hasData: !!updatedCache,
        subscribedCount: updatedCache?.subscribed?.length || 0,
        allCount: updatedCache?.all?.length || 0,
        popularCount: updatedCache?.popular?.length || 0,
        targetSubthread: updatedCache?.all?.find(t => t.id === subthreadId) || 
                        updatedCache?.subscribed?.find(t => t.id === subthreadId) || 
                        updatedCache?.popular?.find(t => t.id === subthreadId)
      });
      
      // Don't invalidate queries - rely on silent cache updates to preserve user input
      // The component will re-render automatically when cache data changes
      
      return updatedData;
    });
  }, [queryClient]);

  // Handle user leaving subthread
  const handleSubthreadLeft = useCallback((data) => {
    const { subthreadId } = data;
    
    console.log('🔴 Subthread left event received:', data);
    setEventCount(prev => prev + 1);
    
    // Log current cache state
    const currentCache = queryClient.getQueryData(['threads/all']);
    console.log('📊 Current cache state before update:', {
      hasData: !!currentCache,
      subscribedCount: currentCache?.subscribed?.length || 0,
      allCount: currentCache?.all?.length || 0,
      popularCount: currentCache?.popular?.length || 0,
      targetSubthread: currentCache?.all?.find(t => t.id === subthreadId) || 
                        currentCache?.subscribed?.find(t => t.id === subthreadId) || 
                        currentCache?.popular?.find(t => t.id === subthreadId)
    });
    
    // Update the threads/all query data
    queryClient.setQueryData(['threads/all'], (oldData) => {
      if (!oldData) {
        console.log('⚠️ No existing data to update');
        return oldData;
      }
      
      console.log('📊 Updating query cache for subthread leave:', {
        subthreadId,
        oldSubscribedCount: oldData.subscribed?.length || 0,
        oldAllCount: oldData.all?.length || 0,
        oldPopularCount: oldData.popular?.length || 0
      });
      
      const updateSubthreadCount = (threadList) => {
        if (!Array.isArray(threadList)) return threadList;
        return threadList.map(thread => {
          if (thread.id === subthreadId) {
            const oldCount = thread.subscriberCount || 0;
            const newCount = Math.max(0, oldCount - 1);
            console.log(`🔄 Updating subthread ${thread.name}: ${oldCount} → ${newCount}`);
            return { ...thread, subscriberCount: newCount };
          }
          return thread;
        });
      };

      const updatedData = {
        ...oldData,
        subscribed: updateSubthreadCount(oldData.subscribed),
        all: updateSubthreadCount(oldData.all),
        popular: updateSubthreadCount(oldData.popular)
      };

      console.log('✅ Query cache updated successfully');
      
      // Log updated cache state
      const updatedCache = queryClient.getQueryData(['threads/all']);
      console.log('📊 Updated cache state:', {
        hasData: !!updatedCache,
        subscribedCount: updatedCache?.subscribed?.length || 0,
        allCount: updatedCache?.all?.length || 0,
        popularCount: updatedCache?.popular?.length || 0,
        targetSubthread: updatedCache?.all?.find(t => t.id === subthreadId) || 
                        updatedCache?.subscribed?.find(t => t.id === subthreadId) || 
                        updatedCache?.popular?.find(t => t.id === subthreadId)
      });
      
      // Don't invalidate queries - rely on silent cache updates to preserve user input
      // The component will re-render automatically when cache data changes
      
      return updatedData;
    });
  }, [queryClient]);

  // Handle subthread creation
  const handleSubthreadCreated = useCallback((data) => {
    const { id, name, description, logo } = data;
    const newSubthread = { 
      id, 
      name, 
      description, 
      logo, 
      subscriberCount: 0,
      PostsCount: 0,
      CommentsCount: 0
    };
    
    // Update the threads/all query data
    queryClient.setQueryData(['threads/all'], (oldData) => {
      if (!oldData) return oldData;
      
      return {
        ...oldData,
        all: [newSubthread, ...(oldData.all || [])],
        popular: [newSubthread, ...(oldData.popular || [])]
      };
    });
  }, [queryClient]);

  // Handle subthread updates (name, description, logo changes)
  const handleSubthreadUpdated = useCallback((data) => {
    const { id, updated_fields } = data;
    
    // Update the threads/all query data
    queryClient.setQueryData(['threads/all'], (oldData) => {
      if (!oldData) return oldData;
      
      const updateSubthread = (threadList) => {
        if (!Array.isArray(threadList)) return threadList;
        return threadList.map(thread =>
          thread.id === id ? { ...thread, ...updated_fields } : thread
        );
      };

      return {
        ...oldData,
        subscribed: updateSubthread(oldData.subscribed),
        all: updateSubthread(oldData.all),
        popular: updateSubthread(oldData.popular)
      };
    });
  }, [queryClient]);

  // Handle subthread deletion
  const handleSubthreadDeleted = useCallback((data) => {
    const { id } = data;
    
    // Update the threads/all query data
    queryClient.setQueryData(['threads/all'], (oldData) => {
      if (!oldData) return oldData;
      
      const removeSubthread = (threadList) => {
        if (!Array.isArray(threadList)) return threadList;
        return threadList.filter(thread => thread.id !== id);
      };

      return {
        ...oldData,
        subscribed: removeSubthread(oldData.subscribed),
        all: removeSubthread(oldData.all),
        popular: removeSubthread(oldData.popular)
      };
    });
  }, [queryClient]);

  // Handle user subscription changes (when current user joins/leaves)
  const handleUserSubscriptionChanged = useCallback((data) => {
    const { subthreadId, action } = data; // action: 'joined' or 'left'
    
    console.log('🔄 User subscription changed event received:', data);
    setEventCount(prev => prev + 1);
    
    // Log current cache state
    const currentCache = queryClient.getQueryData(['threads/all']);
    console.log('📊 Current cache state before update:', {
      hasData: !!currentCache,
      subscribedCount: currentCache?.subscribed?.length || 0,
      allCount: currentCache?.all?.length || 0,
      popularCount: currentCache?.popular?.length || 0,
      targetSubthread: currentCache?.all?.find(t => t.id === subthreadId) || 
                        currentCache?.subscribed?.find(t => t.id === subthreadId) || 
                        currentCache?.popular?.find(t => t.id === subthreadId)
    });
    
    // Update the threads/all query data
    queryClient.setQueryData(['threads/all'], (oldData) => {
      if (!oldData) {
        console.log('⚠️ No existing data to update');
        return oldData;
      }
      
      console.log('📊 Updating query cache for user subscription change:', {
        subthreadId,
        action,
        oldSubscribedCount: oldData.subscribed?.length || 0,
        oldAllCount: oldData.all?.length || 0,
        oldPopularCount: oldData.popular?.length || 0
      });
      
      const updateSubthread = (threadList) => {
        if (!Array.isArray(threadList)) return threadList;
        return threadList.map(thread => {
          if (thread.id === subthreadId) {
            const oldCount = thread.subscriberCount || 0;
            const newCount = action === 'joined' 
              ? oldCount + 1
              : Math.max(0, oldCount - 1);
            
            console.log(`🔄 Updating subthread ${thread.name}: ${oldCount} → ${newCount} (${action})`);
            
            return { 
              ...thread, 
              subscriberCount: newCount,
              has_subscribed: action === 'joined'
            };
          }
          return thread;
        });
      };

      const updatedData = {
        ...oldData,
        subscribed: updateSubthread(oldData.subscribed),
        all: updateSubthread(oldData.all),
        popular: updateSubthread(oldData.popular)
      };

      console.log('✅ Query cache updated successfully for user subscription change');
      
      // Log updated cache state
      const updatedCache = queryClient.getQueryData(['threads/all']);
      console.log('📊 Updated cache state:', {
        hasData: !!updatedCache,
        subscribedCount: updatedCache?.subscribed?.length || 0,
        allCount: updatedCache?.all?.length || 0,
        popularCount: updatedCache?.popular?.length || 0,
        targetSubthread: updatedCache?.all?.find(t => t.id === subthreadId) || 
                        updatedCache?.subscribed?.find(t => t.id === subthreadId) || 
                        updatedCache?.popular?.find(t => t.id === subthreadId)
      });
      
      // Don't invalidate queries - rely on silent cache updates to preserve user input
      // The component will re-render automatically when cache data changes
      
      return updatedData;
    });
  }, [queryClient]);

  useEffect(() => {
    if (!socket) {
      console.log('⚠️ No socket available for real-time sidebar updates');
      return;
    }

    console.log('🔌 Setting up real-time sidebar event listeners');

    // Set up event listeners for global subthread events
    socket.on('subthread_joined', handleSubthreadJoined);
    socket.on('subthread_left', handleSubthreadLeft);
    socket.on('subthread_created', handleSubthreadCreated);
    socket.on('subthread_updated', handleSubthreadUpdated);
    socket.on('subthread_deleted', handleSubthreadDeleted);
    socket.on('user_subscription_changed', handleUserSubscriptionChanged);

    console.log('✅ Real-time sidebar event listeners set up successfully');

    return () => {
      console.log('🧹 Cleaning up real-time sidebar event listeners');
      // Clean up event listeners
      socket.off('subthread_joined', handleSubthreadJoined);
      socket.off('subthread_left', handleSubthreadLeft);
      socket.off('subthread_created', handleSubthreadCreated);
      socket.off('subthread_updated', handleSubthreadUpdated);
      socket.off('subthread_deleted', handleSubthreadDeleted);
      socket.off('user_subscription_changed', handleUserSubscriptionChanged);
    };
  }, [socket, handleSubthreadJoined, handleSubthreadLeft, handleSubthreadCreated, handleSubthreadUpdated, handleSubthreadDeleted, handleUserSubscriptionChanged]);

  // Return functions to emit subthread events (if needed)
  const emitSubthreadUpdate = useCallback((subthreadId, updatedFields) => {
    if (!socket) return;
    
    socket.emit('subthread_updated', {
      subthread_id: subthreadId,
      updated_fields: updatedFields
    });
  }, [socket]);

  // Test function to manually test real-time updates
  const testRealTimeUpdate = useCallback((subthreadId, action = 'joined') => {
    console.log(`🧪 Testing real-time update: ${action} subthread ${subthreadId}`);
    
    if (action === 'joined') {
      handleSubthreadJoined({ subthreadId });
    } else if (action === 'left') {
      handleSubthreadLeft({ subthreadId });
    }
  }, [handleSubthreadJoined, handleSubthreadLeft]);

  return {
    emitSubthreadUpdate,
    testRealTimeUpdate,
    eventCount
  };
} 