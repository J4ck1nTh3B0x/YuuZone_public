import { useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import AuthConsumer from '../components/AuthContext';

/**
 * Custom hook for handling real-time post updates
 * Handles new posts, post edits, post deletions, and post updates
 */
export default function useRealtimePost(subthreadId) {
  const { socket } = AuthConsumer();
  const queryClient = useQueryClient();

  // Handle new post creation
  const handleNewPost = useCallback((postData) => {
    // Only update if we have a subthreadId or it's a global post
    if (!subthreadId && !postData.subthread_id) return;

    // Add new post to the beginning of post lists
    const postQueries = subthreadId 
      ? [['posts', 'thread', subthreadId]]
      : [['posts', 'all'], ['posts', 'popular']];

    postQueries.forEach(queryKey => {
      queryClient.setQueryData(queryKey, (oldData) => {
        if (!oldData) return oldData;

        // Helper function to deduplicate posts by ID
        const deduplicatePosts = (posts) => {
          const seenIds = new Set();
          return posts.filter(post => {
            const postId = post?.post_info?.id || post?.id;
            if (!postId || seenIds.has(postId)) {
              return false;
            }
            seenIds.add(postId);
            return true;
          });
        };

        if (oldData.pages) {
          // Infinite query structure
          const newPages = [...oldData.pages];
          if (newPages[0]) {
            // Add new post and deduplicate
            const updatedFirstPage = [postData, ...newPages[0]];
            newPages[0] = deduplicatePosts(updatedFirstPage);
          } else {
            newPages[0] = [postData];
          }
          return {
            ...oldData,
            pages: newPages
          };
        } else if (Array.isArray(oldData)) {
          // Simple array structure - add new post and deduplicate
          const updatedData = [postData, ...oldData];
          return deduplicatePosts(updatedData);
        }

        return oldData;
      });
    });

    // Update subthread post count only if we have subthreadId
    if (subthreadId) {
    queryClient.setQueryData(['thread', subthreadId], (oldData) => {
      if (!oldData?.threadData) return oldData;
      
      return {
        ...oldData,
        threadData: {
          ...oldData.threadData,
          PostsCount: (oldData.threadData.PostsCount || 0) + 1
        }
      };
    });
    }

    // Removed query invalidation to prevent posts from disappearing
    // The cache is already updated with setQueryData above
  }, [queryClient, subthreadId]);

  // Handle post updates
  const handlePostUpdate = useCallback((data) => {
    const { postId, newData } = data;
    
    const postQueries = [
      ['posts', 'thread', subthreadId],
      ['posts', 'all'],
      ['posts', 'popular'],
      ['post', postId]
    ];

    postQueries.forEach(queryKey => {
      queryClient.setQueryData(queryKey, (oldData) => {
        if (!oldData) return oldData;

        const updatePost = (post) => {
          if (post.post_info?.id === postId || post.id === postId) {
            return { ...post, ...newData };
          }
          return post;
        };

        if (Array.isArray(oldData)) {
          return oldData.map(updatePost);
        } else if (oldData.pages) {
          // Infinite query structure
          return {
            ...oldData,
            pages: oldData.pages.map(page => 
              Array.isArray(page) ? page.map(updatePost) : page
            )
          };
        } else if (oldData.post_info?.id === postId || oldData.id === postId) {
          // Single post structure
          return { ...oldData, ...newData };
        }

        return oldData;
      });
    });
  }, [queryClient, subthreadId]);

  // Handle post deletion
  const handlePostDelete = useCallback((data) => {
    const { post_id, deleted_by } = data;
    
    const postQueries = [
      ['posts', 'thread', subthreadId],
      ['posts', 'all'],
      ['posts', 'popular']
    ];

    postQueries.forEach(queryKey => {
      queryClient.setQueryData(queryKey, (oldData) => {
        if (!oldData) return oldData;

        const filterPost = (post) => {
          return post.post_info?.id !== post_id && post.id !== post_id;
        };

        if (Array.isArray(oldData)) {
          return oldData.filter(filterPost);
        } else if (oldData.pages) {
          // Infinite query structure
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

    // Remove single post query
    queryClient.removeQueries(['post', post_id]);

    // Update subthread post count
    queryClient.setQueryData(['thread', subthreadId], (oldData) => {
      if (!oldData?.threadData) return oldData;
      
      return {
        ...oldData,
        threadData: {
          ...oldData.threadData,
          PostsCount: Math.max(0, (oldData.threadData.PostsCount || 0) - 1)
        }
      };
    });
  }, [queryClient, subthreadId]);

  useEffect(() => {
    if (!socket) return;

    // Set up event listeners
    socket.on('new_post', handleNewPost);
    socket.on('post_created', handleNewPost); // Handle immediate post creation events
    socket.on('post_updated', handlePostUpdate);
    socket.on('post_deleted', handlePostDelete);

    return () => {
      // Clean up event listeners
      socket.off('new_post', handleNewPost);
      socket.off('post_created', handleNewPost);
      socket.off('post_updated', handlePostUpdate);
      socket.off('post_deleted', handlePostDelete);
    };
  }, [socket, handleNewPost, handlePostUpdate, handlePostDelete]);

  // Return functions to emit post events
  const emitPostDelete = useCallback((postId, deletedBy) => {
    if (!socket) return;
    
    socket.emit('post_delete', {
      post_id: postId,
      subthread_id: subthreadId,
      deleted_by: deletedBy
    });
  }, [socket, subthreadId]);

  const emitPostUpdate = useCallback((postId, newData) => {
    if (!socket) return;
    
    socket.emit('post_update', {
      post_id: postId,
      subthread_id: subthreadId,
      new_data: newData
    });
  }, [socket, subthreadId]);

  return {
    emitPostDelete,
    emitPostUpdate
  };
}
