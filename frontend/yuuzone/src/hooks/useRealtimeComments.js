import { useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import AuthConsumer from '../components/AuthContext';

/**
 * Custom hook for handling real-time comment updates
 * Handles new comments, comment edits, comment deletions
 */
export default function useRealtimeComments(postId) {
  const { socket } = AuthConsumer();
  const queryClient = useQueryClient();

  // Handle new comment creation
  const handleNewComment = useCallback((commentData) => {
    const { comment, children } = commentData;
    
    // Silent update - no refetching, just update the cache
    queryClient.setQueryData(['comments', postId], (oldData) => {
      if (!oldData) return [{ ...comment, children: children || [] }];

      // If it's a top-level comment (no parent)
      if (!comment.has_parent) {
        return [...oldData, { ...comment, children: children || [] }];
      }

      // If it's a reply, find the parent and add to its children
      const addReplyToParent = (comments) => {
        return comments.map(parentComment => {
          if (parentComment.id === comment.parent_id) {
            return {
              ...parentComment,
              children: [...(parentComment.children || []), { ...comment, children: children || [] }]
            };
          }
          
          // Check nested children recursively
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

    // Silent update - no refetching, just update post comment count
    queryClient.setQueryData(['post', postId], (oldData) => {
      if (!oldData?.post_info) return oldData;
      
      return {
        ...oldData,
        post_info: {
          ...oldData.post_info,
          comments_count: (oldData.post_info.comments_count || 0) + 1
        }
      };
    });
  }, [queryClient, postId]);

  // Handle comment edits
  const handleCommentEdit = useCallback((data) => {
    const { comment_id, content, edited_at, edited_by } = data;
    
    queryClient.setQueryData(['comments', postId], (oldData) => {
      if (!oldData) return oldData;

      const updateComment = (comments) => {
        return comments.map(comment => {
          if (comment.id === comment_id) {
            return {
              ...comment,
              content,
              edited_at,
              edited_by
            };
          }
          
          // Check children recursively
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
  }, [queryClient, postId]);

  // Handle comment deletion
  const handleCommentDelete = useCallback((data) => {
    const { comment_id } = data;
    
    queryClient.setQueryData(['comments', postId], (oldData) => {
      if (!oldData) return oldData;

      const removeComment = (comments) => {
        return comments.filter(comment => {
          if (comment.id === comment_id) {
            return false; // Remove this comment
          }
          
          // Check children recursively
          if (comment.children && Array.isArray(comment.children) && comment.children.length > 0) {
            return {
              ...comment,
              children: removeComment(comment.children)
            };
          }
          
          return true; // Keep this comment
        }).map(comment => {
          // Update children for remaining comments
          if (comment.children && Array.isArray(comment.children) && comment.children.length > 0) {
            return {
              ...comment,
              children: removeComment(comment.children)
            };
          }
          return comment;
        });
      };

      return removeComment(oldData);
    });

    // Update post comment count
    queryClient.setQueryData(['post', postId], (oldData) => {
      if (!oldData?.post_info) return oldData;
      
      return {
        ...oldData,
        post_info: {
          ...oldData.post_info,
          comments_count: Math.max(0, (oldData.post_info.comments_count || 0) - 1)
        }
      };
    });
  }, [queryClient, postId]);

  useEffect(() => {
    if (!socket || !postId) return;

    // Join the post room to receive comment updates
    socket.emit('join', { room: postId });

    // Set up event listeners
    socket.on('new_comment', handleNewComment);
    socket.on('comment_edited', handleCommentEdit);
    socket.on('comment_deleted', handleCommentDelete);

    return () => {
      // Leave the post room
      socket.emit('leave', { room: postId });
      
      // Clean up event listeners
      socket.off('new_comment', handleNewComment);
      socket.off('comment_edited', handleCommentEdit);
      socket.off('comment_deleted', handleCommentDelete);
    };
  }, [socket, postId, handleNewComment, handleCommentEdit, handleCommentDelete]);

  // Return functions to emit comment events
  const emitCommentEdit = useCallback((commentId, content, editedBy, editedAt) => {
    if (!socket) return;
    
    socket.emit('comment_edit', {
      comment_id: commentId,
      post_id: postId,
      content,
      edited_by: editedBy,
      edited_at: editedAt
    });
  }, [socket, postId]);

  const emitCommentDelete = useCallback((commentId, deletedBy) => {
    if (!socket) return;
    
    socket.emit('comment_delete', {
      comment_id: commentId,
      post_id: postId,
      deleted_by: deletedBy
    });
  }, [socket, postId]);

  return {
    emitCommentEdit,
    emitCommentDelete
  };
}
