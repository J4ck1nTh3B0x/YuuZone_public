import { memo, useCallback, useEffect, useMemo } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import PropTypes from "prop-types";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { handleBanError } from "../utils/banHandler";
import PostOptimized from "./PostOptimized";
import Loader from "./Loader";
import PostErrorBoundary from "./PostErrorBoundary";
import useRealtimePost from "../hooks/useRealtimePost";
import useRealtimeVotes from "../hooks/useRealtimeVotes";
import { deduplicateInfiniteQuery } from "../utils/postDeduplication";
import { toast } from 'react-toastify';
import Spinner from "./Spinner";
import axios from "axios";

const InfinitePostsOptimized = memo(({ linkUrl, apiQueryKey, forSaved = false, enabled = true }) => {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const sortBy = searchParams.get("sortBy") || "top";
  const duration = searchParams.get("duration") || "alltime";

  // Extract subthread ID from linkUrl for real-time updates
  const subthreadId = useMemo(() => 
    linkUrl.includes('thread/') ? linkUrl.split('thread/')[1] : null, 
    [linkUrl]
  );

  // Initialize real-time hooks
  useRealtimePost(subthreadId);
  useRealtimeVotes(null, subthreadId);

  // Optimized query function with better error handling and deduplication
  const queryFn = useCallback(async ({ pageParam = 0 }) => {
    try {
      const response = await axios.get(
        `/api/${linkUrl}?limit=${20}&offset=${pageParam * 20}&sortby=${sortBy}&duration=${duration}`
      );
      
      // Deduplicate the response data before returning
      const data = response.data;
      return Array.isArray(data) ? data.filter((post, index, arr) => {
        const postId = post?.post_info?.id || post?.id;
        return postId && arr.findIndex(p => (p?.post_info?.id || p?.id) === postId) === index;
      }) : data;
    } catch (error) {
      if (handleBanError(error, navigate)) {
        return [];
      }
      throw error;
    }
  }, [linkUrl, sortBy, duration, navigate]);

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
    queryFn,
    enabled,
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
      // Apply deduplication to the entire query result
      return deduplicateInfiniteQuery(data);
    }
  });

  // Optimized scroll handler with better debouncing
  useEffect(() => {
    let scrollTimeout;
    let isScrolling = false;
    
    const onScroll = (event) => {
      if (isScrolling) return;
      
      isScrolling = true;
      clearTimeout(scrollTimeout);
      
      scrollTimeout = setTimeout(() => {
        const { scrollTop, scrollHeight, clientHeight } = event.target.scrollingElement;
        
        // Load more when user is 2 viewport heights away from bottom
        if (scrollHeight - scrollTop <= clientHeight * 2 && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
        
        isScrolling = false;
      }, 150); // Increased debounce time for better performance
    };
    
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      clearTimeout(scrollTimeout);
    };
  }, [fetchNextPage, isFetchingNextPage, hasNextPage]);

  // Memoized handlers
  const handleDurationChange = useCallback((newDuration) => {
    searchParams.set("duration", newDuration);
    setSearchParams(searchParams, { replace: true });
  }, [searchParams, setSearchParams]);

  const handleSortByChange = useCallback((newSortBy) => {
    searchParams.set("sortBy", newSortBy);
    setSearchParams(searchParams, { replace: true });
  }, [searchParams, setSearchParams]);

  // Error handling
  if (isError) {
    toast.error(t('alerts.failedToLoadPosts'));
    return (
      <div className="flex flex-col items-center justify-center flex-1 min-h-[40vh]">
        <svg className="w-16 h-16 text-theme-error mb-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12A9 9 0 1 1 3 12a9 9 0 0 1 18 0Z" />
        </svg>
        <p className="text-lg text-theme-error dark:text-theme-error">
          {t('alerts.failedToLoadPosts')}
        </p>
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

  // Empty state
  if (data?.pages[0].length === 0) {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 10 }} 
        animate={{ opacity: 1, y: 0 }} 
        transition={{ duration: 0.25 }}
      >
        <p className="p-5 bg-transparent dark:bg-theme-dark-bg rounded-lg border-2 md:text-base hover:shadow-sm border-theme-gray-blue dark:border-theme-dark-border text-center">
          {t('alerts.noPostsWithFilter')}<br className="md-hidden" />
          {t('alerts.beFirstToAddOne')}
        </p>
      </motion.div>
    );
  }

  return (
    <div
      id="main-content"
      className="flex w-full flex-col flex-1 space-y-2 rounded-lg bg-theme-light-gray md:bg-theme-light-gray2 dark:bg-theme-dark-bg dark:text-theme-dark-text"
    >
      {/* Filter Controls - Only render if not for saved posts */}
      {!forSaved && (
        <header className="flex justify-between items-center">
          <div className="flex items-center space-x-2 md:hidden">
            <span>{t('common.sortBy')}</span>
            <select
              name="sort"
              id="sort"
              className="p-2 px-4 bg-transparent rounded-md md:bg-theme-light-gray2 dark:bg-theme-dark-bg dark:text-theme-dark-text"
              onChange={(e) => handleSortByChange(e.target.value)}
              value={sortBy}
            >
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
              value={duration}
            >
              <option value="day">{t('common.day')}</option>
              <option value="week">{t('common.week')}</option>
              <option value="month">{t('common.month')}</option>
              <option value="year">{t('common.year')}</option>
              <option value="alltime">{t('common.allTime')}</option>
            </select>
          </div>
          
          {/* Desktop Duration Filters */}
          <div className="tab-filters flex space-x-2 list-none md:flex bg-theme-less-white dark:bg-theme-dark-card dark:text-theme-dark-text">
            {[
              { value: "day", label: t('common.today') },
              { value: "week", label: t('common.week') },
              { value: "month", label: t('common.month') },
              { value: "alltime", label: t('common.allTime') }
            ].map(({ value, label }) => (
              <button
                key={value}
                className={`p-2 hover:bg-theme-pale-gray dark:hover:bg-theme-dark-hover rounded-md px-4 text-lg cursor-pointer bg-transparent dark:bg-theme-dark-card text-theme-text-primary dark:text-theme-dark-text-secondary ${
                  duration === value ? "bg-theme-pale-gray" : ""
                }`}
                onClick={() => handleDurationChange(value)}
              >
                {label}
              </button>
            ))}
          </div>
          
          {/* Desktop Sort Filters */}
          <div className="tab-filters flex space-x-5 list-none md:flex bg-theme-less-white dark:bg-theme-dark-card dark:text-theme-dark-text">
            {[
              { value: "hot", label: t('common.hot') },
              { value: "new", label: t('common.new') },
              { value: "top", label: t('common.top') }
            ].map(({ value, label }) => (
              <button
                key={value}
                className={`p-2 hover:bg-theme-pale-gray dark:hover:bg-theme-dark-hover rounded-md px-4 text-lg cursor-pointer bg-transparent dark:bg-theme-dark-card text-theme-text-primary dark:text-theme-dark-text-secondary ${
                  sortBy === value ? "bg-theme-pale-gray" : ""
                }`}
                onClick={() => handleSortByChange(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </header>
      )}

      {/* Posts List - always show if data exists */}
      <div className="flex flex-col">
        {data?.pages.map((pageData, pageIndex) => (
          <ul className="flex flex-col" key={pageIndex}>
            <AnimatePresence initial={pageIndex === 0}>
              {pageData?.map((post, idx) => (
                <div
                  key={post.id}
                  className={`post-container ${
                    idx !== 0 || pageIndex !== 0 ? "mt-2 md:mt-3" : ""
                  }`}
                >
                  <PostErrorBoundary>
                    <PostOptimized post={post} />
                  </PostErrorBoundary>
                </div>
              ))}
            </AnimatePresence>
          </ul>
        ))}
      </div>

      {/* Loading indicator for next page - only show when fetching next page */}
      {isFetchingNextPage && hasNextPage && (
        <div className="flex justify-center py-4">
          <Spinner />
        </div>
      )}
    </div>
  );
});

InfinitePostsOptimized.propTypes = {
  linkUrl: PropTypes.string,
  apiQueryKey: PropTypes.string,
  forSaved: PropTypes.bool,
  enabled: PropTypes.bool,
};

InfinitePostsOptimized.displayName = 'InfinitePostsOptimized';

export default InfinitePostsOptimized; 