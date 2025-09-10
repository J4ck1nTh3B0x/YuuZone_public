import { useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import AuthConsumer from '../components/AuthContext';

/**
 * Custom hook for handling real-time vote updates for posts and comments
 * Automatically updates React Query cache when votes change in real-time
 */
export default function useRealtimeVotes(postId, subthreadId) {
  const { socket } = AuthConsumer();
  const queryClient = useQueryClient();

  // Handle real-time post vote updates
  const handlePostVoteUpdate = useCallback((data) => {
    const { post_id, user_id, is_upvote, vote_type, old_vote } = data;
    
    // Only update if we have relevant IDs
    if (!post_id) return;
    
    // Update post data in relevant queries based on context
    const postQueries = [];
    
    if (subthreadId) {
      postQueries.push(['posts', 'thread', subthreadId]);
    }
    if (postId === post_id) {
      postQueries.push(['post', post_id]);
    }
    // Only update global queries if we're not in a specific subthread
    if (!subthreadId) {
      postQueries.push(['posts', 'all'], ['posts', 'popular']);
    }

    postQueries.forEach(queryKey => {
      queryClient.setQueryData(queryKey, (oldData) => {
        if (!oldData) return oldData;

        const updatePostVotes = (post) => {
          if (post.post_info?.id !== post_id) return post;

          const updatedPost = { ...post };
          
          // Update vote counts based on vote type
          if (vote_type === 'new') {
            if (is_upvote) {
              updatedPost.post_info.upvotes = (updatedPost.post_info.upvotes || 0) + 1;
            } else {
              updatedPost.post_info.downvotes = (updatedPost.post_info.downvotes || 0) + 1;
            }
          } else if (vote_type === 'update') {
            // Remove old vote and add new vote
            if (old_vote === true) {
              updatedPost.post_info.upvotes = Math.max(0, (updatedPost.post_info.upvotes || 0) - 1);
            } else if (old_vote === false) {
              updatedPost.post_info.downvotes = Math.max(0, (updatedPost.post_info.downvotes || 0) - 1);
            }
            
            if (is_upvote === true) {
              updatedPost.post_info.upvotes = (updatedPost.post_info.upvotes || 0) + 1;
            } else if (is_upvote === false) {
              updatedPost.post_info.downvotes = (updatedPost.post_info.downvotes || 0) + 1;
            }
          } else if (vote_type === 'remove') {
            if (old_vote === true) {
              updatedPost.post_info.upvotes = Math.max(0, (updatedPost.post_info.upvotes || 0) - 1);
            } else if (old_vote === false) {
              updatedPost.post_info.downvotes = Math.max(0, (updatedPost.post_info.downvotes || 0) - 1);
            }
          }

          return updatedPost;
        };

        // Handle different data structures
        if (Array.isArray(oldData)) {
          return oldData.map(updatePostVotes);
        } else if (oldData.pages) {
          // Infinite query structure
          return {
            ...oldData,
            pages: oldData.pages.map(page => 
              Array.isArray(page) ? page.map(updatePostVotes) : page
            )
          };
        } else if (oldData.post_info) {
          // Single post structure
          return updatePostVotes(oldData);
        }

        return oldData;
      });
    });
  }, [queryClient, subthreadId, postId]);

  // Handle real-time comment vote updates
  const handleCommentVoteUpdate = useCallback((data) => {
    const { comment_id, post_id, user_id, is_upvote, vote_type, old_vote } = data;
    
    // Only update if we have relevant IDs
    if (!comment_id || !post_id) return;
    
    // Only update if this is the post we're currently viewing
    if (postId && postId !== post_id) return;
    
    // Update comment data in post comments query
    queryClient.setQueryData(['comments', post_id], (oldData) => {
      if (!oldData) return oldData;

      const updateCommentVotes = (comment) => {
        if (comment.id !== comment_id) {
          // Check children recursively
          if (comment.children) {
            return {
              ...comment,
              children: comment.children.map(updateCommentVotes)
            };
          }
          return comment;
        }

        const updatedComment = { ...comment };
        
        // Update vote counts based on vote type
        if (vote_type === 'new') {
          if (is_upvote) {
            updatedComment.upvotes = (updatedComment.upvotes || 0) + 1;
          } else {
            updatedComment.downvotes = (updatedComment.downvotes || 0) + 1;
          }
        } else if (vote_type === 'update') {
          // Remove old vote and add new vote
          if (old_vote === true) {
            updatedComment.upvotes = Math.max(0, (updatedComment.upvotes || 0) - 1);
          } else if (old_vote === false) {
            updatedComment.downvotes = Math.max(0, (updatedComment.downvotes || 0) - 1);
          }
          
          if (is_upvote === true) {
            updatedComment.upvotes = (updatedComment.upvotes || 0) + 1;
          } else if (is_upvote === false) {
            updatedComment.downvotes = (updatedComment.downvotes || 0) + 1;
          }
        } else if (vote_type === 'remove') {
          if (old_vote === true) {
            updatedComment.upvotes = Math.max(0, (updatedComment.upvotes || 0) - 1);
          } else if (old_vote === false) {
            updatedComment.downvotes = Math.max(0, (updatedComment.downvotes || 0) - 1);
          }
        }

        return updatedComment;
      };

      return Array.isArray(oldData) ? oldData.map(updateCommentVotes) : oldData;
    });
  }, [queryClient, postId]);

  useEffect(() => {
    if (!socket) return;

    // Set up event listeners
    socket.on('post_vote_updated', handlePostVoteUpdate);
    socket.on('comment_vote_updated', handleCommentVoteUpdate);

    return () => {
      // Clean up event listeners
      socket.off('post_vote_updated', handlePostVoteUpdate);
      socket.off('comment_vote_updated', handleCommentVoteUpdate);
    };
  }, [socket, handlePostVoteUpdate, handleCommentVoteUpdate]);

  // Return functions to emit vote events
  const emitPostVote = useCallback((postId, isUpvote, voteType, oldVote = null) => {
    if (!socket) return;
    
    socket.emit('post_vote', {
      post_id: postId,
      user_id: socket.userId,
      is_upvote: isUpvote,
      vote_type: voteType,
      old_vote: oldVote,
      subthread_id: subthreadId
    });
  }, [socket, subthreadId]);

  const emitCommentVote = useCallback((commentId, postId, isUpvote, voteType, oldVote = null) => {
    if (!socket) return;
    
    socket.emit('comment_vote', {
      comment_id: commentId,
      post_id: postId,
      user_id: socket.userId,
      is_upvote: isUpvote,
      vote_type: voteType,
      old_vote: oldVote
    });
  }, [socket]);

  return {
    emitPostVote,
    emitCommentVote
  };
}
