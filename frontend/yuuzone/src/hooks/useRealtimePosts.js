import { useEffect, useCallback, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import AuthConsumer from '../components/AuthContext';

/**
 * Enhanced real-time posts hook with auto polling and silent updates
 * Provides immediate feedback when users post and background polling for new content
 */
export default function useRealtimePosts(options = {}) {
  const {
    enablePolling = true,
    pollingInterval = 30000, // 30 seconds
    enableOptimisticUpdates = true,
    preserveScrollPosition = true,
    maxPollingRetries = 3,
    pollingBackoffMultiplier = 1.5
  } = options;

  const { socket, user } = AuthConsumer();
  const queryClient = useQueryClient();
  const pollingIntervalRef = useRef(null);
  const lastPollTimeRef = useRef(0);
  const pollingRetriesRef = useRef(0);
  const isPollingRef = useRef(false);
  const [pollingStats, setPollingStats] = useState({
    totalPolls: 0,
    successfulPolls: 0,
    failedPolls: 0,
    newPostsFound: 0,
    lastPollTime: null
  });

  // Preserve scroll position
  const preserveScroll = useCallback(() => {
    if (!preserveScrollPosition) return;
    return window.scrollY;
  }, [preserveScrollPosition]);

  const restoreScroll = useCallback((scrollPosition) => {
    if (!preserveScrollPosition || scrollPosition === null) return;
    requestAnimationFrame(() => {
      window.scrollTo(0, scrollPosition);
    });
  }, [preserveScrollPosition]);

  // Optimistic post creation - immediately add to feeds
  const addOptimisticPost = useCallback((postData, subthreadId) => {
    if (!enableOptimisticUpdates) return;

    const scrollPosition = preserveScroll();

    // Add to specific subthread feed
    queryClient.setQueryData(['posts', 'thread', subthreadId], (oldData) => {
      if (!oldData || !oldData.pages) return oldData;
      
      const newPages = [...oldData.pages];
      if (newPages[0] && Array.isArray(newPages[0])) {
        // Check if post already exists to prevent duplicates
        const postExists = newPages[0].some(post => 
          post.post_info?.id === postData.post_info?.id || post.id === postData.id
        );
        
        if (!postExists) {
          newPages[0] = [postData, ...newPages[0]];
        }
      }
      return { ...oldData, pages: newPages };
    });

    // Add to global feeds (home, all, popular)
    const globalFeeds = [
      ['posts', 'home'],
      ['posts', 'all'], 
      ['posts', 'popular']
    ];

    globalFeeds.forEach(queryKey => {
      queryClient.setQueryData(queryKey, (oldData) => {
        if (!oldData || !oldData.pages) return oldData;
        
        const newPages = [...oldData.pages];
        if (newPages[0] && Array.isArray(newPages[0])) {
          // Check if post already exists to prevent duplicates
          const postExists = newPages[0].some(post => 
            post.post_info?.id === postData.post_info?.id || post.id === postData.id
          );
          
          if (!postExists) {
            newPages[0] = [postData, ...newPages[0]];
          }
        }
        return { ...oldData, pages: newPages };
      });
    });

    restoreScroll(scrollPosition);
  }, [queryClient, enableOptimisticUpdates, preserveScroll, restoreScroll]);

  // Silent polling function
  const silentPoll = useCallback(async (feedType, subthreadId = null) => {
    if (isPollingRef.current) return;
    
    isPollingRef.current = true;
    const now = Date.now();
    
    try {
      // Determine the API endpoint based on feed type
      let endpoint = '';
      if (feedType === 'thread' && subthreadId) {
        endpoint = `posts/thread/${subthreadId}`;
      } else if (feedType === 'home') {
        endpoint = 'posts/home';
      } else if (feedType === 'all') {
        endpoint = 'posts/all';
      } else if (feedType === 'popular') {
        endpoint = 'posts/popular';
      } else {
        return;
      }

      const response = await axios.get(`/api/${endpoint}?limit=5&offset=0&sortby=new&duration=alltime`);
      const newPosts = response.data;

      if (Array.isArray(newPosts) && newPosts.length > 0) {
        // Check for new posts by comparing with existing data
        const queryKey = subthreadId ? ['posts', 'thread', subthreadId] : ['posts', feedType];
        const existingData = queryClient.getQueryData(queryKey);
        
        if (existingData && existingData.pages && existingData.pages[0]) {
          const existingPostIds = new Set(
            existingData.pages[0].map(post => post.post_info?.id || post.id)
          );
          
          const trulyNewPosts = newPosts.filter(post => {
            const postId = post.post_info?.id || post.id;
            return postId && !existingPostIds.has(postId);
          });

          if (trulyNewPosts.length > 0) {
            // Silently add new posts to the beginning of the feed
            const scrollPosition = preserveScroll();
            
            queryClient.setQueryData(queryKey, (oldData) => {
              if (!oldData || !oldData.pages) return oldData;
              
              const newPages = [...oldData.pages];
              if (newPages[0] && Array.isArray(newPages[0])) {
                newPages[0] = [...trulyNewPosts, ...newPages[0]];
              }
              return { ...oldData, pages: newPages };
            });

            restoreScroll(scrollPosition);
            
            setPollingStats(prev => ({
              ...prev,
              newPostsFound: prev.newPostsFound + trulyNewPosts.length,
              successfulPolls: prev.successfulPolls + 1
            }));
          }
        }
      }

      setPollingStats(prev => ({
        ...prev,
        totalPolls: prev.totalPolls + 1,
        successfulPolls: prev.successfulPolls + 1,
        lastPollTime: new Date().toISOString()
      }));

      // Reset retry counter on success
      pollingRetriesRef.current = 0;
      
    } catch (error) {
      console.warn('Silent polling failed:', error);
      
      setPollingStats(prev => ({
        ...prev,
        totalPolls: prev.totalPolls + 1,
        failedPolls: prev.failedPolls + 1,
        lastPollTime: new Date().toISOString()
      }));

      // Implement exponential backoff for failed polls
      pollingRetriesRef.current += 1;
      if (pollingRetriesRef.current < maxPollingRetries) {
        const backoffDelay = pollingInterval * Math.pow(pollingBackoffMultiplier, pollingRetriesRef.current);
        setTimeout(() => {
          isPollingRef.current = false;
          silentPoll(feedType, subthreadId);
        }, backoffDelay);
        return;
      }
    } finally {
      isPollingRef.current = false;
    }
  }, [queryClient, preserveScroll, restoreScroll, pollingInterval, maxPollingRetries, pollingBackoffMultiplier]);

  // Start polling for a specific feed
  const startPolling = useCallback((feedType, subthreadId = null) => {
    if (!enablePolling || pollingIntervalRef.current) return;

    pollingIntervalRef.current = setInterval(() => {
      silentPoll(feedType, subthreadId);
    }, pollingInterval);

    // Initial poll
    silentPoll(feedType, subthreadId);
  }, [enablePolling, pollingInterval, silentPoll]);

  // Stop polling
  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  }, []);

  // Handle socket events for real-time updates
  useEffect(() => {
    if (!socket || typeof socket.on !== 'function') return;

    const handleNewPost = (data) => {
      const { postData, subthreadId } = data;
      addOptimisticPost(postData, subthreadId);
    };

    const handlePostUpdate = (data) => {
      const { postId, newData } = data;
      
      // Update post in all relevant queries
      queryClient.setQueryData(['post', postId], (oldData) => {
        if (!oldData) return oldData;
        return { ...oldData, ...newData };
      });

      // Update post in feed queries
      const feedQueries = [
        ['posts', 'home'],
        ['posts', 'all'],
        ['posts', 'popular']
      ];

      feedQueries.forEach(queryKey => {
        queryClient.setQueryData(queryKey, (oldData) => {
          if (!oldData || !oldData.pages) return oldData;
          
          const newPages = oldData.pages.map(page => {
            if (!Array.isArray(page)) return page;
            
            return page.map(post => {
              if (post.post_info?.id === postId || post.id === postId) {
                return { ...post, ...newData };
              }
              return post;
            });
          });
          
          return { ...oldData, pages: newPages };
        });
      });
    };

    const handlePostDelete = (data) => {
      const { postId, subthreadId } = data;
      
      // Remove post from all relevant queries
      const removePostFromQuery = (queryKey) => {
        queryClient.setQueryData(queryKey, (oldData) => {
          if (!oldData || !oldData.pages) return oldData;
          
          const newPages = oldData.pages.map(page => {
            if (!Array.isArray(page)) return page;
            
            return page.filter(post => 
              post.post_info?.id !== postId && post.id !== postId
            );
          });
          
          return { ...oldData, pages: newPages };
        });
      };

      // Remove from specific subthread feed
      if (subthreadId) {
        removePostFromQuery(['posts', 'thread', subthreadId]);
      }

      // Remove from global feeds
      removePostFromQuery(['posts', 'home']);
      removePostFromQuery(['posts', 'all']);
      removePostFromQuery(['posts', 'popular']);
    };

    // Register socket event listeners
    socket.on('new_post', handleNewPost);
    socket.on('new_post_global', handleNewPost); // Global events for cross-subthread updates
    socket.on('post_updated', handlePostUpdate);
    socket.on('post_updated_global', handlePostUpdate); // Global events for cross-subthread updates
    socket.on('post_deleted', handlePostDelete);
    socket.on('post_deleted_global', handlePostDelete); // Global events for cross-subthread updates

    return () => {
      socket.off('new_post', handleNewPost);
      socket.off('new_post_global', handleNewPost);
      socket.off('post_updated', handlePostUpdate);
      socket.off('post_updated_global', handlePostUpdate);
      socket.off('post_deleted', handlePostDelete);
      socket.off('post_deleted_global', handlePostDelete);
    };
  }, [socket, queryClient, addOptimisticPost]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  return {
    startPolling,
    stopPolling,
    addOptimisticPost,
    silentPoll,
    pollingStats,
    isPolling: isPollingRef.current
  };
} 