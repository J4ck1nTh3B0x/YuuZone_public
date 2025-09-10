import { useEffect, useCallback, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import AuthConsumer from '../components/AuthContext';

/**
 * Optimized real-time updates hook that prevents unnecessary reloads
 * and maintains user progress with smart update strategies
 */
export default function useOptimizedRealtimeUpdates(options = {}) {
  // Ensure options is always an object
  const safeOptions = options || {};
  const { socket } = AuthConsumer();
  const queryClient = useQueryClient();
  const updateQueue = useRef(new Map());
  const isProcessing = useRef(false);
  const lastUpdateTime = useRef(0);
  const [updateStats, setUpdateStats] = useState({
    totalUpdates: 0,
    batchedUpdates: 0,
    skippedUpdates: 0
  });

  const {
    batchDelay = 500,
    maxBatchSize = 15,
    throttleDelay = 200,
    enableOptimisticUpdates = true,
    preserveScrollPosition = true
  } = safeOptions;

  // Optimized post handlers with silent updates
  const handleNewPostOptimized = useCallback(async (postData) => {
    const { subthreadId } = postData;
    
    // Preserve scroll position
    const scrollPosition = preserveScrollPosition ? window.scrollY : null;
    
    // Silent optimistic update without visual disruption
    if (enableOptimisticUpdates) {
      queryClient.setQueryData(['posts', 'thread', subthreadId], (oldData) => {
        if (!oldData) return oldData;
        
        if (oldData.pages) {
          const newPages = [...oldData.pages];
          if (newPages[0]) {
            newPages[0] = [postData, ...newPages[0]];
          }
          return { ...oldData, pages: newPages };
        }
        return oldData;
      });

      // Also update global feeds silently
      ['posts', 'all', 'posts', 'popular'].forEach(queryKey => {
        queryClient.setQueryData(queryKey, (oldData) => {
          if (!oldData) return oldData;
          
          if (oldData.pages) {
            const newPages = [...oldData.pages];
            if (newPages[0]) {
              newPages[0] = [postData, ...newPages[0]];
            }
            return { ...oldData, pages: newPages };
          }
          return oldData;
        });
      });
    }

    // Restore scroll position silently
    if (preserveScrollPosition && scrollPosition !== null) {
      requestAnimationFrame(() => {
        window.scrollTo(0, scrollPosition);
      });
    }
  }, [queryClient, enableOptimisticUpdates, preserveScrollPosition]);

  const handlePostUpdateOptimized = useCallback(async (data) => {
    const { postId, newData } = data;
    
    queryClient.setQueryData(['post', postId], (oldData) => {
      if (!oldData) return oldData;
      
      const hasChanges = Object.keys(newData).some(key => 
        oldData[key] !== newData[key]
      );
      
      if (!hasChanges) return oldData;
      
      return { ...oldData, ...newData };
    });
  }, [queryClient]);

  const handlePostDeleteOptimized = useCallback(async (data) => {
    const { post_id, subthread_id } = data;
    
    queryClient.setQueryData(['posts', 'thread', subthread_id], (oldData) => {
      if (!oldData) return oldData;
      
      const filterPost = (post) => 
        post.post_info?.id !== post_id && post.id !== post_id;
      
      if (oldData.pages) {
        return {
          ...oldData,
          pages: oldData.pages.map(page => 
            Array.isArray(page) ? page.filter(filterPost) : page
          )
        };
      }
      return oldData;
    });

    // Also remove from global feeds silently
    ['posts', 'all', 'posts', 'popular'].forEach(queryKey => {
      queryClient.setQueryData(queryKey, (oldData) => {
        if (!oldData) return oldData;
        
        const filterPost = (post) => 
          post.post_info?.id !== post_id && post.id !== post_id;
        
        if (oldData.pages) {
          return {
            ...oldData,
            pages: oldData.pages.map(page => 
              Array.isArray(page) ? page.filter(filterPost) : page
            )
          };
        }
        return oldData;
      });
    });
  }, [queryClient]);

  const handleNewCommentOptimized = useCallback(async (data) => {
    const { postId, comment } = data;
    
    queryClient.setQueryData(['comments', postId], (oldData) => {
      if (!oldData) return [comment];
      
      const addReplyToParent = (comments) => {
        return comments.map(parentComment => {
          if (parentComment.id === comment.parent_id) {
            return {
              ...parentComment,
              children: [...(parentComment.children || []), comment]
            };
          }
          
          if (parentComment.children && Array.isArray(parentComment.children) && parentComment.children.length > 0) {
            return {
              ...parentComment,
              children: addReplyToParent(parentComment.children)
            };
          }
          
          return parentComment;
        });
      };
      
      return addReplyToParent(oldData);
    });
  }, [queryClient]);

  const handleCommentEditOptimized = useCallback(async (data) => {
    const { comment_id, content, postId } = data;
    
    queryClient.setQueryData(['comments', postId], (oldData) => {
      if (!oldData) return oldData;
      
      const updateComment = (comments) => {
        return comments.map(comment => {
          if (comment.id === comment_id) {
            return { ...comment, content, isEdited: true };
          }
          
          if (comment.children && Array.isArray(comment.children) && comment.children.length > 0) {
            return {
              ...comment,
              children: updateComment(comment.children)
            };
          }
          
          return comment;
        });
      };
      
      return updateComment(oldData);
    });
  }, [queryClient]);

  const handleCommentDeleteOptimized = useCallback(async (data) => {
    const { comment_id, postId } = data;
    
    queryClient.setQueryData(['comments', postId], (oldData) => {
      if (!oldData) return oldData;
      
      const removeComment = (comments) => {
        return comments.filter(comment => {
          if (comment.id === comment_id) return false;
          
          if (comment.children && Array.isArray(comment.children) && comment.children.length > 0) {
            return {
              ...comment,
              children: removeComment(comment.children)
            };
          }
          
          return true;
        });
      };
      
      return removeComment(oldData);
    });
  }, [queryClient]);

  const handleVoteUpdateOptimized = useCallback(async (data) => {
    const { postId, commentId, voteType, isUpvote } = data;
    
    const queryKey = commentId ? ['comments', postId] : ['post', postId];
    
    queryClient.setQueryData(queryKey, (oldData) => {
      if (!oldData) return oldData;
      
      const updateVote = (item) => {
        if (item.id === (commentId || postId)) {
          return {
            ...item,
            votes: (item.votes || 0) + (isUpvote ? 1 : -1),
            user_vote: isUpvote ? 1 : -1
          };
        }
        return item;
      };
      
      if (Array.isArray(oldData)) {
        return oldData.map(updateVote);
      }
      
      return updateVote(oldData);
    });
  }, [queryClient]);

  // Process update queue function
  const processUpdateQueue = useCallback(async () => {
    if (isProcessing.current || !updateQueue.current || updateQueue.current.size === 0 || !queryClient) return;
    
    isProcessing.current = true;
    const updates = Array.from(updateQueue.current.values());
    updateQueue.current.clear();

    // Group updates by type for efficient processing
    const groupedUpdates = updates.reduce((acc, update) => {
      const key = `${update.type}_${update.targetId}`;
      if (!acc[key]) acc[key] = [];
      acc[key].push(update);
      return acc;
    }, {});

    // Process each group silently
    for (const [key, groupUpdates] of Object.entries(groupedUpdates)) {
      if (!groupUpdates || !Array.isArray(groupUpdates) || groupUpdates.length === 0) continue;
      const latestUpdate = groupUpdates.length > 0 ? groupUpdates[groupUpdates.length - 1] : null;
      
      try {
        switch (latestUpdate.type) {
          case 'new_post':
            await handleNewPostOptimized(latestUpdate.data);
            break;
          case 'post_update':
            await handlePostUpdateOptimized(latestUpdate.data);
            break;
          case 'post_delete':
            await handlePostDeleteOptimized(latestUpdate.data);
            break;
          case 'new_comment':
            await handleNewCommentOptimized(latestUpdate.data);
            break;
          case 'comment_edit':
            await handleCommentEditOptimized(latestUpdate.data);
            break;
          case 'comment_delete':
            await handleCommentDeleteOptimized(latestUpdate.data);
            break;
          case 'vote_update':
            await handleVoteUpdateOptimized(latestUpdate.data);
            break;
          default:
            // Unknown update type
        }
      } catch (error) {
        // Error processing update
      }
    }

    setUpdateStats(prev => ({
      ...prev,
      totalUpdates: prev.totalUpdates + (updates?.length || 0),
      batchedUpdates: prev.batchedUpdates + 1
    }));

    isProcessing.current = false;
  }, [queryClient, handleNewPostOptimized, handlePostUpdateOptimized, handlePostDeleteOptimized, handleNewCommentOptimized, handleCommentEditOptimized, handleCommentDeleteOptimized, handleVoteUpdateOptimized]);

  // Queue update for processing with enhanced throttling
  const queueUpdate = useCallback((type, data, targetId) => {
    if (!queryClient) return;
    
    const now = Date.now();
    
    // Enhanced throttling for rapid updates
    if (now - lastUpdateTime.current < throttleDelay) {
      setUpdateStats(prev => ({ ...prev, skippedUpdates: prev.skippedUpdates + 1 }));
      return;
    }
    
    lastUpdateTime.current = now;
    
    const updateKey = `${type}_${targetId || 'global'}`;
    updateQueue.current.set(updateKey, { type, data, targetId, timestamp: now });

    // Process queue after delay or when full
    if (updateQueue.current.size >= maxBatchSize) {
      processUpdateQueue();
    } else {
      setTimeout(() => {
        processUpdateQueue();
      }, batchDelay);
    }
  }, [batchDelay, maxBatchSize, throttleDelay, queryClient, processUpdateQueue]);

  // Set up event listeners with enhanced throttling
  useEffect(() => {
    if (!socket || typeof socket.on !== 'function') return;

    const eventHandlers = {
      'new_post': (data) => queueUpdate('new_post', data, data.subthreadId),
      'post_updated': (data) => queueUpdate('post_update', data, data.postId),
      'post_deleted': (data) => queueUpdate('post_delete', data, data.subthread_id),
      'new_comment': (data) => queueUpdate('new_comment', data, data.postId),
      'comment_edited': (data) => queueUpdate('comment_edit', data, data.postId),
      'comment_deleted': (data) => queueUpdate('comment_delete', data, data.postId),
      'post_vote_updated': (data) => queueUpdate('vote_update', data, data.post_id),
      'comment_vote_updated': (data) => queueUpdate('vote_update', data, data.comment_id)
    };

    // Register event listeners
    Object.entries(eventHandlers).forEach(([event, handler]) => {
      if (typeof socket.on === 'function') {
        socket.on(event, handler);
      }
    });

    return () => {
      // Clean up event listeners
      Object.keys(eventHandlers).forEach(event => {
        if (typeof socket.off === 'function') {
          socket.off(event);
        }
      });
      
      // Process remaining updates
      if (updateQueue.current && updateQueue.current.size > 0) {
        processUpdateQueue();
      }
    };
  }, [socket, queueUpdate, processUpdateQueue]);

  return {
    updateStats,
    processUpdateQueue,
    queueUpdate
  };
} 