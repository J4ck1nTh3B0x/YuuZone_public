import { useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { useState } from "react";
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import { useParams } from "react-router-dom";

const borderColors = [
  "border-theme-comment-border-1",
  "border-theme-comment-border-2",
  "border-theme-comment-border-3",
  "border-theme-comment-border-4",
  "border-theme-comment-border-5",
  "border-theme-comment-border-6",
];

let curColor = 0;

export default function useComment({ children, comment }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { postId } = useParams();
  const [commentChildren, setCommentChildren] = useState(children || []);
  
  // Safely destructure the comment object with defaults
  const commentData = comment || {};
  const [{ comment_info: commentInfo, user_info: userInfo, current_user: currentUser }, setCommentInfo] =
    useState(commentData);

  const { mutate: addComment } = useMutation({
    mutationFn: async (data) => {
      if (!data || (typeof data === 'string' && data.length === 0) || (data.content && data.content.length === 0)) {
        throw new Error("Comment content cannot be empty");
      }
      
      // Check if this is a reply or root comment
      const isReply = data.parent_id && data.parent_id !== null;
      
      // Handle both string content and object with media
      let requestData;
      let headers = {};
      
      if (data.media && data.media.length > 0) {
        // Handle media upload with FormData
        const formData = new FormData();
        formData.append("content", data.content || data);
        formData.append("post_id", postId);
        formData.append("has_parent", isReply);
        if (isReply) {
          formData.append("parent_id", data.parent_id);
        }
        
        // Add media files
        data.media.forEach((mediaItem, index) => {
          if (mediaItem.file) {
            formData.append("media", mediaItem.file, mediaItem.file.name);
          } else if (mediaItem.url) {
            formData.append(`media_url_${index}`, mediaItem.url);
          }
        });
        
        requestData = formData;
        headers = { "Content-Type": "multipart/form-data" };
      } else {
        // Handle text-only comment with JSON
        requestData = {
          post_id: postId,
          content: data.content || data,
          has_parent: isReply,
          parent_id: isReply ? data.parent_id : null
        };
        headers = { "Content-Type": "application/json" };
      }
      
      const response = await axios.post(
        "/api/comments",
        requestData,
        { headers }
      );
      return response.data;
    },
    onSuccess: (data) => {
      const newComment = data.new_comment;
      if (newComment.comment.comment_info.has_parent) {
        // Find parent comment and add new comment to its children
        setCommentChildren((prevChildren) => {
          const addReplyToParent = (children) => {
            return children.map((child) => {
              if (child.comment.comment_info.id === newComment.comment.comment_info.parent_id) {
                return {
                  ...child,
                  children: [...child.children, newComment],
                };
              }
              if (child.children && Array.isArray(child.children) && child.children.length > 0) {
                return {
                  ...child,
                  children: addReplyToParent(child.children),
                };
              }
              return child;
            });
          };
          return addReplyToParent(prevChildren);
        });
      } else {
        setCommentChildren((prevChildren) => [...prevChildren, newComment]);
      }
    },
    onError: (error) => {
      let errorMessage = "Failed to add comment. Please try again.";

      if (error.response?.status === 409) {
        errorMessage = "This comment appears to be a duplicate. Please wait a moment before trying again.";
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.response?.status === 403) {
        errorMessage = "You don't have permission to comment on this post.";
      } else if (error.response?.status === 400) {
        errorMessage = "Invalid comment data. Please check your input.";
      } else if (error.response?.status === 429) {
        errorMessage = "Too many comments. Please wait before trying again.";
      }

      toast.error(t(errorMessage));
    },
  });

  const { mutate: deleteComment } = useMutation({
    mutationFn: async (childId = null) => {
      if (!window.confirm("Are you sure you want to delete this comment?")) {
        throw new Error("Delete cancelled by user");
      }
      // Handle different comment structures
      let commentId = childId;
      if (!commentId) {
        // Try to get comment ID from different possible structures
        if (commentInfo?.id) {
          commentId = commentInfo.id;
        } else if (comment?.comment_info?.id) {
          commentId = comment.comment_info.id;
        } else if (comment?.id) {
          commentId = comment.id;
        }
      }
      
      if (!commentId) {
        throw new Error("Comment ID not found");
      }
      const response = await axios.delete(`/api/comments/${commentId}`);
      return { response: response.data, childId: commentId };
    },
    onSuccess: (data) => {
      const { childId } = data;
      if (childId) {
        // Remove from comment children if it's a child comment
        setCommentChildren(prevChildren => 
          prevChildren.filter((c) => c.comment?.comment_info?.id !== childId)
        );
        
        // Also update the main query data
        queryClient.setQueryData(["post", postId], (oldData) => {
          if (!oldData) return oldData;
          return {
            ...oldData,
            comment_info: oldData.comment_info?.filter((c) => c.comment?.comment_info?.id !== childId) || []
          };
        });
      } else {
        // Remove the current comment from the main query data
        const currentCommentId = commentInfo?.id || comment?.comment_info?.id || comment?.id;
        queryClient.setQueryData(["post", postId], (oldData) => {
          if (!oldData) return oldData;
          return {
            ...oldData,
            comment_info: oldData.comment_info?.filter((c) => c.comment?.comment_info?.id !== currentCommentId) || []
          };
        });
      }
    },
    onError: (error) => {
      if (error.message === "Delete cancelled by user") {
        return; // User cancelled, don't show error
      }
      let errorMessage = "Failed to delete comment. Please try again.";

      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.response?.status === 403) {
        errorMessage = "You don't have permission to delete this comment.";
      } else if (error.response?.status === 404) {
        errorMessage = "Comment not found.";
      }

      toast.error(t(errorMessage));
    },
  });

  const { mutate: updateComment } = useMutation({
    mutationFn: async (data) => {
      if (!data || data.length === 0) {
        return;
      }
      await axios.patch(`/api/comments/${commentInfo?.id}`, { content: data }).then(() => {
        setCommentInfo({
          user_info: userInfo,
          current_user: currentUser,
          comment_info: { ...commentInfo, content: data, is_edited: true },
        });
      });
    },
  });

  function colorSquence() {
    if (curColor == (borderColors?.length || 0)) {
      curColor = 0;
    }
    return borderColors[curColor++];
  }

  return {
    commentChildren,
    commentInfo,
    userInfo,
    currentUser,
    addComment,
    deleteComment,
    updateComment,
    colorSquence,
  };
}
