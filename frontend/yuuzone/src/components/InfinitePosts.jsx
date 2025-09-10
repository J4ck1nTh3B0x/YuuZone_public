import { useInfiniteQuery } from "@tanstack/react-query";
import axios from "axios";
import { AnimatePresence, motion } from "framer-motion";
import PropTypes from "prop-types";
import { useEffect, useRef, useCallback, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { handleBanError } from "../utils/banHandler";
import SafePost from "./SafePost";
import Loader from "./Loader";
import PostErrorBoundary from "./PostErrorBoundary";
import useOptimizedRealtimeUpdates from "../hooks/useOptimizedRealtimeUpdates";
import useRealtimePosts from "../hooks/useRealtimePosts";
import { deduplicateInfiniteQuery } from "../utils/postDeduplication";
import { toast } from 'react-toastify';
import Spinner from "./Spinner";
import NewPostsNotification from "./NewPostsNotification";

InfinitePostsLayout.propTypes = {
  linkUrl: PropTypes.string,
  apiQueryKey: PropTypes.string,
  forSaved: PropTypes.bool,
  enabled: PropTypes.bool,
};

export default function InfinitePostsLayout({ linkUrl, apiQueryKey, forSaved = false, enabled = true }) {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const sortBy = searchParams.get("sortBy") || "top";
  const duration = searchParams.get("duration") || "alltime";
  const [showNewPostsNotification, setShowNewPostsNotification] = useState(false);
  const [newPostsCount, setNewPostsCount] = useState(0);

  // Extract subthread ID from linkUrl for real-time updates
  const subthreadId = linkUrl.includes('thread/') ? linkUrl.split('thread/')[1] : null;
  const scrollPositionRef = useRef(0);
  const isScrollingRef = useRef(false);

  // Initialize optimized real-time updates
  const { updateStats } = useOptimizedRealtimeUpdates({
    batchDelay: 250,
    maxBatchSize: 6,
    throttleDelay: 75,
    enableOptimisticUpdates: true,
    preserveScrollPosition: true
  });

  // Initialize real-time posts with auto polling
  const { startPolling, stopPolling, pollingStats } = useRealtimePosts({
    enablePolling: true,
    pollingInterval: 30000, // 30 seconds
    enableOptimisticUpdates: true,
    preserveScrollPosition: true
  });

  // Handle new posts notification
  const handleViewNewPosts = useCallback(() => {
    setShowNewPostsNotification(false);
    setNewPostsCount(0);
    // Scroll to top to show new posts
    window.scrollTo(0, 0);
  }, []);

  const handleDismissNotification = useCallback(() => {
    setShowNewPostsNotification(false);
    setNewPostsCount(0);
  }, []);
  
  const { 
    data, 
    isFetching, 
    isFetchingNextPage,
    hasNextPage, 
    fetchNextPage, 
    error,
    isLoading,
    isError 
  } = useInfiniteQuery({
    queryKey: ["posts", apiQueryKey, sortBy, duration],
    queryFn: async ({ pageParam = 0 }) => {
      try {
        const response = await axios
          .get(`/api/${linkUrl}?limit=${20}&offset=${pageParam * 20}&sortby=${sortBy}&duration=${duration}`)
          .then((data) => data.data);
        
        // Deduplicate the response data before returning
        return Array.isArray(response) ? response.filter((post, index, arr) => {
          const postId = post?.post_info?.id || post?.id;
          return postId && arr.findIndex(p => (p?.post_info?.id || p?.id) === postId) === index;
        }) : response;
      } catch (error) {
        if (handleBanError(error, navigate)) {
          return [];
        }
        throw error;
      }
    },
    enabled: enabled,
    getNextPageParam: (lastPage, pages) => {
      if (lastPage.length < 20) return undefined;
      return pages.length;
    },
    staleTime: 10 * 60 * 1000, // 10 minutes - prevent unnecessary refetches
    gcTime: 15 * 60 * 1000, // 15 minutes - keep data longer
    refetchOnWindowFocus: false, // Prevent refetch when window regains focus
    refetchOnMount: false, // Prevent refetch when component mounts
    refetchOnReconnect: false, // Prevent refetch on network reconnect
    select: (data) => {
      // Apply deduplication to the entire query result across ALL pages
      if (!data || !data.pages) return data;
      
      const seenIds = new Set();
      const deduplicatedPages = data.pages.map(page => {
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
        ...data,
        pages: deduplicatedPages
      };
    }
  });

  // Optimized scroll handling with scroll position preservation
  const handleScroll = useCallback((event) => {
    if (isScrollingRef.current) return;
    
    const { scrollTop, scrollHeight, clientHeight } = event.target.scrollingElement;
    scrollPositionRef.current = scrollTop;
    
    // Check if we need to load more posts
    if (scrollHeight - scrollTop <= clientHeight * 2 && hasNextPage && !isFetchingNextPage) {
      isScrollingRef.current = true;
      
      // Preserve scroll position before fetching
      const currentScrollTop = scrollTop;
      
      fetchNextPage().finally(() => {
        // Restore scroll position after fetch
        requestAnimationFrame(() => {
          window.scrollTo(0, currentScrollTop);
          isScrollingRef.current = false;
        });
      });
    }
  }, [fetchNextPage, isFetchingNextPage, hasNextPage]);

  useEffect(() => {
    let scrollTimeout;
    
    const onScroll = (event) => {
      // Enhanced debounce with scroll position tracking
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        handleScroll(event);
      }, 150); // Increased debounce for smoother experience
    };
    
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      clearTimeout(scrollTimeout);
    };
  }, [handleScroll]);

  // Start auto polling for new posts
  useEffect(() => {
    if (!enabled) return;

    // Determine feed type based on apiQueryKey
    let feedType = 'home';
    let subthreadId = null;

    if (apiQueryKey.includes('thread/')) {
      feedType = 'thread';
      subthreadId = apiQueryKey.split('thread/')[1];
    } else if (apiQueryKey === 'all') {
      feedType = 'all';
    } else if (apiQueryKey === 'popular') {
      feedType = 'popular';
    }

    // Start polling for this specific feed
    startPolling(feedType, subthreadId);

    // Cleanup polling when component unmounts or feed changes
    return () => {
      stopPolling();
    };
    }, [enabled, apiQueryKey, startPolling, stopPolling]);

  // Monitor polling stats and show notifications for new posts
  useEffect(() => {
    if (pollingStats.newPostsFound > 0) {
      setNewPostsCount(pollingStats.newPostsFound);
      setShowNewPostsNotification(true);
      
      // Auto-hide notification after 10 seconds
      const timer = setTimeout(() => {
        setShowNewPostsNotification(false);
        setNewPostsCount(0);
      }, 10000);
      
      return () => clearTimeout(timer);
    }
  }, [pollingStats.newPostsFound]);
  
  function handleDurationChange(newDuration) {
    searchParams.set("duration", newDuration);
    setSearchParams(searchParams, { replace: true });
  }
  
  function handleSortByChange(newSortBy) {
    searchParams.set("sortBy", newSortBy);
    setSearchParams(searchParams, { replace: true });
  }

  // Error handling
  if (isError) {
    toast.error(t('alerts.failedToLoadPosts'));
    return (
      <div className="flex flex-col items-center justify-center flex-1 min-h-[40vh]">
        <svg className="w-16 h-16 text-theme-error mb-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12A9 9 0 1 1 3 12a9 9 0 0 1 18 0Z" />
        </svg>
        <p className="text-lg text-theme-error dark:text-theme-error">{t('alerts.failedToLoadPosts')}</p>
      </div>
    );
  }

  // Initial loading state - only show spinner if no data exists
  if (isLoading || !data || !data.pages || !Array.isArray(data.pages) || typeof data.pages[0] === 'undefined') {
    return (
      <div className="flex flex-col items-center justify-center flex-1 min-h-[40vh]">
        <Spinner />
      </div>
    );
  }

  return (
    <div
      id="main-content"
      className="flex w-full flex-col flex-1 space-y-2 rounded-lg bg-theme-light-gray2 md:bg-transparent dark: dark:text-theme-dark-text">
      
      {/* New Posts Notification */}
      <NewPostsNotification
        isVisible={showNewPostsNotification}
        newPostsCount={newPostsCount}
        onViewNewPosts={handleViewNewPosts}
        onDismiss={handleDismissNotification}
      />
      {!forSaved && (
        <header className="flex justify-between items-center">
          <div className="flex items-center space-x-2 md:hidden">
            <span>{t('common.sortBy')}</span>
            <select
              name="sort"
              id="sort"
              className="p-2 px-4 bg-transparent rounded-md md:bg-theme-light-gray2 dark:bg-theme-dark-bg dark:text-theme-dark-text"
              onChange={(e) => handleSortByChange(e.target.value)}
              value={sortBy}>
              <option value="top">{t('common.top')}</option>
              <option value="hot">{t('common.hot')}</option>
              <option value="new">{t('common.new')}</option>
            </select>
          </div>
          <div className="flex items-center space-x-2 md:hidden">
            <span>{t('common.of')}</span>
            <select
              name="duration"
              id="duration"
              className="p-2 px-4 bg-transparent rounded-md md:bg-theme-light-gray2 dark:bg-theme-dark-bg dark:text-theme-dark-text"
              onChange={(e) => handleDurationChange(e.target.value)}
              value={duration}>
              <option value="day">{t('common.day')}</option>
              <option value="week">{t('common.week')}</option>
              <option value="month">{t('common.month')}</option>
              <option value="year">{t('common.year')}</option>
              <option value="alltime">{t('common.allTime')}</option>
            </select>
          </div>
          <div className="tab-filters flex space-x-2 list-none md:flex bg-theme-less-white dark:bg-theme-dark-card dark:text-theme-dark-text">
            <button
              className={`p-2 hover:bg-theme-pale-gray dark:hover:bg-theme-dark-hover rounded-md px-4 text-lg cursor-pointer bg-transparent dark:bg-theme-dark-card text-theme-text-primary dark:text-theme-dark-text-secondary ${duration === "day" && "bg-theme-pale-gray"
                }`}
              onClick={() => handleDurationChange("day")}>
              {t('common.today')}
            </button>
            <button
              className={`p-2 hover:bg-theme-pale-gray dark:hover:bg-theme-dark-hover rounded-md px-4 text-lg cursor-pointer bg-transparent dark:bg-theme-dark-card text-theme-text-primary dark:text-theme-dark-text-secondary ${duration === "week" && "bg-theme-pale-gray"
                }`}
              onClick={() => handleDurationChange("week")}>
              {t('common.week')}
            </button>
            <button
              className={`p-2 hover:bg-theme-pale-gray dark:hover:bg-theme-dark-hover rounded-md px-4 text-lg cursor-pointer bg-transparent dark:bg-theme-dark-card text-theme-text-primary dark:text-theme-dark-text-secondary ${duration === "month" && "bg-theme-pale-gray"
                }`}
              onClick={() => handleDurationChange("month")}>
              {t('common.month')}
            </button>
            <button
              className={`p-2 hover:bg-theme-pale-gray dark:hover:bg-theme-dark-hover rounded-md px-4 text-lg cursor-pointer bg-transparent dark:bg-theme-dark-card text-theme-text-primary dark:text-theme-dark-text-secondary ${duration === "alltime" && "bg-theme-pale-gray"
                }`}
              onClick={() => handleDurationChange("alltime")}>
              {t('common.allTime')}
            </button>
          </div>
          <div className="tab-filters flex space-x-5 list-none md:flex bg-theme-less-white dark:bg-theme-dark-card dark:text-theme-dark-text">
            <button
              className={`p-2 hover:bg-theme-pale-gray dark:hover:bg-theme-dark-hover rounded-md px-4 text-lg cursor-pointer bg-transparent dark:bg-theme-dark-card text-theme-text-primary dark:text-theme-dark-text-secondary ${sortBy === "hot" && "bg-theme-pale-gray"
                }`}
              onClick={() => handleSortByChange("hot")}>
              {t('common.hot')}
            </button>
            <button
              className={`p-2 hover:bg-theme-pale-gray dark:hover:bg-theme-dark-hover rounded-md px-4 text-lg cursor-pointer bg-transparent dark:bg-theme-dark-card text-theme-text-primary dark:text-theme-dark-text-secondary ${sortBy === "new" && "bg-theme-pale-gray"
                }`}
              onClick={() => handleSortByChange("new")}>
              {t('common.new')}
            </button>
            <button
              className={`p-2 hover:bg-theme-pale-gray dark:hover:bg-theme-dark-hover rounded-md px-4 text-lg cursor-pointer bg-transparent dark:bg-theme-dark-card text-theme-text-primary dark:text-theme-dark-text-secondary ${sortBy === "top" && "bg-theme-pale-gray"
                }`}
              onClick={() => handleSortByChange("top")}>
              {t('common.top')}
            </button>
          </div>
        </header>
      )}

      {/* Posts content - always show if data exists */}
      {data?.pages[0].length === 0 ? (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
          <p className="p-5 bg-transparent dark:bg-theme-dark-bg rounded-lg border-2 md:text-base hover:shadow-sm border-theme-gray-blue dark:border-theme-dark-border text-center">
            {t('alerts.noPostsWithFilter')}<br className="md-hidden" />
            {t('alerts.beFirstToAddOne')}
          </p>
        </motion.div>
      ) : (
        <motion.div className="flex flex-col">
          {data?.pages.map((pageData, pageIndex) => (
            <motion.ul 
              className="flex flex-col" 
              key={pageIndex}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              <AnimatePresence initial={pageIndex === 0}>
                {pageData?.map((post, idx) => (
                  <motion.div
                    key={post.id}
                    className={`post-container ${
                      idx !== 0 || pageIndex !== 0 ? "mt-2 md:mt-3" : ""
                    }`}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ 
                      duration: 0.3,
                      delay: idx * 0.05 // Stagger animation
                    }}
                    layout
                  >
                    <SafePost post={post} />
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.ul>
          ))}
          
          {/* Loading indicator for next page - only show when fetching next page */}
          {isFetchingNextPage && hasNextPage && (
            <div className="flex justify-center py-4">
              <Spinner />
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
