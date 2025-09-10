import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import PropTypes from 'prop-types';
import PostUserInfo from './PostUserInfo';
import PostContent from './PostContent';
import PostActions from './PostActions';
import PostVoting from './PostVoting';
import PostMedia from './PostMedia';
import CommentSection from './CommentSection';
import useOptimizedRealtimeUpdates from '../hooks/useOptimizedRealtimeUpdates';

PostOptimized.propTypes = {
  post: PropTypes.object.isRequired,
  showComments: PropTypes.bool,
  isNew: PropTypes.bool,
  isEdited: PropTypes.bool
};

export default function PostOptimized({ post, showComments = true, isNew = false, isEdited = false }) {
  const { t } = useTranslation();
  const postRef = useRef(null);
  const [showFullContent, setShowFullContent] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [translationData, setTranslationData] = useState(null);
  const [isTranslated, setIsTranslated] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);

  // Use optimized real-time updates
  const { updateStats } = useOptimizedRealtimeUpdates({
    batchDelay: 200,
    maxBatchSize: 5,
    throttleDelay: 50,
    enableOptimisticUpdates: true,
    preserveScrollPosition: true
  });

  // Memoized post data to prevent unnecessary re-renders
  const postData = useMemo(() => ({
    id: post.id || post.post_info?.id,
    title: post.title || post.post_info?.title,
    content: post.content || post.post_info?.content,
    media: post.media || post.post_info?.media,
    votes: post.votes || post.post_info?.votes || 0,
    comments_count: post.comments_count || post.post_info?.comments_count || 0,
    created_at: post.created_at || post.post_info?.created_at,
    updated_at: post.updated_at || post.post_info?.updated_at,
    user: post.user || post.post_info?.user,
    subthread: post.subthread || post.post_info?.subthread,
    isNew: isNew || post.isNew,
    isEdited: isEdited || post.isEdited
  }), [post, isNew, isEdited]);

  // Smooth entrance animation for new posts
  useEffect(() => {
    if (isNew && postRef.current) {
      postRef.current.style.opacity = '0';
      postRef.current.style.transform = 'translateY(-20px)';
      
      requestAnimationFrame(() => {
        postRef.current.style.transition = 'opacity 0.5s ease-out, transform 0.5s ease-out';
        postRef.current.style.opacity = '1';
        postRef.current.style.transform = 'translateY(0)';
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
    if (!postData.content && !postData.title) {
      toast.error(t('alerts.noContentToTranslate'));
      return;
    }

    setIsTranslating(true);
    try {
      const response = await fetch('/api/translate/post', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          post_id: postData.id,
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
  const displayTitle = isTranslated && translationData?.title 
    ? translationData.title 
    : postData.title;
  
  const displayContent = isTranslated && translationData?.content 
    ? translationData.content 
    : postData.content;

  // Animation variants
  const postVariants = {
    initial: { 
      opacity: 0, 
      y: -20,
      scale: 0.95
    },
    animate: { 
      opacity: 1, 
      y: 0,
      scale: 1,
      transition: {
        duration: 0.3,
        ease: "easeOut"
      }
    },
    exit: { 
      opacity: 0, 
      y: -20,
      scale: 0.95,
      transition: {
        duration: 0.2
      }
    },
    hover: {
      y: -2,
      transition: {
        duration: 0.2
      }
    }
  };

  const newPostVariants = {
    initial: { 
      opacity: 0, 
      y: -30,
      scale: 0.9,
      backgroundColor: "rgba(59, 130, 246, 0.1)"
    },
    animate: { 
      opacity: 1, 
      y: 0,
      scale: 1,
      backgroundColor: "rgba(59, 130, 246, 0)",
      transition: {
        duration: 0.6,
        ease: "easeOut"
      }
    }
  };

  return (
    <motion.div
      ref={postRef}
      data-post-id={postData.id}
      className={`post-container relative bg-theme-less-white dark:bg-theme-dark-card rounded-lg border-transparent dark:border-theme-dark-border shadow-sm transition-all duration-200 ${
        isNew ? 'ring-2 ring-blue-500 ring-opacity-50' : ''
      } ${isEdited ? 'ring-1 ring-yellow-500 ring-opacity-30' : ''}`}
      variants={isNew ? newPostVariants : postVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      layout
    >
      {/* New post indicator */}
      {isNew && (
        <motion.div
          className="absolute top-2 right-2 bg-blue-500 text-white text-xs px-2 py-1 rounded-full"
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3, duration: 0.3 }}
        >
          {t('common.new')}
        </motion.div>
      )}

      {/* Edited indicator */}
      {isEdited && (
        <motion.div
          className="absolute top-2 right-2 bg-yellow-500 text-white text-xs px-2 py-1 rounded-full"
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3, duration: 0.3 }}
        >
          {t('common.edited')}
        </motion.div>
      )}

      <div className="p-4">
        {/* Post header */}
        <div className="flex items-start space-x-3 mb-3">
          <PostUserInfo 
            userInfo={postData.user} 
            avatar={postData.user?.user_avatar || '/assets/avatar.png'}
          />
          
          {/* Translation toggle button */}
          {translationData && (
            <motion.button
              className="ml-auto text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-1 rounded hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
              onClick={toggleTranslation}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {isTranslated ? t('common.showOriginal') : t('common.showTranslation')}
            </motion.button>
          )}
        </div>

        {/* Post content */}
        <div className="mb-4">
          {postData.title && (
            <motion.h2 
              className="text-lg font-semibold text-theme-text-primary dark:text-theme-dark-text mb-2"
              layout
            >
              {displayTitle}
            </motion.h2>
          )}
          
          {postData.content && (
            <PostContent
              content={displayContent}
              showFullContent={showFullContent}
              setShowFullContent={setShowFullContent}
              isExpanded={isExpanded}
              setIsExpanded={setIsExpanded}
            />
          )}
        </div>

        {/* Post media */}
        {postData.media && (
          <motion.div 
            className="mb-4"
            layout
          >
            <PostMedia media={postData.media} />
          </motion.div>
        )}

        {/* Post actions and voting */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <PostVoting 
              postId={postData.id}
              initialVotes={postData.votes}
              userVote={postData.user_vote}
            />
            
            <PostActions
              post={postData}
              onTranslateIt={handleTranslateIt}
              isTranslating={isTranslating}
              hasTranslation={!!translationData}
            />
          </div>
          
          <div className="text-sm text-theme-text-secondary dark:text-theme-dark-text-secondary">
            {postData.comments_count} {t('common.comments')}
          </div>
        </div>
      </div>

      {/* Comments section */}
      {showComments && (
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="border-t border-theme-gray-blue dark:border-theme-dark-border"
          >
            <CommentSection 
              postId={postData.id}
              commentsCount={postData.comments_count}
            />
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