import { useEffect, useCallback, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import AuthConsumer from '../components/AuthContext';
import axios from 'axios';

// Global flag to prevent multiple translate stats fetching instances
let globalTranslateStatsFetched = false;
let globalTranslateStatsData = null;

/**
 * Custom hook for handling real-time translation stats updates only
 * This hook is specifically designed for components that only need translation stats
 * and don't need blocked users or other settings functionality
 */
export default function useRealtimeTranslationStats() {
  const { socket, user } = AuthConsumer();
  const queryClient = useQueryClient();
  const [translationStats, setTranslationStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const statsFetchedRef = useRef(false);

  // Smart translate stats fetching - only fetch once
  const fetchTranslationStats = useCallback(async (force = false) => {
    // If we already have stats and not forcing, return cached data
    if (globalTranslateStatsData && !force && !statsFetchedRef.current) {
      setTranslationStats(globalTranslateStatsData);
      statsFetchedRef.current = true;
      return globalTranslateStatsData;
    }

    // If already fetched in this component, don't fetch again
    if (statsFetchedRef.current && !force) {
      return translationStats;
    }

    setLoadingStats(true);
    try {
      const response = await axios.get("/api/translate/stats");
      const statsData = response.data;
      
      // Update global state
      globalTranslateStatsData = statsData;
      globalTranslateStatsFetched = true;
      statsFetchedRef.current = true;
      
      // Update local state
      setTranslationStats(statsData);
      
      // Cache in React Query for other components
      queryClient.setQueryData(['translation/stats'], statsData);
      

      return statsData;
    } catch (error) {
      // Failed to fetch translation stats
      return null;
    } finally {
      setLoadingStats(false);
    }
  }, [queryClient, translationStats]);

  // Function to manually refresh translate stats (for translation actions)
  const refreshTranslationStats = useCallback(async () => {

    const stats = await fetchTranslationStats(true); // Force refresh
    return stats;
  }, [fetchTranslationStats]);

  // Handle translation stats updates
  const handleTranslationStatsUpdated = useCallback((data) => {
    const { used_count, limit, reset_date } = data;
    
    // Update global state
    globalTranslateStatsData = {
      ...globalTranslateStatsData,
      used_count: used_count || globalTranslateStatsData?.used_count,
      limit: limit || globalTranslateStatsData?.limit,
      reset_date: reset_date || globalTranslateStatsData?.reset_date
    };
    
    // Update local state if this component has fetched stats
    if (statsFetchedRef.current) {
      setTranslationStats(globalTranslateStatsData);
    }
    
    // Update React Query cache
    queryClient.setQueryData(['translation/stats'], globalTranslateStatsData);
    
    // Invalidate translation history if needed
    queryClient.invalidateQueries(['translation/history']);
    
    
  }, [queryClient]);

  // Set up socket event listeners for translation stats only
  useEffect(() => {
    if (!socket || !user) return;

    // Listen for translation stats events only
    socket.on('translation_stats_updated', handleTranslationStatsUpdated);

    // Join user's settings room for real-time updates
    socket.emit('join_room', `user_settings_${user.id}`);

    return () => {
      socket.off('translation_stats_updated', handleTranslationStatsUpdated);
      socket.emit('leave_room', `user_settings_${user.id}`);
    };
  }, [socket, user, handleTranslationStatsUpdated]);

  return {
    // Return translate stats functions only
    translationStats,
    loadingStats,
    fetchTranslationStats,
    refreshTranslationStats
  };
} 