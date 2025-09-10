
import { useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import PropTypes from "prop-types";
import { useRef, useState, useEffect, useMemo, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { createPortal } from "react-dom";
import useClickOutside from "../hooks/useClickOutside";
import AuthConsumer from "./AuthContext";
import NewPost from "./NewPost";
import Svg from "./Svg";
import { toast } from 'react-toastify';
import useRealtimeCoins from "../hooks/useRealtimeCoins";
import useRealtimeSettings from "../hooks/useRealtimeSettings";
import { shouldDisableThreadApis } from "../utils/pageUtils";

// Global state to ensure only one dropdown is open at a time
let globalActiveDropdownId = null;
let globalDropdownCallbacks = new Map();

// Function to close all other dropdowns
const closeOtherDropdowns = (currentId) => {
  if (globalActiveDropdownId && globalActiveDropdownId !== currentId) {
    const callback = globalDropdownCallbacks.get(globalActiveDropdownId);
    if (callback) {
      callback();
    }
  }
  // Don't set globalActiveDropdownId here - let the calling function handle it
};

// Function to register a dropdown
const registerDropdown = (id, closeCallback) => {
  globalDropdownCallbacks.set(id, closeCallback);
};

// Function to unregister a dropdown
const unregisterDropdown = (id) => {
  globalDropdownCallbacks.delete(id);
  if (globalActiveDropdownId === id) {
    globalActiveDropdownId = null;
  }
};

MoreOptions.propTypes = {
  creatorInfo: PropTypes.object,
  threadInfo: PropTypes.object,
  currentUser: PropTypes.object,
  postInfo: PropTypes.object,
  setShowModal: PropTypes.func,
  setModalData: PropTypes.func,
  handleShare: PropTypes.func,
  onTranslationComplete: PropTypes.func,
  translationData: PropTypes.object,
};

export default function MoreOptions({
  creatorInfo,
  threadInfo,
  currentUser,
  postInfo,
  setShowModal,
  setModalData,
  handleShare,
  onTranslationComplete,
  translationData,
}) {
  const { t } = useTranslation();
  const { isAuthenticated, user, socket } = AuthConsumer();
  const [postSaved, setPostSaved] = useState(currentUser?.saved);
  const [userRole, setUserRole] = useState(null);
  const [isTranslatingToMultiple, setIsTranslatingToMultiple] = useState(false);
  const [multiLanguageTranslations, setMultiLanguageTranslations] = useState(null);
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const myRef = useRef();
  const [expand, setExpand] = useState(false);
  const [popupPosition, setPopupPosition] = useState({ top: 0, left: 0 });
  const [isBlockingCreator, setIsBlockingCreator] = useState(false);
  const [isBoosting, setIsBoosting] = useState(false);
  const [isBoosted, setIsBoosted] = useState(false);
  const [isBlockedByCreator, setIsBlockedByCreator] = useState(false);
  const [dailyBoostsRemaining, setDailyBoostsRemaining] = useState(null);
  const [dailyBoostsLimit, setDailyBoostsLimit] = useState(5);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteNonce, setDeleteNonce] = useState(null);

  // Generate unique ID for this dropdown
  const dropdownId = useMemo(() => `dropdown-${postInfo?.id || Math.random()}`, [postInfo?.id]);

  // Initialize real-time coin updates
  const { refreshBalance, getDailyBoostInfo } = useRealtimeCoins();
  
  // Initialize real-time settings updates with smart translate stats
  const { 
    translationStats, 
    refreshTranslationStats,
    blockedUsers,
    fetchBlockedUsers,
    refreshBlockedUsers
  } = useRealtimeSettings();

  // Check boost status when component mounts
  useEffect(() => {
    if (postInfo?.is_boosted !== undefined) {
      setIsBoosted(postInfo.is_boosted);
    }
  }, [postInfo?.is_boosted, postInfo?.id]);

  // Click outside handler
  const handleClickOutside = useCallback(() => {
    if (expand) {
      setExpand(false);
      if (globalActiveDropdownId === dropdownId) {
        globalActiveDropdownId = null;
      }
    }
  }, [expand, dropdownId]);

  // Register click outside handler
  useClickOutside(myRef, handleClickOutside);



  // Memoize expensive computations
  const isPostCreator = user?.username === creatorInfo?.user_name;
  const isOwnPost = isPostCreator;
  
  // Check if we're on a post page (URL contains /post/)
  const isOnPostPage = useMemo(() => {
    return location.pathname.includes('/post/');
  }, [location.pathname]);

  // Close dropdown function
  const closeDropdown = useCallback(() => {
    setExpand(false);
    if (globalActiveDropdownId === dropdownId) {
      globalActiveDropdownId = null;
    }
  }, [dropdownId]);

  // Update dropdown position when scrolling or resizing
  useEffect(() => {
    if (expand && myRef.current) {
      const updatePosition = () => {
        const rect = myRef.current.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const dropdownHeight = 200;
        const dropdownWidth = 192; // Updated width
        
        let top, left;
        
        // Recalculate position based on current button position
        if (rect.bottom + dropdownHeight <= viewportHeight) {
          top = rect.bottom + 4;
          left = rect.left;
        } else if (rect.top - dropdownHeight >= 0) {
          top = rect.top - dropdownHeight - 4;
          left = rect.left;
        } else {
          top = rect.bottom + 4;
          left = rect.left;
        }
        
        setPopupPosition({ top, left });
      };
      
      // Update position on scroll and resize
      window.addEventListener('scroll', updatePosition, { passive: true });
      window.addEventListener('resize', updatePosition, { passive: true });
      
      return () => {
        window.removeEventListener('scroll', updatePosition);
        window.removeEventListener('resize', updatePosition);
      };
    }
  }, [expand]);

  // Register and cleanup dropdown
  useEffect(() => {
    const closeCallback = () => {
      setExpand(false);
    };
    
    registerDropdown(dropdownId, closeCallback);
    
    return () => {
      unregisterDropdown(dropdownId);
      // Ensure this dropdown is closed when unmounting
      if (expand) {
        setExpand(false);
      }
    };
  }, [dropdownId, expand]);

  // Close dropdown when navigating
  useEffect(() => {
    const handleRouteChange = () => {
      closeDropdown();
    };

    // Listen for route changes
    window.addEventListener('popstate', handleRouteChange);
    return () => {
      window.removeEventListener('popstate', handleRouteChange);
    };
  }, [closeDropdown]);

  // Reposition dropdown on scroll if it's open
  useEffect(() => {
    if (expand) {
      let scrollTimeout;
      
      const handleScroll = () => {
        // Debounce scroll events for better performance
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
          // Reposition the dropdown when scrolling
          if (myRef.current) {
            const rect = myRef.current.getBoundingClientRect();
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;
            const dropdownWidth = 160;
            const dropdownHeight = 200;
            
            const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
            const scrollY = window.pageYOffset || document.documentElement.scrollTop;
            
            // Use the same positioning logic as handleExpand
            let top, left;
            
            // Try to position below the button first
            if (rect.bottom + dropdownHeight <= viewportHeight) {
              // Position below the button
              top = rect.bottom + 4;
              left = rect.left;
            } else if (rect.top - dropdownHeight >= 0) {
              // Position above the button
              top = rect.top - dropdownHeight - 4;
              left = rect.left;
            } else {
              // Fallback: position below but adjust if it goes off-screen
              top = rect.bottom + 4;
              left = rect.left;
              
              // Adjust if dropdown goes off the right edge
              if (left + dropdownWidth > viewportWidth) {
                left = viewportWidth - dropdownWidth - 4;
              }
              
              // Adjust if dropdown goes off the left edge
              if (left < 4) {
                left = 4;
              }
            }
            
            const documentTop = top + scrollY;
            const documentLeft = left + scrollX;
            
            setPopupPosition({ 
              top: documentTop, 
              left: documentLeft 
            });
          }
        }, 16); // ~60fps debounce
      };

      const handleResize = () => {
        // Reposition the dropdown when window is resized
        handleScroll();
      };

      window.addEventListener('scroll', handleScroll, { passive: true });
      window.addEventListener('resize', handleResize, { passive: true });
      
      return () => {
        clearTimeout(scrollTimeout);
        window.removeEventListener('scroll', handleScroll);
        window.removeEventListener('resize', handleResize);
      };
    }
  }, [expand]);

  // Calculate popup position when expanding
  const handleExpand = () => {
    // Set this dropdown as active first, then close others
    globalActiveDropdownId = dropdownId;
    closeOtherDropdowns(dropdownId);
    
    if (myRef.current) {
      const rect = myRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const dropdownWidth = 192; // Updated width of the dropdown
      const dropdownHeight = 200; // Estimated height of the dropdown
      
      // Calculate position relative to the button's current position
      let top, left;
      
      // Always try to position below the button first
      if (rect.bottom + dropdownHeight <= viewportHeight) {
        // Position below the button
        top = rect.bottom + 4;
        left = rect.left;
      } else if (rect.top - dropdownHeight >= 0) {
        // Position above the button if not enough space below
        top = rect.top - dropdownHeight - 4;
        left = rect.left;
      } else {
        // Fallback: position below but adjust if it goes off-screen
        top = rect.bottom + 4;
        left = rect.left;
        
        // Adjust if dropdown goes off the right edge
        if (left + dropdownWidth > viewportWidth) {
          left = viewportWidth - dropdownWidth - 4;
        }
        
        // Adjust if dropdown goes off the left edge
        if (left < 4) {
          left = 4;
        }
      }
      
      // For fixed positioning, use viewport coordinates directly
      // No need to add scroll position since getBoundingClientRect() already gives viewport-relative coordinates
      setPopupPosition({ 
        top: top, 
        left: left 
      });
    }
    setExpand(true);
  };

  // Check if current page should disable thread APIs
  const disableThreadApis = shouldDisableThreadApis(location.pathname);

  // Fetch user's role for this specific subthread
  useEffect(() => {
    if (isAuthenticated && threadInfo?.thread_id && !disableThreadApis) {
      // Fetch detailed role info for this specific subthread
      axios.get(`/api/thread/${threadInfo.thread_id}`)
        .then((res) => {
          if (res.data.threadData) {
            // Set the role based on currentUserRole or currentUserRoles
            const roleData = res.data.threadData;
            if (roleData.currentUserRole) {
              setUserRole({ slug: roleData.currentUserRole });
            } else if (roleData.currentUserRoles && roleData.currentUserRoles.length > 0) {
              // Use the highest priority role (admin takes precedence)
              const highestRole = roleData.currentUserRoles.includes('admin') ? 'admin' : 'mod';
              setUserRole({ slug: highestRole });
            }
          }
        })
        .catch((error) => {
          // Failed to fetch user role
        });
    }
  }, [isAuthenticated, threadInfo?.thread_id, disableThreadApis]);

  // Fetch daily boost information
  useEffect(() => {
    if (isAuthenticated && user) {
      getDailyBoostInfo()
        .then((data) => {
          if (data) {
            setDailyBoostsRemaining(data.daily_boosts_remaining);
            setDailyBoostsLimit(data.daily_boosts_limit);
          }
        })
        .catch((error) => {
          // Failed to fetch daily boost info
          // Set default values if API call fails
          setDailyBoostsRemaining(5);
          setDailyBoostsLimit(5);
        });
    }
  }, [isAuthenticated, user, getDailyBoostInfo]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchBlockedUsers();
    }
  }, [isAuthenticated, fetchBlockedUsers]);

  useEffect(() => {
    if (creatorInfo && user) {
      setIsBlockingCreator(blockedUsers.includes(creatorInfo.username));
      // Check if creator has blocked current user (requires API or socket event, assuming not implemented yet)
      // For now, set false
      setIsBlockedByCreator(false);
    }
  }, [blockedUsers, creatorInfo, user]);

  // Check if post is boosted
  useEffect(() => {
    if (postInfo?.is_boosted) {
      setIsBoosted(true);
    } else {
      setIsBoosted(false);
    }
  }, [postInfo?.is_boosted]);

  // Listen for post boost events to update local state
  useEffect(() => {
    if (!socket || !postInfo?.id) {
      return;
    }

    // Check if socket is connected
    if (!socket.connected) {
      return;
    }

    const handlePostBoosted = (data) => {
      try {
  
        if (data.post_id === postInfo.id) {
          setIsBoosted(true);
          // Update the post info to reflect the boost
          if (postInfo) {
            postInfo.is_boosted = true;
          }
          
          // Also update React Query cache for instant visual feedback
          // This ensures the post shows as boosted immediately for all users
          // Get all possible sorting and duration combinations
          const sortOptions = ['top', 'hot', 'new'];
          const durationOptions = ['day', 'week', 'month', 'year', 'alltime'];
          
          const postQueryKeys = [
            ['posts', 'all'],
            ['posts', 'popular'],
            ['posts', 'home'],
            ['post', postInfo.id]
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
          if (postInfo.subthread_id) {
            postQueryKeys.push(['posts', 'thread', postInfo.subthread_id]);
            sortOptions.forEach(sortBy => {
              durationOptions.forEach(duration => {
                postQueryKeys.push(['posts', 'thread', postInfo.subthread_id, sortBy, duration]);
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
                    Array.isArray(page) ? page.map(post => 
                      post.id === postInfo.id || post.post_info?.id === postInfo.id
                        ? { ...post, is_boosted: true }
                        : post
                    ) : page
                  )
                };
              } else if (Array.isArray(oldData)) {
                // Handle simple array structure
                return oldData.map(post => 
                  post.id === postInfo.id || post.post_info?.id === postInfo.id
                    ? { ...post, is_boosted: true }
                    : post
                );
              } else if (oldData.id === postInfo.id || oldData.post_info?.id === postInfo.id) {
                // Handle single post structure
                return { ...oldData, is_boosted: true };
              }
              return oldData;
            });
          });
        }
      } catch (error) {
        // Error handling post boost event
      }
    };

    // Listen for daily boost updates
    const handleDailyBoostUpdated = (event) => {
      try {
        const { dailyBoostsRemaining } = event.detail;
        setDailyBoostsRemaining(dailyBoostsRemaining);
      } catch (error) {
        // Error handling daily boost update event
      }
    };

    // Listen for post deletion
    const handlePostDeleted = (data) => {
      if (data.postId === postInfo.id) {
        // Remove post from UI immediately using silent updates instead of invalidation
        // This prevents losing user drafts while still updating the UI
        queryClient.setQueryData({ queryKey: ["posts"] }, (oldData) => {
          if (!oldData) return oldData;
          
          // Filter out the deleted post from all post lists
          const filterDeletedPost = (post) => {
            return post.post_info?.id !== data.postId && post.id !== data.postId;
          };
          
          if (oldData.pages) {
            // Handle infinite query structure
            return {
              ...oldData,
              pages: oldData.pages.map(page => 
                Array.isArray(page) ? page.filter(filterDeletedPost) : page
              )
            };
          } else if (Array.isArray(oldData)) {
            // Handle simple array structure
            return oldData.filter(filterDeletedPost);
          }
          
          return oldData;
        });
        
        // Update saved posts list
        queryClient.setQueryData({ queryKey: ["saved"] }, (oldData) => {
          if (!oldData) return oldData;
          
          const filterDeletedPost = (post) => {
            return post.post_info?.id !== data.postId && post.id !== data.postId;
          };
          
          if (oldData.pages) {
            return {
              ...oldData,
              pages: oldData.pages.map(page => 
                Array.isArray(page) ? page.filter(filterDeletedPost) : page
              )
            };
          } else if (Array.isArray(oldData)) {
            return oldData.filter(filterDeletedPost);
          }
          
          return oldData;
        });
      }
    };

    try {
      socket.on('post_boosted', handlePostBoosted);
      socket.on('post_deleted', handlePostDeleted);
      window.addEventListener('dailyBoostUpdated', handleDailyBoostUpdated);
    } catch (error) {
      // Error setting up socket listeners
    }

    return () => {
      try {
        if (socket && socket.connected) {
          socket.off('post_boosted', handlePostBoosted);
          socket.off('post_deleted', handlePostDeleted);
        }
        window.removeEventListener('dailyBoostUpdated', handleDailyBoostUpdated);
      } catch (error) {
        // Error cleaning up socket listeners
      }
    };
  }, [socket, postInfo?.id, postInfo, queryClient]);

  // Check if user has mod/admin role in THIS specific subthread
  const hasModeratorRole = useMemo(() => {
    return userRole?.slug === 'admin' || userRole?.slug === 'mod';
  }, [userRole?.slug]);
  
  const canDelete = useMemo(() => {
    return hasModeratorRole || isOwnPost;
  }, [hasModeratorRole, isOwnPost]);
  
  // Check if user can block (only if they have moderator role or are not blocking themselves)
  const canBlock = useMemo(() => {
    return hasModeratorRole || (!isOwnPost && isAuthenticated);
  }, [hasModeratorRole, isOwnPost, isAuthenticated]);

  const handleDelete = useCallback(async () => {
    if (isAuthenticated && deleteNonce) {
      setShowDeleteConfirm(false);
      setIsDeleting(true);
      try {
        await axios.delete(`/api/post/${postInfo?.id}`, {
          headers: {
            'X-Delete-Nonce': deleteNonce
          }
        });
        
        // Emit real-time update to remove post from UI immediately
        if (socket && socket.connected) {
          socket.emit('post_deleted', {
            postId: postInfo?.id,
            deletedBy: user?.username
          });
        }
        
        if (location.pathname.includes("post")) {
          return navigate(-1);
        }
        
        // Emit immediate real-time update for instant UI feedback
        if (socket) {
          socket.emit('post_deleted', {
            post_id: postInfo?.id,
            subthread_id: threadInfo?.thread_id,
            deleted_by: user?.username
          });
        }
        
        // Use silent updates instead of invalidation to preserve user drafts
        queryClient.setQueryData({ queryKey: ["posts"] }, (oldData) => {
          if (!oldData) return oldData;
          
          const filterDeletedPost = (post) => {
            return post.post_info?.id !== postInfo?.id && post.id !== postInfo?.id;
          };
          
          if (oldData.pages) {
            return {
              ...oldData,
              pages: oldData.pages.map(page => 
                Array.isArray(page) ? page.filter(filterDeletedPost) : page
              )
            };
          } else if (Array.isArray(oldData)) {
            return oldData.filter(filterDeletedPost);
          }
          
          return oldData;
        });
        
        queryClient.setQueryData({ queryKey: ["saved"] }, (oldData) => {
          if (!oldData) return oldData;
          
          const filterDeletedPost = (post) => {
            return post.post_info?.id !== postInfo?.id && post.id !== postInfo?.id;
          };
          
          if (oldData.pages) {
            return {
              ...oldData,
              pages: oldData.pages.map(page => 
                Array.isArray(page) ? page.filter(filterDeletedPost) : page
              )
            };
          } else if (Array.isArray(oldData)) {
            return oldData.filter(filterDeletedPost);
          }
          
          return oldData;
        });
        
        // Show brief success indicator before closing
        setTimeout(() => {
          closeDropdown();
        }, 300); // Brief delay to show success state
      } catch (error) {
        toast.error(error.response?.data?.message || t('posts.deleteFailed'));
      } finally {
        setIsDeleting(false);
        // closeDropdown() is now called in the success block with a delay
      }
    } else {
      toast.error(t('alerts.mustBeLoggedInToDelete'));
      closeDropdown();
    }
  }, [isAuthenticated, postInfo?.id, location.pathname, navigate, queryClient, t, closeDropdown, socket, user?.username]);

  async function handleSaved() {
    if (!isAuthenticated) {
      return toast.error(t('alerts.mustBeLoggedInToSave'));
    }
    if (postSaved) {
      await axios.delete(`/api/posts/saved/${postInfo?.id}`);
      setPostSaved(false);
    } else {
      await axios.put(`/api/posts/saved/${postInfo?.id}`);
      setPostSaved(true);
    }
    // Only invalidate saved posts list - this is necessary for saved posts functionality
    // This doesn't affect user drafts in other areas
    queryClient.invalidateQueries({ queryKey: ["saved"] });
    closeDropdown();
  }

  function handleEdit() {
    setShowModal(true);
    setModalData(<NewPost isEdit={true} postInfo={postInfo} setShowModal={setShowModal} threadInfo={threadInfo} />);
    closeDropdown();
  }

  async function handleTranslateIt() {
    if (!isAuthenticated) {
      return toast.error(t('alerts.youNeedToBeLoggedIn'));
    }

    setIsTranslatingToMultiple(true);
    try {
      const response = await axios.post(`/api/translate/post/${postInfo?.id}/translate-it`);
      setMultiLanguageTranslations(response.data);
      
      // Update translation stats
      refreshTranslationStats();
      
      // Call parent callback with translation data
      if (onTranslationComplete) {
        onTranslationComplete(response.data);
      }
      
      toast.success(t('translation.translationCompleted'));
    } catch (error) {
      toast.error(error.response?.data?.message || t('translation.translationFailed'));
    } finally {
      setIsTranslatingToMultiple(false);
      closeDropdown();
    }
  }

  async function handleBlockUser() {
    if (!isAuthenticated) {
      return toast.error(t('alerts.youNeedToBeLoggedIn'));
    }

    try {
      await axios.post(`/api/user/block/${creatorInfo.username}`);
      setIsBlockingCreator(true);
      toast.success(t('blocking.userBlocked'));
      
      // Refresh blocked users list
      await refreshBlockedUsers();
    } catch (error) {
      toast.error(t('blocking.blockFailed'));
    }
    closeDropdown();
  }

  async function handleUnblockUser() {
    if (!isAuthenticated) {
      return toast.error(t('alerts.youNeedToBeLoggedIn'));
    }

    try {
      await axios.delete(`/api/user/block/${creatorInfo.username}`);
      setIsBlockingCreator(false);
      toast.success(t('blocking.userUnblocked'));
      
      // Refresh blocked users list
      await refreshBlockedUsers();
    } catch (error) {
      toast.error(t('blocking.unblockFailed'));
    }
    closeDropdown();
  }

  async function handleBoostPost() {
    if (!isAuthenticated) {
      toast.error(t('alerts.youNeedToBeLoggedIn'));
      return;
    }

    if (isBoosted) {
      return toast.error(t('posts.alreadyBoosted'));
    }

    if (isBoosting) {
      return; // Prevent multiple boost attempts
    }

    if (dailyBoostsRemaining === 0) {
      return toast.error(t('posts.dailyBoostLimitReached'));
    }

    // Check coin balance before attempting to boost
    const boostCost = 1200; // Should match backend boost_cost
    
    if ((user?.wallet?.coin_balance || 0) < boostCost) {
      return toast.error(t('posts.insufficientCoins', {
        required: boostCost,
        current: user?.wallet?.coin_balance || 0
      }));
    }

    setIsBoosting(true);
    
    try {
      const response = await axios.post('/api/coins/posts/boost', {
        post_id: postInfo.id
      });

      if (response.data.success) {
        toast.success(t('posts.postBoosted'));
        setIsBoosted(true);
        
        // Update daily boosts remaining
        if (dailyBoostsRemaining !== null) {
          setDailyBoostsRemaining(dailyBoostsRemaining - 1);
        }
        
        // Don't call refreshBalance here - the balance is already updated via socket event
        // The handlePostBoost function in useRealtimeCoins already updates the balance
        // This prevents unnecessary API calls
        
        // INSTANT VISUAL UPDATE: Update React Query cache immediately
        // This ensures the post shows as boosted without waiting for socket events
        queryClient.setQueryData(['posts'], (oldData) => {
          if (!oldData) return oldData;
          
          if (oldData.pages) {
            // Handle infinite query structure
            return {
              ...oldData,
              pages: oldData.pages.map(page => 
                Array.isArray(page) ? page.map(post => 
                  post.id === postInfo.id || post.post_info?.id === postInfo.id
                    ? { ...post, is_boosted: true }
                    : post
                ) : page
              )
            };
          } else if (Array.isArray(oldData)) {
            // Handle simple array structure
            return oldData.map(post => 
              post.id === postInfo.id || post.post_info?.id === postInfo.id
                ? { ...post, is_boosted: true }
                : post
            );
          }
          return oldData;
        });
        
        // Update all possible post query keys for comprehensive coverage
        // Get all possible sorting and duration combinations
        const sortOptions = ['top', 'hot', 'new'];
        const durationOptions = ['day', 'week', 'month', 'year', 'alltime'];
        
        const postQueryKeys = [
          ['posts', 'all'],
          ['posts', 'popular'],
          ['posts', 'home'],
          ['post', postInfo.id]
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
        if (postInfo.subthread_id) {
          postQueryKeys.push(['posts', 'thread', postInfo.subthread_id]);
          sortOptions.forEach(sortBy => {
            durationOptions.forEach(duration => {
              postQueryKeys.push(['posts', 'thread', postInfo.subthread_id, sortBy, duration]);
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
                  Array.isArray(page) ? page.map(post => 
                    post.id === postInfo.id || post.post_info?.id === postInfo.id
                      ? { ...post, is_boosted: true }
                      : post
                  ) : page
                )
              };
            } else if (Array.isArray(oldData)) {
              // Handle simple array structure
              return oldData.map(post => 
                post.id === postInfo.id || post.post_info?.id === postInfo.id
                  ? { ...post, is_boosted: true }
                  : post
              );
            } else if (oldData.id === postInfo.id || oldData.post_info?.id === postInfo.id) {
              // Handle single post structure
              return { ...oldData, is_boosted: true };
            }
            return oldData;
          });
        });
        
        // Emit custom event for other components
        const event = new CustomEvent('postBoosted', {
          detail: {
            postId: postInfo.id,
            newBalance: response.data.boost?.new_balance || 0,
            transactionType: 'post_boost',
            cost: boostCost
          }
        });
        window.dispatchEvent(event);
      }
    } catch (error) {
      let errorMessage = t('posts.boostFailed');
      
      if (error.response?.data?.message) {
        const serverError = error.response.data.message;
        
        if (serverError.includes("Only the post creator can boost")) {
          errorMessage = t('posts.onlyCreatorCanBoost');
        } else if (serverError.includes("already boosted")) {
          errorMessage = t('posts.alreadyBoosted');
          setIsBoosted(true); // Update local state
        } else if (serverError.includes("cooldown")) {
          errorMessage = t('posts.boostCooldown');
        } else if (serverError.includes("Daily boost limit reached")) {
          errorMessage = t('posts.dailyBoostLimitReached');
          // Use cached daily boost info instead of making new API call
          try {
            const dailyInfo = await getDailyBoostInfo();
            if (dailyInfo) {
              setDailyBoostsRemaining(dailyInfo.daily_boosts_remaining);
            }
          } catch (refreshError) {
            // Failed to refresh daily boost info
          }
        }
      }
      
      toast.error(errorMessage);
    } finally {
      setIsBoosting(false);
    }
  }

  if (isBlockedByCreator) {
    return (
      <div className="p-4 text-center text-red-600 font-semibold">
        {t('blocking.blockedByUser')}
      </div>
    );
  }

  if (isBlockingCreator) {
    return (
      <div className="p-4 text-center text-red-600 font-semibold">
        {t('blocking.blockingUser')}
      </div>
    );
  }

  return (
    <>
      <button 
        ref={myRef} 
        className="flex flex-row items-center w-full cursor-pointer focus:outline-none focus:ring-2 focus:ring-theme-blue focus:ring-opacity-50"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          e.nativeEvent.stopImmediatePropagation();
          handleExpand();
        }}
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onTouchStart={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onTouchEnd={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onPointerDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onPointerUp={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        aria-label={t('common.more')}
        aria-expanded={expand}
        aria-haspopup="true"
        type="button"
        tabIndex={0}
        style={{ 
          pointerEvents: 'auto',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          MozUserSelect: 'none',
          msUserSelect: 'none',
          touchAction: 'manipulation'
        }}
        data-testid="more-options-button"
      >
        <span className="inline-flex w-7 flex-shrink-0 items-center justify-start">
          <Svg className="w-5 h-5 text-gray-700 dark:text-theme-dark-text" type="more" />
        </span>
        <span className="flex-1 text-base text-left text-theme-text-primary dark:text-theme-dark-text">
          {t('common.more')}
        </span>
      </button>
      {expand && globalActiveDropdownId === dropdownId && createPortal(
        <ul 
          className="fixed z-[99999] w-48 bg-white dark:bg-theme-dark-card rounded-md shadow-lg border border-gray-200 dark:border-theme-dark-border py-2 list-none"
          style={{ 
            top: popupPosition.top, 
            left: popupPosition.left,
            minWidth: '192px',
            position: 'fixed',
            zIndex: 99999,
            pointerEvents: 'auto',
            userSelect: 'none',
            WebkitUserSelect: 'none',
            MozUserSelect: 'none',
            msUserSelect: 'none',
            transform: 'translateZ(0)', // Force hardware acceleration
            willChange: 'transform', // Optimize for animations
            touchAction: 'manipulation'
          }}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            e.nativeEvent.stopImmediatePropagation();
          }}
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onTouchStart={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onTouchEnd={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onPointerUp={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          role="menu"
          aria-label={t('common.more')}
          data-testid="more-options-dropdown"
        >
            {isAuthenticated && (
              <li 
                className="block w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-white cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700" 
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  e.nativeEvent.stopImmediatePropagation();
                  handleSaved();
                }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onTouchStart={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                style={{ 
                  userSelect: 'none',
                  WebkitUserSelect: 'none',
                  MozUserSelect: 'none',
                  msUserSelect: 'none',
                  touchAction: 'manipulation'
                }}
                data-testid="save-post-option"
              >
                {postSaved ? t('posts.unsave') : t('posts.save')}
              </li>
            )}
            {isAuthenticated && isOnPostPage && (
              <li
                className={`block w-full text-left px-4 py-2.5 text-sm ${
                  (multiLanguageTranslations || translationData)
                    ? 'text-gray-400 dark:text-gray-500 cursor-not-allowed' 
                    : 'text-green-600 dark:text-green-400 cursor-pointer'
                }`}
                onClick={(multiLanguageTranslations || translationData) ? null : handleTranslateIt}
                disabled={isTranslatingToMultiple || multiLanguageTranslations || translationData}>
                {isTranslatingToMultiple ? t('translation.translatingToMultipleLanguages') : t('translation.translateIt')}
              </li>
            )}
            {isAuthenticated && isOwnPost && (
              <>
                {/* Daily boost info display */}
                <li className="block w-full text-left px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex justify-between items-center">
                    <span>{t('posts.dailyBoostsRemaining')}:</span>
                    <span className={`font-semibold ${dailyBoostsRemaining === 0 ? 'text-red-500' : 'text-green-500'}`}>
                      {dailyBoostsRemaining || 0}/{dailyBoostsLimit}
                    </span>
                  </div>
                  {dailyBoostsRemaining === 0 && (
                    <div className="text-red-400 text-xs mt-1">
                      {t('posts.dailyBoostLimitReached')}
                    </div>
                  )}
                </li>
                
                {/* Boost button */}
                <li
                  className={`block w-full text-left px-4 py-2.5 text-sm ${
                    isBoosted || dailyBoostsRemaining === 0
                      ? 'text-gray-400 dark:text-gray-500 cursor-not-allowed'
                      : 'text-yellow-600 dark:text-yellow-400 cursor-pointer'
                  }`}
                  onClick={isBoosted || dailyBoostsRemaining === 0 ? null : handleBoostPost}
                  disabled={isBoosting || isBoosted || dailyBoostsRemaining === 0}>
                  {isBoosting ? t('posts.boosting') : isBoosted ? (
                    <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                      <Svg type="check" className="w-4 h-4" />
                      {t('posts.boosted')} ✅
                    </span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <Svg type="coin" className="w-4 h-4" />
                      {dailyBoostsRemaining === 0 ? (
                        <span className="text-red-500">
                          {t('posts.dailyBoostLimitReached')} ({dailyBoostsLimit}/{dailyBoostsLimit})
                        </span>
                      ) : (
                        <>
                          {t('posts.boostPost')} (1200 {t('coins.coins')})
                        </>
                      )}
                    </span>
                  )}
                </li>
              </>
            )}
            {canDelete && (
              <li
                className={`block w-full text-left px-4 py-2.5 text-sm ${
                  isDeleting 
                    ? 'text-gray-400 dark:text-gray-500 cursor-not-allowed' 
                    : 'text-red-500 dark:text-red-400 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  e.nativeEvent.stopImmediatePropagation();
                  if (!isDeleting) {
                    // Generate a unique nonce for this delete action
                    setDeleteNonce(Date.now().toString() + Math.random().toString(36).substr(2, 9));
                    setShowDeleteConfirm(true);
                    closeDropdown();
                  }
                }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onTouchStart={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                style={{ 
                  userSelect: 'none',
                  WebkitUserSelect: 'none',
                  MozUserSelect: 'none',
                  msUserSelect: 'none',
                  touchAction: 'manipulation'
                }}
                disabled={isDeleting}
                data-testid="delete-post-option"
                role="menuitem"
                aria-label={t('common.delete')}
              >
                {isDeleting ? (
                  <span className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-500"></div>
                    {t('posts.deleting')}...
                  </span>
                ) : (
                  t('common.delete')
                )}
              </li>
            )}
            {isAuthenticated && isOwnPost && (
              <li
                onClick={handleEdit}
                className="block w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-white cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700">
                {t('common.edit')}
              </li>
            )}
            {canBlock && !isBlockingCreator && !isOwnPost && (
              <li
                className="block w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-white cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                onClick={handleBlockUser}>
                {t('posts.blockUser')}
              </li>
            )}
            {canBlock && isBlockingCreator && !isOwnPost && (
              <li
                className="block w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-white cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                onClick={handleUnblockUser}>
                {t('posts.unblockUser')}
              </li>
            )}
            <li
              className="block w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-white cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
              onClick={() => {
                handleShare().then(() => setExpand(false));
              }}>
              {t('posts.share')}
            </li>
          </ul>,
          document.body
        )}
        
        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-[999999]">
            <div className="bg-white dark:bg-theme-dark-card p-6 rounded-md shadow-lg max-w-sm w-full mx-4">
              <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
                {t('posts.confirmDelete')}
              </h3>
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                {t('posts.deleteWarning')}
              </p>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                  disabled={isDeleting}
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={handleDelete}
                  className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors disabled:opacity-50"
                  disabled={isDeleting}
                >
                  {isDeleting ? (
                    <span className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      {t('posts.deleting')}...
                    </span>
                  ) : (
                    t('common.delete')
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
    </>
  );
}

