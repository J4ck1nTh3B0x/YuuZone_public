import { useEffect, useCallback, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import AuthConsumer from '../components/AuthContext';
import axios from 'axios';

// Global flag to prevent multiple translate stats fetching instances
let globalTranslateStatsFetched = false;
let globalTranslateStatsData = null;

// Global flag to prevent multiple blocked users fetching instances
let globalBlockedUsersFetched = false;
let globalBlockedUsersData = null;

/**
 * Custom hook for handling real-time settings updates
 * Handles theme changes, subscription updates, and user preference changes
 * Includes smart translate stats fetching that only fetches once
 */
export default function useRealtimeSettings() {
  const { socket, user } = AuthConsumer();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [translationStats, setTranslationStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const statsFetchedRef = useRef(false);
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [loadingBlockedUsers, setLoadingBlockedUsers] = useState(false);
  const blockedUsersFetchedRef = useRef(false);

  // Check if current page should disable blocked users and thread API calls
  const shouldDisableThreadApis = useCallback(() => {
    const pathname = location.pathname;
    
    // Pages where blocked users and thread APIs should be disabled
    const disabledPages = [
      '/profile', // My profile
      '/coin-shop', // Coin shop
      '/subscription', // Subscription
      '/settings', // Settings
      '/login', // Login
      '/register', // Signup
      '/forgot-password', // Forgot password
      '/verify-email', // Email verification
      '/password-reset', // Password reset
      '/account-deletion', // Account deletion
      '/banned', // Banned pages
    ];
    
    // Check if current path matches any disabled page
    return disabledPages.some(page => pathname.startsWith(page));
  }, [location.pathname]);

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
  }, [queryClient]);

  // Function to manually refresh translate stats (for translation actions)
  const refreshTranslationStats = useCallback(async () => {

    const stats = await fetchTranslationStats(true); // Force refresh
    return stats;
  }, [fetchTranslationStats]);

  // Smart blocked users fetching - only fetch once
  const fetchBlockedUsers = useCallback(async (force = false) => {
    // Don't fetch on disabled pages - use cache only
    if (shouldDisableThreadApis()) {
      // Return cached data if available, otherwise empty array
      if (globalBlockedUsersData) {
        setBlockedUsers(globalBlockedUsersData);
        blockedUsersFetchedRef.current = true;
        return globalBlockedUsersData;
      }
      return [];
    }

    // If we already have blocked users and not forcing, return cached data
    if (globalBlockedUsersData && !force && !blockedUsersFetchedRef.current) {
      setBlockedUsers(globalBlockedUsersData);
      blockedUsersFetchedRef.current = true;
      return globalBlockedUsersData;
    }

    // If already fetched in this component, don't fetch again
    if (blockedUsersFetchedRef.current && !force) {
      return blockedUsers;
    }

    setLoadingBlockedUsers(true);
    try {
      const response = await axios.get("/api/user/blocked");
      const blockedUsersData = response.data;
      
      // Update global state
      globalBlockedUsersData = blockedUsersData;
      globalBlockedUsersFetched = true;
      blockedUsersFetchedRef.current = true;
      
      // Update local state
      setBlockedUsers(blockedUsersData);
      
      // Cache in React Query for other components
      queryClient.setQueryData(['user/blocked'], blockedUsersData);
      

      return blockedUsersData;
    } catch (error) {
      // Failed to fetch blocked users
      return [];
    } finally {
      setLoadingBlockedUsers(false);
    }
  }, [queryClient, blockedUsers, shouldDisableThreadApis]);

  // Function to manually refresh blocked users (for block/unblock actions)
  const refreshBlockedUsers = useCallback(async () => {

    const users = await fetchBlockedUsers(true); // Force refresh
    return users;
  }, [fetchBlockedUsers]);

  // Handle theme updates
  const handleThemeUpdated = useCallback((data) => {
    const { theme, custom_theme } = data;
    
    // Update user theme data
    queryClient.setQueryData(['user'], (oldData) => {
      if (!oldData) return oldData;
      return {
        ...oldData,
        theme: theme || oldData.theme,
        custom_theme: custom_theme || oldData.custom_theme
      };
    });

    // Update theme-specific queries
    queryClient.invalidateQueries(['user/theme']);
    queryClient.invalidateQueries(['user/custom-theme']);
    
    
  }, [queryClient]);

  // Handle subscription updates
  const handleSubscriptionUpdated = useCallback((data) => {
    const { subscription_id, tier, status, expires_at } = data;
    
    // Update subscription data
    queryClient.setQueryData(['subscriptions'], (oldData) => {
      if (!oldData) return oldData;
      
      if (Array.isArray(oldData)) {
        return oldData.map(sub => 
          sub.id === subscription_id 
            ? { ...sub, tier, status, expires_at }
            : sub
        );
      }
      
      return oldData;
    });

    // Update user data with new tier info
    queryClient.setQueryData(['user'], (oldData) => {
      if (!oldData) return oldData;
      return {
        ...oldData,
        tier: tier || oldData.tier,
        subscription_status: status || oldData.subscription_status
      };
    });

    // Invalidate related queries
    queryClient.invalidateQueries(['subscriptions/user/settings-data']);
    queryClient.invalidateQueries(['subscriptions/themes/slots']);
    queryClient.invalidateQueries(['subscriptions/themes']);
    
    
  }, [queryClient]);

  // Handle custom theme updates
  const handleCustomThemeUpdated = useCallback((data) => {
    const { theme_id, action, theme_data } = data;
    
    // Update themes list
    queryClient.setQueryData(['subscriptions/themes'], (oldData) => {
      if (!oldData) return oldData;
      
      switch (action) {
        case 'created':
          return {
            ...oldData,
            themes: [theme_data, ...(oldData.themes || [])]
          };
        case 'updated':
          return {
            ...oldData,
            themes: (oldData.themes || []).map(theme => 
              theme.id === theme_id ? { ...theme, ...theme_data } : theme
            )
          };
        case 'deleted':
          return {
            ...oldData,
            themes: (oldData.themes || []).filter(theme => theme.id !== theme_id)
          };
        case 'activated':
          return {
            ...oldData,
            themes: (oldData.themes || []).map(theme => ({
              ...theme,
              is_active: theme.id === theme_id
            }))
          };
        case 'deactivated':
          return {
            ...oldData,
            themes: (oldData.themes || []).map(theme => ({
              ...theme,
              is_active: false
            }))
          };
        default:
          return oldData;
      }
    });

    // Update theme slots
    queryClient.invalidateQueries(['subscriptions/themes/slots']);
    
    
  }, [queryClient]);

  // Handle user preference updates
  const handleUserPreferenceUpdated = useCallback((data) => {
    const { preference_type, value } = data;
    
    // Update user data with new preferences
    queryClient.setQueryData(['user'], (oldData) => {
      if (!oldData) return oldData;
      return {
        ...oldData,
        [preference_type]: value
      };
    });

    // Invalidate specific preference queries
    queryClient.invalidateQueries(['user/preferences']);
    
    
  }, [queryClient]);

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

  // Handle blocked users updates
  const handleBlockedUsersUpdated = useCallback((data) => {
    const { action, username } = data;
    
    // Update global state
    if (globalBlockedUsersData) {
      switch (action) {
        case 'blocked':
          globalBlockedUsersData = [...globalBlockedUsersData, username];
          break;
        case 'unblocked':
          globalBlockedUsersData = globalBlockedUsersData.filter(u => u !== username);
          break;
        default:
          break;
      }
    }
    
    // Update local state if this component has fetched blocked users
    if (blockedUsersFetchedRef.current) {
      setBlockedUsers(globalBlockedUsersData || []);
    }
    
    // Update React Query cache
    queryClient.setQueryData(['user/blocked'], globalBlockedUsersData);
    
    
  }, [queryClient]);

  // Set up socket event listeners
  useEffect(() => {
    if (!socket || !user) return;

    // Listen for settings-related events
    socket.on('theme_updated', handleThemeUpdated);
    socket.on('subscription_updated', handleSubscriptionUpdated);
    socket.on('custom_theme_updated', handleCustomThemeUpdated);
    socket.on('user_preference_updated', handleUserPreferenceUpdated);
    socket.on('translation_stats_updated', handleTranslationStatsUpdated);
    socket.on('blocked_users_updated', handleBlockedUsersUpdated);

    // Join user's settings room for real-time updates
    socket.emit('join_room', `user_settings_${user.id}`);

    return () => {
      socket.off('theme_updated', handleThemeUpdated);
      socket.off('subscription_updated', handleSubscriptionUpdated);
      socket.off('custom_theme_updated', handleCustomThemeUpdated);
      socket.off('user_preference_updated', handleUserPreferenceUpdated);
      socket.off('translation_stats_updated', handleTranslationStatsUpdated);
      socket.off('blocked_users_updated', handleBlockedUsersUpdated);
      
      socket.emit('leave_room', `user_settings_${user.id}`);
    };
  }, [socket, user, handleThemeUpdated, handleSubscriptionUpdated, handleCustomThemeUpdated, handleUserPreferenceUpdated, handleTranslationStatsUpdated, handleBlockedUsersUpdated]);

  return {
    // Return functions that can be used to emit events if needed
    emitThemeUpdate: (themeData) => socket?.emit('update_theme', themeData),
    emitSubscriptionUpdate: (subscriptionData) => socket?.emit('update_subscription', subscriptionData),
    emitCustomThemeUpdate: (themeData) => socket?.emit('update_custom_theme', themeData),
    emitUserPreferenceUpdate: (preferenceData) => socket?.emit('update_user_preference', preferenceData),
    
    // Return translate stats functions
    translationStats,
    loadingStats,
    fetchTranslationStats,
    refreshTranslationStats,
    
    // Return blocked users functions
    blockedUsers,
    loadingBlockedUsers,
    fetchBlockedUsers,
    refreshBlockedUsers
  };
} 