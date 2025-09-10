/**
 * Utility functions for deduplicating posts across the application
 * Prevents duplicate posts from appearing in feeds due to real-time updates,
 * polling, or API refetching
 */

/**
 * Deduplicate posts by their ID, keeping the first occurrence
 * @param {Array} posts - Array of post objects
 * @returns {Array} Deduplicated array of posts
 */
export const deduplicatePosts = (posts) => {
  if (!Array.isArray(posts)) return posts;
  
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

/**
 * Deduplicate infinite query pages structure across ALL pages
 * @param {Object} queryData - React Query infinite query data
 * @returns {Object} Deduplicated query data
 */
export const deduplicateInfiniteQuery = (queryData) => {
  if (!queryData || !queryData.pages) return queryData;
  
  const seenIds = new Set();
  const deduplicatedPages = queryData.pages.map(page => {
    if (!Array.isArray(page)) return page;
    
    return page.filter(post => {
      const postId = post?.post_info?.id || post?.id;
      if (!postId || seenIds.has(postId)) {
        return false;
      }
      seenIds.add(postId);
      return true;
    });
  });
  
  return {
    ...queryData,
    pages: deduplicatedPages
  };
};

/**
 * Merge new posts into existing data while deduplicating
 * @param {Array|Object} oldData - Existing query data
 * @param {Array} newPosts - New posts to add
 * @param {string} position - 'prepend' or 'append'
 * @returns {Array|Object} Merged and deduplicated data
 */
export const mergePostsWithDeduplication = (oldData, newPosts, position = 'prepend') => {
  if (!oldData) return newPosts;
  
  // Helper function to merge arrays
  const mergeArrays = (existing, newItems) => {
    const combined = position === 'prepend' 
      ? [...newItems, ...existing]
      : [...existing, ...newItems];
    return deduplicatePosts(combined);
  };
  
  if (oldData.pages) {
    // Infinite query structure
    const newPages = [...oldData.pages];
    if (newPages[0] && Array.isArray(newPages[0])) {
      newPages[0] = mergeArrays(newPages[0], newPosts);
    } else {
      newPages[0] = newPosts;
    }
    return {
      ...oldData,
      pages: newPages
    };
  } else if (Array.isArray(oldData)) {
    // Simple array structure
    return mergeArrays(oldData, newPosts);
  }
  
  return oldData;
};

/**
 * Update a specific post in query data while maintaining deduplication
 * @param {Array|Object} oldData - Existing query data
 * @param {string|number} postId - ID of the post to update
 * @param {Object} updates - Updates to apply to the post
 * @returns {Array|Object} Updated data
 */
export const updatePostWithDeduplication = (oldData, postId, updates) => {
  if (!oldData) return oldData;
  
  const updatePost = (post) => {
    const currentPostId = post?.post_info?.id || post?.id;
    if (currentPostId === postId) {
      return { ...post, ...updates };
    }
    return post;
  };
  
  if (oldData.pages) {
    // Infinite query structure
    return {
      ...oldData,
      pages: oldData.pages.map(page => 
        Array.isArray(page) ? page.map(updatePost) : page
      )
    };
  } else if (Array.isArray(oldData)) {
    // Simple array structure
    return oldData.map(updatePost);
  } else if (oldData.post_info?.id === postId || oldData.id === postId) {
    // Single post structure
    return { ...oldData, ...updates };
  }
  
  return oldData;
};

/**
 * Remove a specific post from query data
 * @param {Array|Object} oldData - Existing query data
 * @param {string|number} postId - ID of the post to remove
 * @returns {Array|Object} Data with post removed
 */
export const removePostWithDeduplication = (oldData, postId) => {
  if (!oldData) return oldData;
  
  const removePost = (post) => {
    const currentPostId = post?.post_info?.id || post?.id;
    return currentPostId !== postId;
  };
  
  if (oldData.pages) {
    // Infinite query structure
    return {
      ...oldData,
      pages: oldData.pages.map(page => 
        Array.isArray(page) ? page.filter(removePost) : page
      )
    };
  } else if (Array.isArray(oldData)) {
    // Simple array structure
    return oldData.filter(removePost);
  }
  
  return oldData;
}; 

// Utility functions for silent updates to prevent user draft loss
export const silentUpdate = {
  // Update posts list silently without invalidating queries
  updatePostsList: (queryClient, queryKey, updateFn) => {
    queryClient.setQueryData(queryKey, (oldData) => {
      if (!oldData) return oldData;
      
      if (oldData.pages) {
        // Handle infinite query structure
        return {
          ...oldData,
          pages: oldData.pages.map(page => 
            Array.isArray(page) ? page.map(updateFn) : page
          )
        };
      } else if (Array.isArray(oldData)) {
        // Handle simple array structure
        return oldData.map(updateFn);
      }
      
      return oldData;
    });
  },
  
  // Add new post silently without invalidating queries
  addNewPost: (queryClient, queryKey, newPost) => {
    queryClient.setQueryData(queryKey, (oldData) => {
      if (!oldData) return oldData;
      
      if (oldData.pages) {
        // Handle infinite query structure
        const newPages = [...oldData.pages];
        if (newPages[0]) {
          newPages[0] = [newPost, ...newPages[0]];
        } else {
          newPages[0] = [newPost];
        }
        return {
          ...oldData,
          pages: newPages
        };
      } else if (Array.isArray(oldData)) {
        // Handle simple array structure
        return [newPost, ...oldData];
      }
      
      return oldData;
    });
  },
  
  // Remove post silently without invalidating queries
  removePost: (queryClient, queryKey, postId) => {
    queryClient.setQueryData(queryKey, (oldData) => {
      if (!oldData) return oldData;
      
      const filterPost = (post) => {
        return post.post_info?.id !== postId && post.id !== postId;
      };
      
      if (oldData.pages) {
        // Handle infinite query structure
        return {
          ...oldData,
          pages: oldData.pages.map(page => 
            Array.isArray(page) ? page.filter(filterPost) : page
          )
        };
      } else if (Array.isArray(oldData)) {
        // Handle simple array structure
        return oldData.filter(filterPost);
      }
      
      return oldData;
    });
  },
  
  // Update post silently without invalidating queries
  updatePost: (queryClient, queryKey, postId, updateData) => {
    queryClient.setQueryData(queryKey, (oldData) => {
      if (!oldData) return oldData;
      
      const updatePost = (post) => {
        if (post.post_info?.id === postId || post.id === postId) {
          return { ...post, ...updateData };
        }
        return post;
      };
      
      if (oldData.pages) {
        // Handle infinite query structure
        return {
          ...oldData,
          pages: oldData.pages.map(page => 
            Array.isArray(page) ? page.map(updatePost) : page
          )
        };
      } else if (Array.isArray(oldData)) {
        // Handle simple array structure
        return oldData.map(updatePost);
      }
      
      return oldData;
    });
  }
}; 