import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { handleBanError } from "../../utils/banHandler";
import AuthConsumer from "../../components/AuthContext";
import Comment, { CommentMode } from "../../components/Comment";
import { Loader } from "../../components/Loader";
import SafePost from "../../components/SafePost";
import useSocket from "../../hooks/useSocket";
import { toast } from 'react-toastify';

export function FullPost() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { user } = AuthConsumer();
  const { postId } = useParams();
  const [commentMode, setCommentMode] = useState(false);
  const [replyParentId, setReplyParentId] = useState(null);
  const { data: post, isFetching, error: postError } = useQuery({
    queryKey: ["post", postId],
    queryFn: async () => {
      try {
        // Use the comments endpoint which returns both post info and comments
        const response = await axios.get(`/api/comments/post/${postId}`);
        return response.data; // This contains both post_info and comment_info
      } catch (error) {
        if (handleBanError(error, navigate)) {
          return null;
        }
        throw error;
      }
    },
    enabled: !!postId,
    retry: 2,
    retryDelay: 1000,
  });

  const { connected, socket } = useSocket(postId);

  useEffect(() => {
    if (!connected) return;

    socket.on("new_comment", (comment) => {
      try {
        queryClient.setQueryData(["post", postId], (oldData) => {
          if (!oldData) return oldData;
          return {
            ...oldData,
            comment_info: [...(oldData.comment_info || []), comment],
          };
        });
      } catch {
        // Don't re-throw the error to prevent it from bubbling up to React error boundary
      }
    });

    socket.on("comment_deleted", (data) => {
      try {
        const { comment_id } = data;
        queryClient.setQueryData(["post", postId], (oldData) => {
          if (!oldData) return oldData;
          return {
            ...oldData,
            comment_info: oldData.comment_info?.filter((c) => c.comment?.comment_info?.id !== comment_id) || []
          };
        });
      } catch {
        // Don't re-throw the error to prevent it from bubbling up to React error boundary
      }
    });

    return () => {
      socket.off("new_comment");
      socket.off("comment_deleted");
    };
  }, [connected, socket, queryClient, postId]);

  const { mutate: newComment } = useMutation({
    mutationFn: async ({ content, parent_id = null, media = [] }) => {
      let requestData;
      let headers = {};
      
      if (media && media.length > 0) {
        // Handle media upload with FormData
        const formData = new FormData();
        formData.append("content", content);
        formData.append("post_id", postId);
        formData.append("has_parent", !!parent_id);
        if (parent_id) {
          formData.append("parent_id", parent_id);
        }
        
        // Add media files
        media.forEach((mediaItem, index) => {
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
          content,
          parent_id,
          has_parent: !!parent_id
        };
        headers = { "Content-Type": "application/json" };
      }
      
      const response = await axios.post("/api/comments", requestData, { headers });
      return response.data;
    },
    onSuccess: (data, variables) => {
      queryClient.setQueryData(["post", postId], (oldData) => {
        if (variables.parent_id) {
          // For nested comments, we need to invalidate only this specific post
          // This is necessary for proper comment threading display
          queryClient.invalidateQueries(["post", postId]);
        } else {
          return { 
            ...oldData, 
            comment_info: [...(oldData.comment_info || []), data.new_comment] 
          };
        }
        return oldData;
      });
      setCommentMode(false);
      setReplyParentId(null);
    },
    onError: (error) => {
      // Check if it's a ban error and handle redirect
      if (handleBanError(error, navigate)) {
        return;
      }

      let errorMessage = "Failed to create comment. Please try again.";

      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.response?.status === 403) {
        errorMessage = t('alerts.youDontHavePermissionToComment');
      } else if (error.response?.status === 400) {
        errorMessage = t('alerts.invalidCommentData');
      }

      toast.error(errorMessage);
      // Don't reset the form on error so user can retry
    },
  });
  if (isFetching) {
    return (
      <div className="flex flex-col justify-center items-center w-full h-screen">
        <Loader forPosts={true} />
      </div>
    );
  }

  // Handle case where query failed
  if (postError) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 min-h-[40vh]">
        <svg className="w-16 h-16 text-theme-error mb-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12A9 9 0 1 1 3 12a9 9 0 0 1 18 0Z" />
        </svg>
        <p className="text-lg text-theme-error dark:text-theme-error">Failed to load post. Please try again.</p>
      </div>
    );
  }

  // Handle case where post data is undefined or null
  if (!post || !post.post_info) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 min-h-[40vh]">
        <svg className="w-16 h-16 text-theme-error mb-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12A9 9 0 1 1 3 12a9 9 0 0 1 18 0Z" />
        </svg>
        <p className="text-lg text-theme-error dark:text-theme-error">Post not found or has been removed.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col p-2 space-y-2 w-full">
      <ul>
        <SafePost post={post?.post_info} isExpanded={true} setCommentMode={() => { setCommentMode(true); setReplyParentId(null); }} />
      </ul>
      {commentMode && (
        <div className="py-3 pl-2 space-y-2 w-full bg-theme-less-white rounded-lg md:text-base dark:bg-theme-dark-bg border-theme-border-light dark:border-theme-dark-border">
          <CommentMode
            user={user}
            defaultValue=""
            callBackSubmit={(content) => {
              if (typeof content === "string") {
                newComment({ content, parent_id: replyParentId });
              } else if (content && typeof content === "object" && content.content) {
                newComment({ ...content, parent_id: replyParentId });
              } else {
                toast.error(t('alerts.invalidCommentContent'));
              }
            }}
            callBackCancel={() => {
              setCommentMode(false);
              setReplyParentId(null);
            }}
          />
        </div>
      )}
      {post?.comment_info && post.comment_info.length > 0 ? (
        <ul className="space-y-2 rounded-lg md:border-2 md:p-2 hover:shadow-sm border-theme-gray-blue">
          <AnimatePresence>
            {post?.comment_info.map((commentData, index) => (
              <Comment
                key={commentData.comment?.comment_info?.id || commentData.comment?.id || index}
                comment={commentData.comment}
                children={commentData.children}
                commentIndex={index}
                onReply={(parentId) => {
                  setCommentMode(true);
                  setReplyParentId(parentId);
                }}
              />
            ))}
          </AnimatePresence>
        </ul>
      ) : (
        <div>
          <p className="p-5 text-sm bg-theme-less-white dark:bg-theme-dark-card rounded-lg border-2 md:text-base hover:shadow-sm border-theme-gray-blue dark:border-theme-dark-border text-theme-text-primary dark:text-theme-dark-text-secondary">
            This post has no comments, be the first to reply!
          </p>
        </div>
      )}
    </div>
  );
}

export default FullPost;
