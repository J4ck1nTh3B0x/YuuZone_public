import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import PropTypes from 'prop-types';
import Comment from './Comment';
import useOptimizedRealtimeUpdates from '../hooks/useOptimizedRealtimeUpdates';

CommentOptimized.propTypes = {
  comment: PropTypes.object.isRequired,
  postId: PropTypes.string.isRequired,
  depth: PropTypes.number,
  isNew: PropTypes.bool,
  isEdited: PropTypes.bool
};

export default function CommentOptimized({ comment, postId, depth = 0, isNew = false, isEdited = false }) {
  const { t } = useTranslation();
  const commentRef = useRef(null);
  const [isExpanded, setIsExpanded] = useState(true);
  const [showReplies, setShowReplies] = useState(true);
  const [translationData, setTranslationData] = useState(null);
  const [isTranslated, setIsTranslated] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);

  // Use optimized real-time updates
  const { updateStats } = useOptimizedRealtimeUpdates({
    batchDelay: 150,
    maxBatchSize: 8,
    throttleDelay: 30,
    enableOptimisticUpdates: true,
    preserveScrollPosition: true
  }) || { updateStats: { totalUpdates: 0, batchedUpdates: 0, skippedUpdates: 0 } };

  // Memoized comment data to prevent unnecessary re-renders
  const commentData = useMemo(() => ({
    id: comment.id,
    content: comment.content,
    user: comment.user,
    created_at: comment.created_at,
    updated_at: comment.updated_at,
    edited_at: comment.edited_at,
    edited_by: comment.edited_by,
    votes: comment.votes || 0,
    user_vote: comment.user_vote,
    children: comment.children || [],
    has_parent: comment.has_parent,
    parent_id: comment.parent_id,
    isNew: isNew || comment.isNew,
    isEdited: isEdited || comment.isEdited
  }), [comment, isNew, isEdited]);

  // Smooth entrance animation for new comments
  useEffect(() => {
    if (isNew && commentRef.current) {
      commentRef.current.style.opacity = '0';
      commentRef.current.style.transform = 'translateY(-10px)';
      
      requestAnimationFrame(() => {
        commentRef.current.style.transition = 'opacity 0.4s ease-out, transform 0.4s ease-out';
        commentRef.current.style.opacity = '1';
        commentRef.current.style.transform = 'translateY(0)';
      });
    }
  }, [isNew]);

  // Handle translation toggle
  const toggleTranslation = () => {
    if (translationData) {
      setIsTranslated(!isTranslated);
    }
  };

  // Handle translate it functionality
  const handleTranslateIt = async () => {
    if (!commentData.content) {
      toast.error(t('alerts.noContentToTranslate'));
      return;
    }

    setIsTranslating(true);
    try {
      const response = await fetch('/api/translate/comment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          comment_id: commentData.id,
          translate_to_multiple: true
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setTranslationData(data);
        setIsTranslated(true);
        toast.success(t('alerts.translationSuccess'));
      } else {
        toast.error(t('alerts.translationFailed'));
      }
    } catch (error) {
      toast.error(t('alerts.translationFailed'));
    } finally {
      setIsTranslating(false);
    }
  };

  // Determine content to display
  const displayContent = isTranslated && translationData?.content 
    ? translationData.content 
    : commentData.content;

  // Animation variants
  const commentVariants = {
    initial: { 
      opacity: 0, 
      y: -10,
      scale: 0.98
    },
    animate: { 
      opacity: 1, 
      y: 0,
      scale: 1,
      transition: {
        duration: 0.25,
        ease: "easeOut"
      }
    },
    exit: { 
      opacity: 0, 
      y: -10,
      scale: 0.98,
      transition: {
        duration: 0.2
      }
    },
    hover: {
      y: -1,
      transition: {
        duration: 0.15
      }
    }
  };

  const newCommentVariants = {
    initial: { 
      opacity: 0, 
      y: -15,
      scale: 0.95,
      backgroundColor: "rgba(34, 197, 94, 0.1)"
    },
    animate: { 
      opacity: 1, 
      y: 0,
      scale: 1,
      backgroundColor: "rgba(34, 197, 94, 0)",
      transition: {
        duration: 0.5,
        ease: "easeOut"
      }
    }
  };

  const replyVariants = {
    initial: { 
      opacity: 0, 
      x: -20,
      scale: 0.95
    },
    animate: { 
      opacity: 1, 
      x: 0,
      scale: 1,
      transition: {
        duration: 0.3,
        ease: "easeOut"
      }
    }
  };

  return (
    <motion.div
      ref={commentRef}
      data-comment-id={commentData.id}
      className={`comment-container relative ${
        depth > 0 ? 'ml-4 md:ml-8 border-l-2 border-theme-gray-blue dark:border-theme-dark-border pl-4' : ''
      } ${isNew ? 'ring-1 ring-green-500 ring-opacity-30' : ''} ${
        isEdited ? 'ring-1 ring-yellow-500 ring-opacity-20' : ''
      }`}
      variants={isNew ? newCommentVariants : depth > 0 ? replyVariants : commentVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      layout
    >
      {/* New comment indicator */}
      {isNew && (
        <motion.div
          className="absolute top-1 right-1 bg-green-500 text-white text-xs px-1.5 py-0.5 rounded-full"
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.3 }}
        >
          {t('common.new')}
        </motion.div>
      )}

      {/* Edited indicator */}
      {isEdited && (
        <motion.div
          className="absolute top-1 right-1 bg-yellow-500 text-white text-xs px-1.5 py-0.5 rounded-full"
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.3 }}
        >
          {t('common.edited')}
        </motion.div>
      )}

      <div className="bg-theme-less-white dark:bg-theme-dark-card rounded-lg p-3 mb-2 shadow-sm transition-all duration-200">
        {/* Comment header */}
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-theme-text-primary dark:text-theme-dark-text">
              {commentData.user?.username || t('common.anonymous')}
            </span>
            <span className="text-xs text-theme-text-secondary dark:text-theme-dark-text-secondary">
              {new Date(commentData.created_at).toLocaleDateString()}
            </span>
            {commentData.edited_at && (
              <span className="text-xs text-theme-text-secondary dark:text-theme-dark-text-secondary">
                ({t('common.edited')})
              </span>
            )}
          </div>
          
          {/* Translation toggle button */}
          {translationData && (
            <motion.button
              className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-1 rounded hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
              onClick={toggleTranslation}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {isTranslated ? t('common.showOriginal') : t('common.showTranslation')}
            </motion.button>
          )}
        </div>

        {/* Comment content */}
        <motion.div 
          className="text-sm text-theme-text-primary dark:text-theme-dark-text mb-3"
          layout
        >
          {displayContent}
        </motion.div>

        {/* Comment actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {/* Voting */}
            <div className="flex items-center space-x-1">
              <button className="text-theme-text-secondary dark:text-theme-dark-text-secondary transition-colors">
                ▲
              </button>
              <span className="text-sm font-medium">{commentData.votes}</span>
              <button className="text-theme-text-secondary dark:text-theme-dark-text-secondary transition-colors">
                ▼
              </button>
            </div>

            {/* Reply button */}
            <button className="text-xs text-theme-text-secondary dark:text-theme-dark-text-secondary transition-colors">
              {t('common.reply')}
            </button>

            {/* Translate button */}
            {!translationData && (
              <button 
                className="text-xs text-theme-text-secondary dark:text-theme-dark-text-secondary transition-colors disabled:opacity-50"
                onClick={handleTranslateIt}
                disabled={isTranslating}
              >
                {isTranslating ? t('common.translating') : t('common.translate')}
              </button>
            )}

            {/* More options */}
            <button className="text-xs text-theme-text-secondary dark:text-theme-dark-text-secondary transition-colors">
              ⋯
            </button>
          </div>

          {/* Replies count */}
          {commentData.children && Array.isArray(commentData.children) && commentData.children.length > 0 && (
            <button 
              className="text-xs text-theme-text-secondary dark:text-theme-dark-text-secondary hover:text-theme-blue dark:hover:text-blue-400 transition-colors"
              onClick={() => setShowReplies(!showReplies)}
            >
              {showReplies ? t('common.hideReplies') : `${commentData.children?.length || 0} ${t('common.replies')}`}
            </button>
          )}
        </div>
      </div>

      {/* Nested replies */}
      {commentData.children && Array.isArray(commentData.children) && commentData.children.length > 0 && showReplies && (
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
          >
            {(commentData.children || []).map((reply) => (
              <CommentOptimized
                key={reply.id}
                comment={reply}
                postId={postId}
                depth={depth + 1}
                isNew={reply.isNew}
                isEdited={reply.isEdited}
              />
            ))}
          </motion.div>
        </AnimatePresence>
      )}

      {/* Update stats indicator (debug mode) */}
      {process.env.NODE_ENV === 'development' && updateStats.totalUpdates > 0 && (
        <div className="absolute bottom-1 right-1 text-xs text-gray-400">
          {updateStats.batchedUpdates} batches
        </div>
      )}
    </motion.div>
  );
} 