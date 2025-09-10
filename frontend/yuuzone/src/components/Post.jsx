import { AnimatePresence, motion, useInView } from "framer-motion";
import PropTypes from "prop-types";
import { useCallback, useEffect, useRef, useState } from "react";
import ReactPlayer from "react-player";
import { Link, ScrollRestoration, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from 'react-toastify';
import avatar from "../assets/avatar.png";
import { formatDateTime } from "../utils/dateFormatter";
import AuthConsumer from "./AuthContext";
import Modal from "./Modal";
import PostMoreOptions from "./PostMoreOptions";
import Svg from "./Svg";
import Vote from "./Vote";
import Markdown from "markdown-to-jsx";
import useRealtimeVotes from "../hooks/useRealtimeVotes";
import useRealtimePost from "../hooks/useRealtimePost";
import UserBadge from "./UserBadge";
import axios from "axios";


Post.propTypes = {
  post: PropTypes.object,
  isExpanded: PropTypes.bool,
  postIndex: PropTypes.number,
  setCommentMode: PropTypes.func,
};

export function Post({ post, isExpanded = false, postIndex, setCommentMode }) {
  // ALL HOOKS MUST BE CALLED BEFORE ANY EARLY RETURNS
  const navigate = useNavigate();
  const { isAuthenticated, socket } = AuthConsumer();
  const { t, i18n } = useTranslation();
  const vidRef = useRef(null);

  // Initialize real-time hooks
  const postId = post?.post_info?.id || post?.id;
  const subthreadId = post?.post_info?.subthread_id || post?.subthread_id;
  useRealtimeVotes(postId, subthreadId);
  useRealtimePost(subthreadId);

  // Initialize state with stable initial values - always call these hooks
  const [modalShow, setShowModal] = useState(false);
  const [modalData, setModalData] = useState(null);
  const [, setInViewState] = useState(false);
  const [, setVideoPlayerReady] = useState(false);
  const [showVideoPlayer, setShowVideoPlayer] = useState(false);
  const [translationData, setTranslationData] = useState(null);
  const [isTranslated, setIsTranslated] = useState(false);
  const [isBoosted, setIsBoosted] = useState(false);

  // Safe inView hook that won't crash
  const inView = useInView(vidRef, {
    threshold: 0.1,
    triggerOnce: false
  });

  // Update inView state safely
  useEffect(() => {
    setInViewState(inView);

    // Reset video player when post goes out of view
    if (!inView && showVideoPlayer) {
      setShowVideoPlayer(false);
    }
  }, [inView, showVideoPlayer]);

  // Guard clause to prevent rendering with invalid post data
  // MOVED AFTER ALL HOOKS TO FOLLOW RULES OF HOOKS
  // Extract values with safe defaults to avoid dependency on the entire post object
  const postTitle = post?.post_info?.title || "Untitled Post";
  // postId already declared above for real-time hooks
  const postKarma = post?.post_info?.post_karma || 0;
  const hasUpvoted = post?.current_user?.has_upvoted ?? null;
  const createdAtString = post?.post_info?.created_at || new Date().toISOString();
  const mediaUrl = post?.post_info?.media || null;

  // Simplified useEffect with correct dependencies
  useEffect(() => {
    if (isExpanded && postTitle && postTitle !== "Untitled Post") {
      document.title = postTitle;
      return () => {
        document.title = "yuuzone";
      };
    }
  }, [isExpanded, postTitle]); // Include both dependencies

  // Check if post is boosted - now using data from backend
  useEffect(() => {
    if (post?.is_boosted) {
      setIsBoosted(true);
    } else {
      setIsBoosted(false);
    }
  }, [post?.is_boosted, post?.id]);

  // Listen for post boost events to update local state
  useEffect(() => {
    if (!socket || !post?.id) return;

    const handlePostBoosted = (data) => {
      if (data.post_id === post.id) {
        setIsBoosted(true);
        // Update the post data to reflect the boost
        if (post) {
          post.is_boosted = true;
        }
        
        // Also update React Query cache for instant visual feedback across all components
        // This ensures the post shows as boosted immediately for all users viewing it
        const queryClient = window.queryClient || window.__REACT_QUERY_CLIENT__;
        if (queryClient) {
          // Get all possible sorting and duration combinations
          const sortOptions = ['top', 'hot', 'new'];
          const durationOptions = ['day', 'week', 'month', 'year', 'alltime'];
          
          const postQueryKeys = [
            ['posts', 'all'],
            ['posts', 'popular'],
            ['posts', 'home'],
            ['post', post.id]
          ];
          
          // Add all sorting and duration combinations for each feed type
          ['all', 'popular', 'home'].forEach(feedType => {
            sortOptions.forEach(sortBy => {
              durationOptions.forEach(duration => {
                postQueryKeys.push(['posts', feedType, sortBy, duration]);
              });
            });
          });
          
          // If we have subthread info, also update thread-specific queries with all sorting combinations
          if (post.subthread_id) {
            postQueryKeys.push(['posts', 'thread', post.subthread_id]);
            sortOptions.forEach(sortBy => {
              durationOptions.forEach(duration => {
                postQueryKeys.push(['posts', 'thread', post.subthread_id, sortBy, duration]);
              });
            });
          }
          
          postQueryKeys.forEach(queryKey => {
            queryClient.setQueryData(queryKey, (oldData) => {
              if (!oldData) return oldData;
              
              if (oldData.pages) {
                // Handle infinite query structure
                return {
                  ...oldData,
                  pages: oldData.pages.map(page => 
                    Array.isArray(page) ? page.map(p => 
                      p.id === post.id || p.post_info?.id === post.id
                        ? { ...p, is_boosted: true }
                        : p
                    ) : page
                  )
                };
              } else if (Array.isArray(oldData)) {
                // Handle simple array structure
                return oldData.map(p => 
                  p.id === post.id || p.post_info?.id === post.id
                    ? { ...p, is_boosted: true }
                    : p
                );
              } else if (oldData.id === post.id || oldData.post_info?.id === post.id) {
                // Handle single post structure
                return { ...oldData, is_boosted: true };
              }
              return oldData;
            });
          });
        }
      }
    };

    socket.on('post_boosted', handlePostBoosted);

    return () => {
      if (socket && socket.connected) {
        socket.off('post_boosted', handlePostBoosted);
      }
    };
  }, [socket, post?.id, post]);

  const onMediaClick = useCallback((mediaType) => {
    if (mediaUrl) {
      setShowModal(true);
      if (mediaType === "video") {
        if (isValidVideoUrl(mediaUrl)) {
          const cleanUrl = cleanYouTubeUrl(mediaUrl);

          // For YouTube videos, first show a thumbnail with play button
          if (isValidYouTubeUrl(mediaUrl)) {
            const videoId = getYouTubeVideoId(mediaUrl);
            setModalData(
              <div className="relative w-full h-full flex items-center justify-center">
                <div
                  className="relative cursor-pointer w-full h-full flex items-center justify-center"
                  onClick={() => {
                    // Replace thumbnail with actual player when clicked
                    setModalData(
                      <div className="w-full h-full flex items-center justify-center">
                        <ReactPlayer
                          playing={true}
                          controls
                          url={cleanUrl}
                          width="100%"
                          height="100%"
                          pip={false}
                          light={false}
                          loop={false}
                          onError={(error) => {
                            // ReactPlayer error in modal
                          }}
                          config={{
                            youtube: {
                              playerVars: {
                                showinfo: 1,
                                origin: window.location.origin,
                                modestbranding: 1,
                                rel: 0,
                                autoplay: 1,
                                controls: 1,
                                disablekb: 0,
                                enablejsapi: 0,
                                fs: 1,
                                iv_load_policy: 3
                              },
                              preload: false
                            }
                          }}
                        />
                      </div>
                    );
                  }}
                >
                  <img
                    src={`https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`}
                    alt="Video thumbnail"
                    className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
                    onError={(e) => {
                      // Fallback to lower quality thumbnail if maxresdefault fails
                      e.target.src = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
                    }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-20 h-20 bg-black bg-opacity-70 rounded-full flex items-center justify-center">
                      <Svg type="play" className="w-10 h-10 text-white ml-1" />
                    </div>
                  </div>
                </div>
              </div>
            );
          } else {
            // For non-YouTube videos, load player directly
            setModalData(
              <div className="w-full h-full flex items-center justify-center">
                <ReactPlayer
                  playing={true}
                  controls
                  url={cleanUrl}
                  width="100%"
                  height="100%"
                  onError={(error) => {
                    // ReactPlayer error in modal
                  }}
                  config={{
                    youtube: {
                      playerVars: {
                        showinfo: 1,
                        origin: window.location.origin,
                        modestbranding: 1,
                        rel: 0,
                        autoplay: 1
                      }
                    }
                  }}
                />
              </div>
            );
          }
        } else {
          setModalData(
            <div className="flex items-center justify-center w-full h-96 bg-theme-dark-bg text-theme-dark-text rounded-lg dark:bg-theme-dark-bg dark:text-theme-dark-text">
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
              src={mediaUrl.replace("additional_args", "c_auto,g_auto")} 
              alt="Post image" 
              loading="lazy"
            />
          </div>
        );
      }
    }
  }, [mediaUrl, setShowModal, setModalData, t])
  function onReplyClick() {
    if (isAuthenticated) {
      setCommentMode((data) => !data);
    } else {
      toast.error(t('alerts.youMustBeLoggedInToReply'));
    }
  }

  const toggleTranslation = useCallback(() => {
    if (translationData) {
      setIsTranslated(!isTranslated);
    }
  }, [translationData, isTranslated]);

  const handleTranslationComplete = useCallback((data) => {
    setTranslationData(data);
    setIsTranslated(true);
  }, []);
  const PostVariant = {
    hidden: {
      opacity: 0,
      y: 100,
    },
    animate: {
      opacity: 1,
      y: 0,
    },
    empty: {},
  };
  function isImage(url) {
    return /(jpg|jpeg|png|webp|avif|gif|svg|image)/.test(url);
  }

  // YouTube URL validation function
  function isValidYouTubeUrl(url) {
    if (!url || typeof url !== 'string') return false;

    // More comprehensive YouTube URL patterns
    const youtubePatterns = [
      // Standard youtube.com URLs
      /^(https?:\/\/)?(www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})(\S*)?$/,
      // youtu.be short URLs
      /^(https?:\/\/)?youtu\.be\/([a-zA-Z0-9_-]{11})(\S*)?$/,
      // YouTube embed URLs
      /^(https?:\/\/)?(www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]{11})(\S*)?$/,
      // YouTube v/ URLs
      /^(https?:\/\/)?(www\.)?youtube\.com\/v\/([a-zA-Z0-9_-]{11})(\S*)?$/,
      // YouTube mobile URLs
      /^(https?:\/\/)?m\.youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})(\S*)?$/,
      // YouTube gaming URLs
      /^(https?:\/\/)?(www\.)?youtube\.com\/gaming\/watch\?v=([a-zA-Z0-9_-]{11})(\S*)?$/
    ];

    return youtubePatterns.some(pattern => pattern.test(url));
  }

  // Extract YouTube video ID from URL
  function getYouTubeVideoId(url) {
    if (!url) return null;

    // Handle youtu.be URLs
    const youtuBeMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
    if (youtuBeMatch) return youtuBeMatch[1];

    // Handle youtube.com URLs
    const youtubeMatch = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
    if (youtubeMatch) return youtubeMatch[1];

    // Handle embed URLs
    const embedMatch = url.match(/embed\/([a-zA-Z0-9_-]{11})/);
    if (embedMatch) return embedMatch[1];

    return null;
  }

  // Clean YouTube URL by removing playlist and other problematic parameters
  function cleanYouTubeUrl(url) {
    if (!url || !isValidYouTubeUrl(url)) return url;

    const videoId = getYouTubeVideoId(url);
    if (!videoId) return url;

    // Return a clean YouTube URL without playlist parameters
    return `https://www.youtube.com/watch?v=${videoId}`;
  }

  // Get YouTube thumbnail URL
  function getYouTubeThumbnail(url) {
    const videoId = getYouTubeVideoId(url);
    if (!videoId) return null;

    // Use maxresdefault for best quality, fallback to hqdefault if not available
    return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
  }

  // Handle video thumbnail click
  const handleVideoThumbnailClick = useCallback(() => {
    if (isExpanded) {
      setShowVideoPlayer(true);
    } else {
      onMediaClick("video");
    }
  }, [isExpanded, onMediaClick]);

  // Early return after all hooks to avoid conditional hook calls
  if (!post || !post.post_info || !post.post_info.id) {
    return (
      <div className="flex flex-col p-4 bg-theme-bg-tertiary rounded-lg border-2 border-theme-border-medium">
        <p className="text-theme-text-secondary">Post data unavailable</p>
      </div>
    );
  }

  // Check if URL is a valid video URL (YouTube or other supported formats)
  function isValidVideoUrl(url) {
    if (!url || typeof url !== 'string') return false;

    // Check for YouTube URLs (including more flexible patterns)
    if (isValidYouTubeUrl(url)) return true;

    // Additional YouTube patterns that might not be caught by the main function
    if (/youtube\.com|youtu\.be/i.test(url)) return true;

    // Check for direct video file URLs
    const videoExtensions = /\.(mp4|webm|ogg|avi|mov|wmv|flv|mkv)(\?.*)?$/i;
    if (videoExtensions.test(url)) return true;

    // Check for other video platforms that ReactPlayer supports
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
  async function handleShare() {
    return navigator.clipboard
      .writeText(`${location.protocol}//${location.host}/post/${post?.post_info.id}`)
      .then(() => {
        toast.success(t('alerts.copiedPostLinkToClipboard'));
      })
      .catch((err) => toast.error(err.message || err));
  }
  // Simple date creation without memoization
  const createdAt = createdAtString ? new Date(createdAtString) : new Date();

  // --- Button block and collision logic for collapsed version ---
  const buttonBlockRef = useRef(null);
  const voteBlockRef = useRef(null);
  const dateTimeBlockRef = useRef(null);
  const [buttonBlockOffset, setButtonBlockOffset] = useState(0);
  const [dateTimeOffset, setDateTimeOffset] = useState(0);

  useEffect(() => {
    if (!isExpanded && buttonBlockRef.current && voteBlockRef.current) {
      const buttonRect = buttonBlockRef.current.getBoundingClientRect();
      const voteRect = voteBlockRef.current.getBoundingClientRect();
      // If right edge of button block touches or overlaps left edge of vote block
      if (buttonRect.right >= voteRect.left) {
        setButtonBlockOffset(-8);
      } else {
        setButtonBlockOffset(0);
      }
    }
    if (!isExpanded && dateTimeBlockRef.current && buttonBlockRef.current) {
      const dateRect = dateTimeBlockRef.current.getBoundingClientRect();
      const buttonRect = buttonBlockRef.current.getBoundingClientRect();
      // If right edge of date/time touches or overlaps left edge of button block
      if (dateRect.right >= buttonRect.left) {
        setDateTimeOffset(-5);
      } else {
        setDateTimeOffset(0);
      }
    }
  }, [isExpanded, post]);

  return (
    <>
      <motion.li
        data-post-id={postId}
        className={`group flex flex-col p-1 bg-theme-less-white dark:bg-theme-dark-card rounded-lg ${!isExpanded ? "md:flex-row" : ""} dark:text-theme-dark-text mb-2 relative transition-all duration-300 ${
          isBoosted 
            ? 'border-2 border-yellow-400 shadow-lg shadow-yellow-400/50 bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20' 
            : ''
        }`}
        variants={PostVariant}
        initial={postIndex < 5 || isExpanded ? "hidden" : "empty"}
        animate={postIndex < 5 || isExpanded ? "animate" : "empty"}
        exit={{ opacity: 0, y: 100, transition: { duration: 0.25 } }}
        transition={{
          duration: 0.25,
          delay: postIndex * 0.25,
        }}

        >
        {isBoosted && (
          <div className="absolute top-2 left-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <motion.div 
              className="bg-gradient-to-r from-yellow-400 to-orange-400 text-yellow-900 px-3 py-1.5 rounded-full text-xs font-bold shadow-lg"
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ duration: 0.5, type: "spring" }}
            >
              {t('posts.boosted')}
            </motion.div>
          </div>
        )}

        {/* Media display - handle both legacy single media and new multiple media */}
        {(post.post_info.media || (post.post_info.all_media && post.post_info.all_media.length > 0)) && (
          <div className="relative overflow-hidden rounded-md my-auto">
            {/* Handle multiple media items */}
            {post.post_info.all_media && post.post_info.all_media.length > 0 ? (
              <div className={`${isExpanded ? 
                `grid gap-2 ${post.post_info.all_media.length === 1 ? 'grid-cols-1' : post.post_info.all_media.length === 2 ? 'grid-cols-2' : 'grid-cols-2 md:grid-cols-4'}` : 
                'relative'}`}>
                {/* In feed view, show only first image with overlay for multiple images */}
                {isExpanded ? (
                  // Expanded view - show all images
                  post.post_info.all_media.map((mediaItem, index) => (
                  <div
                    key={index}
                      className={`relative overflow-hidden h-full md:h-96 rounded-md`}
                    ref={index === 0 ? vidRef : null}
                  >
                    {mediaItem.type === 'video' || isValidVideoUrl(mediaItem.url) ? (
                      isValidVideoUrl(mediaItem.url) ? (
                        <>
                          {isValidYouTubeUrl(mediaItem.url) && !showVideoPlayer ? (
                            // YouTube thumbnail with play button overlay
                            <div
                              className="relative w-full h-full cursor-pointer"
                              onClick={() => {
                                if (isExpanded) {
                                  setShowVideoPlayer(true);
                                } else {
                                  onMediaClick("video");
                                }
                              }}
                            >
                              <img
                                src={getYouTubeThumbnail(mediaItem.url)}
                                alt="Video thumbnail"
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  const videoId = getYouTubeVideoId(mediaItem.url);
                                  if (videoId) {
                                    e.target.src = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
                                  }
                                }}
                              />
                              <div className="absolute inset-0 flex items-center justify-center">
                                <div className="w-16 h-16 bg-theme-dark-bg bg-opacity-70 rounded-md flex items-center justify-center">
                                  <Svg type="play" className="w-8 h-8 text-theme-dark-text ml-1" />
                                </div>
                              </div>
                            </div>
                          ) : (
                            showVideoPlayer && (
                              <ReactPlayer
                                url={cleanYouTubeUrl(mediaItem.url)}
                                width="100%"
                                height="100%"
                                controls
                                muted={!isExpanded}
                                loop={false}
                                playing={false}
                                light={false}
                                pip={false}
                                style={{ position: "absolute", top: 0, left: 0 }}
                                onError={(error) => {
                                  setShowVideoPlayer(false);
                                }}
                                onReady={() => {
                                  setVideoPlayerReady(true);
                                }}
                                config={{
                                  youtube: {
                                    playerVars: {
                                      showinfo: 1,
                                      origin: window.location.origin,
                                      modestbranding: 1,
                                      rel: 0,
                                      autoplay: 0,
                                      controls: 1,
                                      disablekb: 0,
                                      enablejsapi: 0,
                                      fs: 1,
                                      iv_load_policy: 3,
                                      start: 0
                                    },
                                    preload: false
                                  }
                                }}
                              />
                            )
                          )}
                        </>
                      ) : (
                        <div className="flex items-center justify-center w-full h-full bg-theme-bg-dark text-white">
                          <div className="text-center p-4">
                            <Svg type="video" className="w-12 h-12 mx-auto mb-2 text-theme-text-muted" />
                            <p className="text-sm">Invalid video URL</p>
                          </div>
                        </div>
                      )
                    ) : (
                      <img
                        onClick={() => {
                          onMediaClick("image");
                        }}
                        loading="lazy"
                        width="auto"
                        height="100%"
                        src={mediaItem.url}
                        alt={mediaItem.title || `Media ${index + 1}`}
                        className={`object-contain w-full h-full rounded-md duration-500 md:cursor-pointer bg-gray-100 dark:bg-gray-800 ${!isExpanded && "hover:scale-105"}`}
                      />
                    )}
                  </div>
                  ))
                ) : (
                  // Feed view - show only first image with overlay for multiple images
                  <div
                    className={`relative overflow-hidden ${isExpanded ? "h-full md:h-96" : "md:h-32"} rounded-md`}
                    ref={vidRef}
                  >
                    {(() => {
                      const firstMedia = post.post_info.all_media[0];
                      return firstMedia.type === 'video' || isValidVideoUrl(firstMedia.url) ? (
                        isValidVideoUrl(firstMedia.url) ? (
                          <>
                            {isValidYouTubeUrl(firstMedia.url) && !showVideoPlayer ? (
                              // YouTube thumbnail with play button overlay
                              <div
                                className="relative w-full h-full cursor-pointer"
                                onClick={() => {
                                  if (isExpanded) {
                                    setShowVideoPlayer(true);
                                  } else {
                                    onMediaClick("video");
                                  }
                                }}
                              >
                                <img
                                  src={getYouTubeThumbnail(firstMedia.url)}
                                  alt="Video thumbnail"
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    const videoId = getYouTubeVideoId(firstMedia.url);
                                    if (videoId) {
                                      e.target.src = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
                                    }
                                  }}
                                />
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <div className="w-16 h-16 bg-theme-dark-bg bg-opacity-70 rounded-md flex items-center justify-center">
                                    <Svg type="play" className="w-8 h-8 text-theme-dark-text ml-1" />
                                  </div>
                                </div>
                              </div>
                            ) : (
                              showVideoPlayer && (
                                <ReactPlayer
                                  url={cleanYouTubeUrl(firstMedia.url)}
                                  width="100%"
                                  height="100%"
                                  controls
                                  muted={!isExpanded}
                                  loop={false}
                                  playing={false}
                                  light={false}
                                  pip={false}
                                  style={{ position: "absolute", top: 0, left: 0 }}
                                  onError={(error) => {
                                    setShowVideoPlayer(false);
                                  }}
                                  onReady={() => {
                                    setVideoPlayerReady(true);
                                  }}
                                  config={{
                                    youtube: {
                                      playerVars: {
                                        showinfo: 1,
                                        origin: window.location.origin,
                                        modestbranding: 1,
                                        rel: 0,
                                        autoplay: 0,
                                        controls: 1,
                                        disablekb: 0,
                                        enablejsapi: 0,
                                        fs: 1,
                                        iv_load_policy: 3,
                                        start: 0
                                      },
                                      preload: false
                                    }
                                  }}
                                />
                              )
                            )}
                          </>
                        ) : (
                          <div className="flex items-center justify-center w-full h-full bg-theme-bg-dark text-white">
                            <div className="text-center p-4">
                              <Svg type="video" className="w-12 h-12 mx-auto mb-2 text-theme-text-muted" />
                              <p className="text-sm">Invalid video URL</p>
                            </div>
                          </div>
                        )
                      ) : (
                        <img
                          onClick={() => {
                            onMediaClick("image");
                          }}
                          loading="lazy"
                          width="auto"
                          height="100%"
                          src={firstMedia.url}
                          alt={firstMedia.title || "First media"}
                          className={`object-contain w-full h-full rounded-md duration-500 md:cursor-pointer bg-gray-100 dark:bg-gray-800 ${!isExpanded && "hover:scale-105"}`}
                        />
                      );
                    })()}
                    
                    {/* Show overlay for multiple images in feed view */}
                    {post.post_info.all_media.length > 1 && (
                      <div className="absolute top-2 right-2 bg-black bg-opacity-70 text-white px-2 py-1 rounded-md text-xs font-medium">
                        +{post.post_info.all_media.length - 1} {t('posts.moreImages')}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              /* Handle legacy single media */
              <div
                className={`relative overflow-hidden ${isExpanded ? "h-full md:h-96" : "md:w-64 md:h-32"} md:pt-0 ${!isImage(post.post_info.media) && "pt-[56.25%] aspect-video"} rounded-md`}
                ref={vidRef}
              >
                {!isImage(post.post_info.media) ? (
                  isValidVideoUrl(post.post_info.media) ? (
                    <>
                      {isValidYouTubeUrl(post.post_info.media) && !showVideoPlayer ? (
                        // YouTube thumbnail with play button overlay
                        <div
                          className="relative w-full h-full cursor-pointer"
                          onClick={handleVideoThumbnailClick}
                        >
                          <img
                            src={getYouTubeThumbnail(post.post_info.media)}
                            alt="Video thumbnail"
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              // Fallback to lower quality thumbnail if maxresdefault fails
                              const videoId = getYouTubeVideoId(post.post_info.media);
                              if (videoId) {
                                e.target.src = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
                              }
                            }}
                          />
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-16 h-16 bg-theme-dark-bg bg-opacity-70 rounded-md flex items-center justify-center">
                              <Svg type="play" className="w-8 h-8 text-theme-dark-text ml-1" />
                            </div>
                          </div>
                        </div>
                      ) : (
                        showVideoPlayer && (
                          <ReactPlayer
                            url={cleanYouTubeUrl(post.post_info.media)}
                            width="100%"
                            height="100%"
                            controls
                            muted={!isExpanded}
                            loop={false}
                            playing={false}
                            light={false}
                            pip={false}
                            style={{ position: "absolute", top: 0, left: 0 }}
                            onError={(error) => {
                              setShowVideoPlayer(false);
                            }}
                            onReady={() => {
                              setVideoPlayerReady(true);
                            }}
                            config={{
                              youtube: {
                                playerVars: {
                                  showinfo: 1,
                                  origin: window.location.origin,
                                  modestbranding: 1,
                                  rel: 0,
                                  autoplay: 0,
                                  controls: 1,
                                  disablekb: 0,
                                  enablejsapi: 0,
                                  fs: 1,
                                  iv_load_policy: 3,
                                  start: 0
                                },
                                preload: false
                              }
                            }}
                          />
                        )
                      )}
                    </>
                  ) : (
                    <div className="flex items-center justify-center w-full h-full bg-theme-bg-dark text-white">
                      <div className="text-center p-4">
                        <Svg type="video" className="w-12 h-12 mx-auto mb-2 text-theme-text-muted" />
                        <p className="text-sm">Invalid video URL</p>
                        <p className="text-xs text-theme-text-muted mt-1">
                          {post.post_info.media?.length > 50
                            ? `${post.post_info.media.substring(0, 50)}...`
                            : post.post_info.media}
                        </p>
                      </div>
                    </div>
                  )
                ) : (
                  <img
                    onClick={() => {
                      onMediaClick("image");
                    }}
                    loading="lazy"
                    width="auto"
                    height="100%"
                    src={post.post_info.media}
                    alt=""
                    className={`object-contain w-full h-full rounded-md duration-500 md:cursor-pointer bg-gray-100 dark:bg-gray-800 ${!isExpanded && "hover:scale-105"}`}
                  />
                )}
              </div>
            )}
          </div>
        )}
        <div className="flex flex-col flex-1 p-2 space-y-3 w-full md:space-y-0 md:space-x-4 md:flex-row">
          {/* Left side - User information */}
          <div className="flex flex-col items-center space-y-1 md:w-24 md:flex-shrink-0">
            {!post?.user_info.user_name ? (
              <>
                <div className="w-12 h-12 rounded-md bg-theme-gray dark:bg-theme-border-dark flex items-center justify-center" />
                <span className="text-xs font-medium text-theme-text-muted dark:text-theme-text-secondary block">u/[deleted]</span>
                <div className="mt-1 flex flex-col items-center">
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-theme-warning dark:bg-theme-warning text-theme-bg-primary dark:text-theme-dark-text border-2 border-theme-border-dark dark:border-theme-border-light" style={{background: 'repeating-linear-gradient(135deg, #d97706, #d97706 10px, #374151 10px, #374151 20px)', letterSpacing: '2px'}}>GONE</span>
                </div>
              </>
            ) : (
              <>
                <img
                  src={post?.user_info.user_avatar || avatar}
                  alt=""
                  className="object-cover w-12 h-12 rounded-md"
                />
                <Link to={`/u/${post?.user_info.user_name}`} className="text-center">
                  <span className="text-xs font-medium text-theme-link hover:underline block">
                    u/{post?.user_info.user_name}
                  </span>
                </Link>
                {/* User tier badge */}
                <UserBadge 
                  subscriptionTypes={post?.user_info?.subscription_types || []} 
                  className="px-2 py-0.5 text-xs font-bold rounded-lg"
                />
                {/* Role icons for post author */}
                <div className="flex items-center space-x-1">
                  {post?.user_info.roles?.includes("admin") && (
                    <Svg type="crown-admin" external={true} className="w-6 h-6 text-theme-yellow-crown" />
                  )}
                  {post?.user_info.roles?.includes("mod") && !post?.user_info.roles?.includes("admin") && (
                    <Svg type="wrench-mod" external={true} className="w-4 h-4 text-theme-wine-wrench" />
                  )}
                </div>
              </>
            )}
          </div>

          {/* Right side - Post content */}
          <div className="flex flex-col space-y-1 w-full md:justify-between">
            {isExpanded ? (
              <div className="flex flex-col space-y-1 w-full h-full">
                <div className={`w-full font-semibold text-ellipsis ${post.post_info.content && "border-b-2 border-transparent pb-2"}`}>
                  {isTranslated && translationData?.translations?.ja?.translated_title 
                    ? translationData.translations.ja.translated_title 
                    : post?.post_info.title}
                </div>
                {post.post_info.content && (
                  <div className="max-w-full text-black dark:text-theme-dark-text prose prose-sm md:prose-base prose-blue dark:prose-invert">
                    <Markdown className="[&>*:first-child]:mt-0">
                      {isTranslated && translationData?.translations?.ja?.translated_content 
                        ? translationData.translations.ja.translated_content 
                        : post?.post_info.content}
                    </Markdown>
                  </div>
                )}
                {/* Translation Toggle Button */}
                {translationData && (
                  <div className="mt-2">
                    <button 
                      className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium"
                      onClick={toggleTranslation}
                    >
                      {isTranslated ? t('translation.seeOriginal') : t('translation.seeTranslated')}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link to={`/post/${post?.post_info.id}`} className="flex flex-col space-y-1 w-full h-full">
                <div className="w-full font-semibold text-ellipsis">
                  {isTranslated && translationData?.translations?.ja?.translated_title 
                    ? translationData.translations.ja.translated_title 
                    : post?.post_info.title}
                </div>
                {/* Translation Toggle Button for non-expanded view */}
                {translationData && (
                  <div className="mt-1">
                    <button 
                      className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium"
                      onClick={(e) => {
                        e.preventDefault();
                        toggleTranslation();
                      }}
                    >
                      {isTranslated ? t('translation.seeOriginal') : t('translation.seeTranslated')}
                    </button>
                  </div>
                )}
              </Link>
            )}
            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <p className="text-xs">in</p>
                <Link
                  to={`/${post?.thread_info.thread_name}`}
                  className="text-xs font-medium hover:underline text-theme-blue">{` ${post?.thread_info.thread_name}`}</Link>
                {post?.thread_info.thread_logo && (
                  <img 
              src={post?.thread_info.thread_logo} 
              alt="" 
              className="object-cover w-6 h-6 rounded-md" 
              loading="lazy"
              width="24"
              height="24"
            />
                )}
                <span onClick={() => navigate(`/post/${post?.post_info.id}`)} className="flex-1 md:hidden"></span>
              </div>
              <div className="hidden space-x-1 md:flex" ref={dateTimeBlockRef} style={{ marginLeft: dateTimeOffset }}>
                <p className="text-xs font-light">
                  {formatDateTime(createdAt, i18n.language)}
                </p>
                <p className="text-xs">{post?.post_info.is_edited && t('alerts.edited')}</p>
              </div>
            </div>
            <div className="flex space-x-1 md:hidden ml-[-8px]" ref={dateTimeBlockRef} style={{ marginLeft: dateTimeOffset }}>
              <p className="text-xs font-light">
                {formatDateTime(createdAt, i18n.language)}
              </p>
              <p className="text-xs">{post?.post_info.is_edited && t('alerts.edited')}</p>
            </div>
          </div>
        </div>
        <div className={`flex ${isExpanded && "items-center justify-between mx-5 md:-mt-4"}`}>
          {isExpanded ? (
            <div className="flex flex-col md:flex-row items-center justify-around w-full md:w-fit md:justify-evenly gap-4 md:gap-6">
              <div className="flex items-center gap-2">
                <Svg type="comment" className="w-5 h-5" onClick={() => onReplyClick()} />
                <p className="text-sm md:cursor-pointer md:text-base text-theme-text-primary dark:text-theme-dark-text">Reply</p>
              </div>
              <div className="flex items-center gap-2 md:cursor-pointer group" onClick={handleShare}>
                <Svg type="share" className="w-5 h-5" />
                <p className="text-sm md:cursor-pointer md:text-base text-theme-text-primary dark:text-theme-dark-text">{t('posts.share')}</p>
              </div>
              <div className="flex items-center gap-2 relative">
                <PostMoreOptions
                  creatorInfo={post?.user_info}
                  threadInfo={post?.thread_info}
                  postInfo={{
                    ...post?.post_info,
                    is_boosted: post?.is_boosted || false
                  }}
                  setShowModal={setShowModal}
                  setModalData={setModalData}
                  handleShare={handleShare}
                  currentUser={post?.current_user}
                  onTranslationComplete={handleTranslationComplete}
                  translationData={translationData}
                />
              </div>
              <div className="flex items-center space-x-3 md:hidden">
                <Vote
                  {...{
                    intitalVote: hasUpvoted,
                    initialCount: postKarma,
                    url: "/api/reactions/post",
                    contentID: postId,
                    type: "mobile",
                  }}
                />
              </div>
            </div>
          ) : (
            <div className="flex items-center h-full ml-[-8px] mr-8" ref={buttonBlockRef} style={{ marginLeft: buttonBlockOffset }}>
              <div className="flex flex-col items-center gap-3">
                <Link to={`/post/${post?.post_info.id}`} className="flex flex-row items-center w-full md:cursor-pointer group">
                  <span className="inline-flex w-7 flex-shrink-0 items-center justify-start">
                    <Svg type="comment" className="w-5 h-5 " />
                  </span>
                  <span className="flex-1 text-base text-left text-theme-text-primary dark:text-theme-dark-text">{t('posts.comments')}</span>
                </Link>
                <button onClick={handleShare} className="flex flex-row items-center w-full group">
                  <span className="inline-flex w-7 flex-shrink-0 items-center justify-start">
                    <Svg type="share" className="w-5 h-5 " />
                  </span>
                  <span className="flex-1 text-base text-left text-theme-text-primary dark:text-theme-dark-text">{t('posts.share')}</span>
                </button>
                <div className="flex flex-row items-center w-full relative">
                    <PostMoreOptions
                      creatorInfo={post?.user_info}
                      threadInfo={post?.thread_info}
                      postInfo={{
                        ...post?.post_info,
                        is_boosted: post?.is_boosted || false
                      }}
                      setShowModal={setShowModal}
                      setModalData={setModalData}
                      handleShare={handleShare}
                      currentUser={post?.current_user}
                      onTranslationComplete={handleTranslationComplete}
                      translationData={translationData}
                    />
                </div>
              </div>
            </div>
          )}
          <div
            className={`hidden justify-around items-center my-2 space-y-1  md:flex border-theme-gray-blue ${isExpanded ? "flex-row space-x-10" : "flex-col px-5 border-l"
              }`} ref={voteBlockRef}>
            <Vote
              {...{
                intitalVote: hasUpvoted,
                initialCount: postKarma,
                url: "/api/reactions/post",
                contentID: postId,
                type: "full",
              }}
            />
          </div>
        </div>
      </motion.li>
      {isExpanded && <ScrollRestoration />}
      <AnimatePresence>
        {modalShow && modalData && (
          <Modal setShowModal={setShowModal} showModal={modalShow}>
            {modalData}
          </Modal>
        )}
      </AnimatePresence>
    </>
  );
}

export default Post;