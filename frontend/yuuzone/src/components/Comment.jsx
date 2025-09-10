import { motion, AnimatePresence } from "framer-motion";
import PropTypes from "prop-types";
import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useParams, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from 'react-toastify';
import axios from "axios";
import avatar from "../assets/avatar.png";
import AuthConsumer from "./AuthContext";
import Svg from "./Svg";
import Vote from "./Vote";
import UserBadge from "./UserBadge";
import Markdown from "markdown-to-jsx";
import useComment from "../hooks/useComment";
import useRealtimeComments from "../hooks/useRealtimeComments";
import useRealtimeVotes from "../hooks/useRealtimeVotes";
import useClickOutside from "../hooks/useClickOutside";
import { timeAgo } from "../pages/fullPost/utils";
import Modal from "./Modal";
import { shouldDisableThreadApis } from "../utils/pageUtils";


Comment.propTypes = {
  children: PropTypes.array,
  comment: PropTypes.object,
  threadID: PropTypes.string,
  commentIndex: PropTypes.number,
  parentDelete: PropTypes.func,
};

export default function Comment({ children, comment, threadID, commentIndex, parentDelete = null }) {
  const { t } = useTranslation();
  const location = useLocation();

  // Initialize real-time hooks
  const postId = comment?.post_id;
  const { emitCommentEdit, emitCommentDelete } = useRealtimeComments(postId);
  useRealtimeVotes(postId, threadID);

  const [isReply, setIsReply] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [expandChildren, setExpandChildren] = useState(true); // Always show nested comments
  const [userRole, setUserRole] = useState(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isTranslatingToMultiple, setIsTranslatingToMultiple] = useState(false);
  const [multiLanguageTranslations, setMultiLanguageTranslations] = useState(null);
  const [translationData, setTranslationData] = useState(null);
  const [isTranslated, setIsTranslated] = useState(false);
  const dropdownRef = useRef(null);

  // Modal state for image viewing
  const [showModal, setShowModal] = useState(false);
  const [modalData, setModalData] = useState(null);

  useClickOutside(dropdownRef, () => setShowDropdown(false));
  const {
    commentChildren,
    commentInfo,
    userInfo,
    currentUser,
    addComment,
    deleteComment,
    updateComment,
    colorSquence,
  } = useComment({
    children,
    comment,
  });
  

  const { isAuthenticated, user } = AuthConsumer();
  const timePassed = timeAgo(new Date(commentInfo?.created_at || new Date()), t);

  // Helper functions for media detection
  function isImage(url) {
    return /(jpg|jpeg|png|webp|avif|gif|svg|image)/.test(url);
  }

  function isValidVideoUrl(url) {
    if (!url || typeof url !== 'string') return false;
    
    // Check for YouTube URLs
    if (/youtube\.com|youtu\.be/i.test(url)) return true;
    
    // Check for direct video file URLs
    const videoExtensions = /\.(mp4|webm|ogg|avi|mov|wmv|flv|mkv)(\?.*)?$/i;
    if (videoExtensions.test(url)) return true;
    
    // Check for other video platforms
    const supportedPlatforms = [
      /vimeo\.com/,
      /dailymotion\.com/,
      /facebook\.com.*\/videos/,
      /twitch\.tv/,
      /streamable\.com/,
      /tiktok\.com/,
      /instagram\.com.*\/reel/,
      /twitter\.com.*\/video/,
      /x\.com.*\/video/
    ];
    
    return supportedPlatforms.some(pattern => pattern.test(url));
  }

  // Handle media click for modal display
  const onMediaClick = useCallback((mediaType, mediaUrl) => {
    if (mediaUrl) {
      setShowModal(true);
      if (mediaType === "video") {
        if (isValidVideoUrl(mediaUrl)) {
          setModalData(
            <div className="w-full h-full flex items-center justify-center">
              <video
                controls
                className="max-w-full max-h-full object-contain rounded-lg"
                src={mediaUrl}
              >
                Your browser does not support the video tag.
              </video>
            </div>
          );
        } else {
          setModalData(
            <div className="flex items-center justify-center w-full h-96 bg-theme-dark-bg text-theme-dark-text rounded-lg">
              <div className="text-center p-6">
                <Svg type="video" className="w-16 h-16 mx-auto mb-4 text-theme-text-muted" />
                <p className="text-lg mb-2">Invalid Video URL</p>
                <p className="text-sm text-theme-text-muted">
                  The video URL is not supported or invalid
                </p>
                <p className="text-xs text-theme-text-secondary mt-2 break-all">
                  {mediaUrl}
                </p>
              </div>
            </div>
          );
        }
      } else {
        // For images, display them in full size within the modal container
        setModalData(
          <div className="w-full h-full flex items-center justify-center">
            <img 
              className="max-w-full max-h-full object-contain rounded-lg shadow-lg" 
              src={mediaUrl} 
              alt="Comment image" 
              loading="lazy"
            />
          </div>
        );
      }
    }
  }, []);

  // Cleanup modal state when component unmounts or modal is closed
  useEffect(() => {
    return () => {
      setShowModal(false);
      setModalData(null);
    };
  }, []);

  // Close modal when showModal changes to false
  useEffect(() => {
    if (!showModal) {
      setModalData(null);
    }
  }, [showModal]);

  // Check if current page should disable thread APIs
  const disableThreadApis = shouldDisableThreadApis(location.pathname);

  // Fetch user's role for this specific subthread
  useEffect(() => {
    if (isAuthenticated && threadID && !disableThreadApis) {
      // Fetch detailed role info for this specific subthread
      axios.get(`/api/thread/${threadID}`)
        .then((res) => {
          const currentUserRole = res.data?.threadData?.currentUserRole;
          setUserRole(currentUserRole || null);
        })
        .catch((error) => {
          setUserRole(null);
        });
    }
  }, [isAuthenticated, threadID, disableThreadApis]);

  async function handleTranslateIt() {
    if (!isAuthenticated) {
      return toast.error(t('alerts.youNeedToBeLoggedIn'));
    }

    // Check if comment content exists and is not empty
    if (!commentInfo?.content || commentInfo.content.trim() === '') {
      toast.error(t('translation.noContentToTranslate'));
      return;
    }

    setIsTranslatingToMultiple(true);
    try {
      const response = await axios.post(`/api/translate/comment/${commentInfo.id}/translate-it`);
      setMultiLanguageTranslations(response.data);

      setTranslationData(response.data);
      setIsTranslated(true);
      
      // Show appropriate toast message
      if (response.data.cached) {
        toast.success(t('translation.translationFromCache'));
      } else {
        toast.success(t('translation.translateItComment'));
      }
    } catch (error) {
      const errorMessage = error.response?.data?.error || t('translation.translationFailed');
      toast.error(errorMessage);
    } finally {
      setIsTranslatingToMultiple(false);
      setShowDropdown(false);
    }
  }



  function handleSelect(value) {
    switch (value) {
      case "delete":
        if (parentDelete) {
          // Try to get comment ID from different possible structures
          const commentId = commentInfo?.id || comment?.comment_info?.id || comment?.id;
          parentDelete(commentId);
        } else {
          deleteComment();
        }
        setShowDropdown(false);
        break;
      case "edit":
        setEditMode(true);
        setShowDropdown(false);
        break;
      case "share":
        navigator.clipboard.writeText(window.location.href);
        toast.success(t('alerts.postLinkCopiedToClipboard'));
        setShowDropdown(false);
        break;
      case "translate-it":
        handleTranslateIt();
        break;
    }
  }

  const toggleCommentTranslation = () => {
    if (translationData) {
      setIsTranslated(!isTranslated);
    }
  };
  return (
    <motion.li
      className={`py-3 pl-2 space-y-2 w-full bg-theme-less-white dark:bg-theme-dark-card rounded-lg md:text-base ${!parentDelete && "border border-theme-border-light dark:border-theme-dark-border"}`}
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: commentIndex * 0.15 }}
      exit={{ opacity: 0, y: -10, transition: { duration: 0.1 } }}>
      {editMode ? (
        <CommentMode
          callBackSubmit={(data) => {
            updateComment(data);
            setEditMode(false);
          }}
          callBackCancel={() => {
            setEditMode(false);
          }}
          defaultValue={commentInfo?.content || ""}
          user={user}
        />
      ) : (
        <>
          <div className="flex items-center justify-between text-sm font-medium">
            <div className="flex items-center space-x-2">
              {!userInfo.user_name ? (
                <>
                  <div className="w-8 h-8 rounded-md bg-theme-gray dark:bg-theme-border-dark flex items-center justify-center" />
                  <span className="font-medium text-theme-text-muted dark:text-theme-text-secondary">u/[deleted]</span>
                  <span className="ml-2 px-2 py-0.5 rounded-lg text-xs font-bold bg-theme-warning dark:bg-theme-warning text-theme-bg-primary dark:text-theme-dark-text border-2 border-theme-border-dark dark:border-theme-border-light" style={{background: 'repeating-linear-gradient(135deg, #d97706, #d97706 10px, #374151 10px, #374151 20px)', letterSpacing: '2px'}}>GONE</span>
                </>
              ) : (
                <>
                  <img loading="lazy" width="auto" height="100%" src={userInfo.user_avatar || avatar} alt="" className="object-cover w-8 h-8 rounded-md" />
                  <div className="flex flex-col">
                    <Link to={`/u/${userInfo.user_name}`} className="font-medium text-theme-link hover:underline">
                      {userInfo.user_name}
                    </Link>
                  </div>
                  {/* User tier badge */}
                  <UserBadge 
                    subscriptionTypes={userInfo?.subscription_types || []} 
                    className="px-2 py-0.5 text-xs font-bold rounded-lg"
                  />
                  {/* Role icons for comment author */}
                  {userInfo.roles?.includes("admin") && (
                    <Svg type="crown-admin" external={true} className="w-7 h-7 text-theme-yellow-crown" />
                  )}
                  {userInfo.roles?.includes("mod") && !userInfo.roles?.includes("admin") && (
                    <Svg type="wrench-mod" external={true} className="w-4 h-4 text-theme-wine-wrench" />
                  )}
                </>
              )}
              <p>{timePassed}</p>
              <p>{commentInfo?.is_edited && t('alerts.edited')}</p>
            </div>
            {/* Three dots menu moved to top right */}
            {isAuthenticated && (
              <div className="relative mr-2" ref={dropdownRef}>
                <button
                  onClick={() => setShowDropdown(!showDropdown)}
                  className="flex items-center justify-center w-8 h-8 text-theme-text-primary dark:text-theme-dark-text"
                >
                  <Svg type="more" className="w-4 h-4" />
                </button>

                {showDropdown && (
                  <div className="absolute top-full right-0 mt-1 w-40 bg-theme-bg-primary dark:bg-theme-dark-card rounded-md shadow-lg border border-theme-border-light dark:border-theme-dark-border z-50 dark:text-theme-dark-text">
                    <div className="py-1">
                      <button
                        onClick={() => handleSelect("share")}
                        className="block w-full text-left px-4 py-2 text-sm text-theme-text-primary dark:text-theme-dark-text hover:bg-theme-bg-hover dark:hover:bg-theme-dark-bg"
                      >
                        Share
                      </button>
                      {isAuthenticated && (
                        <button
                          onClick={translationData ? null : () => handleSelect("translate-it")}
                          disabled={isTranslatingToMultiple || translationData}
                          className={`block w-full text-left px-4 py-2 text-sm ${
                            translationData 
                              ? 'text-gray-400 dark:text-gray-500 cursor-not-allowed' 
                              : 'text-green-600 dark:text-green-400 hover:bg-theme-bg-hover dark:hover:bg-theme-dark-bg'
                          }`}
                        >
                          {isTranslatingToMultiple ? t('translation.translatingToMultipleLanguages') : t('translation.translateIt')}
                        </button>
                      )}
                      {user.username === userInfo.user_name && (
                        <button
                          onClick={() => handleSelect("edit")}
                          className="block w-full text-left px-4 py-2 text-sm text-theme-text-primary dark:text-theme-dark-text hover:bg-theme-bg-hover dark:hover:bg-theme-dark-bg"
                        >
                          Edit
                        </button>
                      )}
                      {(user.username === userInfo.user_name || userRole === "mod" || userRole === "admin") && (
                        <button
                          onClick={() => handleSelect("delete")}
                          className="block w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-theme-bg-hover dark:hover:bg-theme-dark-bg"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="max-w-full text-black dark:text-theme-dark-text prose prose-sm md:prose-base prose-blue dark:prose-invert">
            <Markdown className="[&>*:first-child]:mt-0">
              {isTranslated && translationData ? (
                translationData.translations?.en ? (
                  <div className="space-y-2">
                    <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-md">
                      <p className="text-sm font-semibold text-blue-600 dark:text-blue-400">{t('translation.english')}:</p>
                      <p className="text-sm">{translationData.translations.en}</p>
                    </div>
                    {translationData.translations?.ja && (
                      <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded-md">
                        <p className="text-sm font-semibold text-green-600 dark:text-green-400">{t('translation.japanese')}:</p>
                        <p className="text-sm">{translationData.translations.ja}</p>
                      </div>
                    )}
                    {translationData.translations?.vi && (
                      <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded-md">
                        <p className="text-sm font-semibold text-purple-600 dark:text-purple-400">{t('translation.vietnamese')}:</p>
                        <p className="text-sm">{translationData.translations.vi}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <p>{translationData?.translated_text || commentInfo?.content}</p>
                )
              ) : (
                commentInfo?.content
              )}
            </Markdown>
          </div>
          
          {/* Media display - inline with text */}
          {(commentInfo?.media || (commentInfo?.all_media && commentInfo.all_media.length > 0)) && (
            <div className="mt-2 flex flex-wrap gap-2">
              {commentInfo?.all_media && commentInfo.all_media.length > 0 ? (
                commentInfo.all_media.map((mediaItem, index) => (
                  <div
                    key={index}
                    className="relative overflow-hidden rounded-md"
                  >
                    {mediaItem.type === 'video' || isValidVideoUrl(mediaItem.url) ? (
                      <div className="relative w-24 h-24 bg-gray-200 dark:bg-gray-700 rounded-md flex items-center justify-center">
                        <Svg type="video" className="w-6 h-6 text-gray-500" />
                        <span className="ml-1 text-xs text-gray-500">Video</span>
                      </div>
                    ) : (
                      <img
                        src={mediaItem.url}
                        alt={mediaItem.title || `Media ${index + 1}`}
                        className="w-24 h-24 object-contain rounded-md bg-gray-100 dark:bg-gray-800 cursor-pointer hover:opacity-90 transition-opacity"
                        loading="lazy"
                        onClick={() => onMediaClick("image", mediaItem.url)}
                      />
                    )}
                  </div>
                ))
              ) : (
                /* Handle legacy single media */
                commentInfo?.media && (
                  <div className="relative overflow-hidden rounded-md">
                    {isImage(commentInfo.media) ? (
                      <img
                        src={commentInfo.media}
                        alt="Comment media"
                        className="w-24 h-24 object-contain rounded-md bg-gray-100 dark:bg-gray-800 cursor-pointer hover:opacity-90 transition-opacity"
                        onClick={() => onMediaClick("image", commentInfo.media)}
                      />
                    ) : (
                      <div className="relative w-24 h-24 bg-gray-200 dark:bg-gray-700 rounded-md flex items-center justify-center">
                        <Svg type="video" className="w-6 h-6 text-gray-500" />
                        <span className="ml-1 text-xs text-gray-500">Video</span>
                      </div>
                    )}
                  </div>
                )
              )}
            </div>
          )}
          
          {/* Comment Translation Toggle Button */}
          {translationData && (
            <div className="mt-2">
              <button 
                className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium"
                onClick={toggleCommentTranslation}
              >
                {isTranslated ? t('translation.seeOriginal') : t('translation.seeTranslated')}
              </button>
            </div>
          )}

        </>
      )}
      {/* Modal for displaying full-size images */}
      {showModal && (
        <Modal showModal={showModal} setShowModal={setShowModal}>
          {modalData}
        </Modal>
      )}
      <div className="flex justify-around items-center md:justify-between md:mx-10">
        {/* Reply button moved to where three dots used to be */}
        <div
          className="flex items-center space-x-1"
          onClick={() => {
            isAuthenticated ? setIsReply(!isReply) : toast.error(t('alerts.youNeedToBeLoggedIn'));
          }}>
          <Svg type="comment" className="w-4 h-4" />
          <p className="text-sm cursor-pointer md:text-base">Reply</p>
        </div>
        <div
          className={`${!commentChildren.length && "invisible"} flex items-center space-x-1`}
          onClick={() => setExpandChildren(!expandChildren)}>
          <Svg type="down-arrow" className={`w-4 h-4 ${expandChildren && "rotate-180"}`} />
          <p className="text-sm cursor-pointer md:text-base">{expandChildren ? "Hide" : "Show"}</p>
        </div>
        <div className="flex items-center space-x-2 text-sm md:text-base">
          <Vote
            {...{
              intitalVote: currentUser?.has_upvoted,
              initialCount: commentInfo?.comment_karma || 0,
              url: "/api/reactions/comment",
              contentID: commentInfo?.id,
              type: "full",
            }}
          />
        </div>
      </div>
      {isReply && (
        <CommentMode
          callBackSubmit={(data) => {
            // Handle both string and object data
            if (typeof data === 'string') {
              addComment({ content: data, parent_id: commentInfo?.id });
            } else if (data && typeof data === 'object') {
              addComment({ ...data, parent_id: commentInfo?.id });
            }
            setIsReply(false);
            setExpandChildren(true);
          }}
          callBackCancel={() => {
            setIsReply(false);
          }}
          colorSquence={colorSquence}
          user={user}
          parent_id={commentInfo?.id} // Pass the parent_id for proper reply submission
        />
      )}
      {/* Nested comments now appear AFTER the action bar */}
      <AnimatePresence mode="wait">
        {expandChildren && (
          <ul className={commentChildren.length > 0 && expandChildren && "border-l-2 " + colorSquence()}>
            {commentChildren.map((child, index) => (
              <Comment
                key={child.commentInfo?.id || child.id || index}
                {...child}
                commentIndex={index}
                parentDelete={deleteComment}
              />
            ))}
          </ul>
        )}
      </AnimatePresence>
    </motion.li>
  );
}

CommentMode.propTypes = {
  user: PropTypes.object,
  colorSquence: PropTypes.func,
  callBackSubmit: PropTypes.func,
  callBackCancel: PropTypes.func,
  defaultValue: PropTypes.string,
  comment: PropTypes.object,
  parent_id: PropTypes.number,
};

export function CommentMode({ user, colorSquence, callBackSubmit, callBackCancel, defaultValue = null, comment = null, parent_id = null }) {
  const { t } = useTranslation();
  const { isAuthenticated } = AuthConsumer();
  const { postId } = useParams();
  const [preMD, setPreMD] = useState(false);
  const [content, setContent] = useState(defaultValue || "");
  const [media, setMedia] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const removeMedia = (index) => {
    setMedia(media.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Prevent duplicate submissions
    if (isSubmitting) {
      return;
    }
    
    if (!isAuthenticated) {
      toast.error(t('alerts.youNeedToBeLoggedIn'));
      return;
    }

    if (!content.trim() && media.length === 0) {
      toast.error(t('posts.contentOrMediaRequired'));
      return;
    }

    // Set loading state
    setIsSubmitting(true);

    // Create form data for media upload
    const formData = new FormData();
    formData.append("content", content);
    formData.append("post_id", comment?.post_id || postId || "");
    
    // Use parent_id prop if available, otherwise fall back to comment?.parent_id
    if (parent_id || comment?.parent_id) {
      formData.append("parent_id", parent_id || comment?.parent_id);
      formData.append("has_parent", "true");
    } else {
      // This is a root comment
    }

    // Add media files
    media.forEach((mediaItem, index) => {
      if (mediaItem.file) {
        formData.append("media", mediaItem.file, mediaItem.file.name);
      } else if (mediaItem.url) {
        formData.append(`media_url_${index}`, mediaItem.url);
      }
    });

    try {
      // Use the callback function which handles the React Query mutation
      // Pass both content and media if there are media files
      if (media.length > 0) {
        callBackSubmit({ content, media, parent_id });
      } else {
        callBackSubmit(content);
      }
      
      // Clear the form
      setContent("");
      setMedia([]);
    } catch (error) {
      toast.error(t('alerts.failedToCreateComment'));
    } finally {
      // Reset loading state
      setIsSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10, transition: { duration: 0.15 } }}
      transition={{ duration: 0.25 }}
      className={`mr-4 space-y-2 bg-theme-less-white dark:bg-theme-dark-bg dark:text-theme-dark-text`}>
      <div className="flex items-center space-x-2 text-sm font-medium">
        <img src={user.avatar || avatar} alt="" className="object-cover w-5 h-5 rounded-md" />
        <Link to={`/u/${user.username}`}>{user.username}</Link>
      </div>
      <form
        method="post"
        className="flex flex-col space-y-2"
        onSubmit={handleSubmit}>
        {preMD ? (
          <div className="overflow-auto p-2 max-w-full h-24 rounded-md border prose bg-theme-bg-tertiary dark:bg-theme-dark-bg border-theme-border-light dark:border-theme-dark-border text-theme-text-primary dark:text-theme-dark-text">
            <Markdown options={{ forceBlock: true }}>
              {content.replace("\n", "<br />\n") || "This is markdown preview"}
            </Markdown>
          </div>
        ) : (
          <textarea
            autoFocus
            value={content}
            onChange={(e) => setContent(e.target.value)}
            disabled={isSubmitting}
            className={`p-2 w-full h-24 text-sm rounded-md border md:text-base focus:outline-none bg-theme-bg-tertiary dark:bg-theme-dark-bg border-theme-border-light dark:border-theme-dark-border text-theme-text-primary dark:text-theme-dark-text ${
              isSubmitting ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          />
        )}
        
        {/* Media upload section */}
        <div className="flex flex-col space-y-2">
          <div className="flex space-x-2">
            <label htmlFor="comment-media" className="flex items-center space-x-2">
              <input
                onChange={(e) => {
                  const files = Array.from(e.target.files);
                  const validFiles = files.filter(file => {
                    if (file.size > 10485760) {
                      toast.error(t('posts.fileTooLarge'));
                      return false;
                    }
                    if (media.length + files.length > 4) {
                      toast.error(t('posts.maxImagesReached'));
                      return false;
                    }
                    return true;
                  });
                  
                  const newMedia = validFiles.map(file => ({ file }));
                  setMedia(prev => [...prev, ...newMedia]);
                }}
                type="file"
                name="media"
                id="comment-media"
                accept="image/*, video/*"
                multiple
                className="hidden"
              />
              <button
                type="button"
                onClick={() => document.getElementById('comment-media').click()}
                disabled={isSubmitting}
                className={`px-3 py-1 text-sm text-white rounded-md ${
                  isSubmitting 
                    ? 'bg-gray-400 cursor-not-allowed' 
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {t('posts.addMedia')}
              </button>
            </label>
          </div>
          
          {/* Display selected media */}
          {media.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {media.map((mediaItem, index) => (
                <div key={index} className="relative group">
                  <img
                    src={mediaItem.file ? URL.createObjectURL(mediaItem.file) : mediaItem.url || mediaItem.preview_url}
                    alt={mediaItem.title || `Media ${index + 1}`}
                    className="w-16 h-16 object-cover rounded-md"
                  />
                  <button
                    type="button"
                    onClick={() => removeMedia(index)}
                    disabled={isSubmitting}
                    className={`absolute top-1 right-1 text-white rounded-full w-4 h-4 flex items-center justify-center transition-opacity text-xs ${
                      isSubmitting 
                        ? 'bg-gray-400 cursor-not-allowed opacity-50' 
                        : 'bg-red-500 opacity-0 group-hover:opacity-100'
                    }`}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        
        <div className="flex self-end space-x-2">
          <button 
            type="submit" 
            disabled={isSubmitting}
            className={`px-2 py-1 font-bold text-white rounded-md md:px-5 flex items-center space-x-2 ${
              isSubmitting 
                ? 'bg-gray-400 cursor-not-allowed' 
                : 'bg-theme-button-primary hover:bg-theme-button-primary-hover'
            }`}
          >
            {isSubmitting && (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            )}
            <span>{isSubmitting ? 'Submitting...' : 'Submit'}</span>
          </button>
          <button
            onClick={() => setPreMD(!preMD)}
            type="button"
            disabled={isSubmitting}
            className={`px-2 py-1 font-bold text-white rounded-md md:px-5 ${
              isSubmitting 
                ? 'bg-gray-400 cursor-not-allowed' 
                : 'bg-theme-success hover:bg-theme-success-hover'
            }`}>
            {preMD ? "Close Preview" : "Preview"}
          </button>
          <button
            onClick={() => callBackCancel()}
            type="button"
            disabled={isSubmitting}
            className={`px-2 py-1 font-bold text-white rounded-md md:px-5 ${
              isSubmitting 
                ? 'bg-gray-400 cursor-not-allowed' 
                : 'bg-theme-error hover:bg-theme-error-hover'
            }`}>
            Cancel
          </button>
        </div>
      </form>
    </motion.div>
  );
}
