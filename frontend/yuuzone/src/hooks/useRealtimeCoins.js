import { useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import AuthConsumer from '../components/AuthContext';
import axios from 'axios';
import { useQueryClient } from '@tanstack/react-query';

// Global flag to prevent multiple polling instances
let globalPollingActive = false;
let globalSocketListenersActive = false;
let globalEventListeners = new Set();
let globalBalanceFetched = false; // Track if we've already fetched the balance
let globalBalanceCache = null; // Cache the balance to avoid unnecessary API calls
let globalBalanceTimestamp = 0; // Track when balance was last fetched

// Global rate limiting for API calls
let lastApiCallTime = 0;
const MIN_API_CALL_INTERVAL = 5000; // Minimum 5 seconds between API calls
const BALANCE_CACHE_DURATION = 300000; // 5 minutes cache duration (increased from 1 minute)

// Global coin data cache to reduce API calls
const coinDataCache = {
  packages: { data: null, timestamp: 0, duration: 600000 }, // 10 minutes (increased from 5)
  avatars: { data: null, timestamp: 0, duration: 600000 }, // 10 minutes (increased from 5)
  ownedAvatars: { data: null, timestamp: 0, duration: 300000 }, // 5 minutes (increased from 1)
  dailyBoostInfo: { data: null, timestamp: 0, duration: 600000 }, // 10 minutes (increased from 5)
};

// Helper function to check if cache is valid
const isCacheValid = (cacheKey) => {
  const cache = coinDataCache[cacheKey];
  if (!cache || !cache.data) return false;
  return (Date.now() - cache.timestamp) < cache.duration;
};

// Helper function to update cache
const updateCache = (cacheKey, data) => {
  coinDataCache[cacheKey] = {
    data,
    timestamp: Date.now(),
    duration: coinDataCache[cacheKey]?.duration || 300000
  };
};

/**
 * Custom hook for handling real-time coin balance updates with smart polling
 * Listens for coin-related events and updates the balance accordingly
 * Only polls when necessary - stops once balance is fetched
 */
export default function useRealtimeCoins() {
  const { socket, user } = AuthConsumer();
  const location = useLocation();
  const pollingIntervalRef = useRef(null);
  const lastBalanceRef = useRef(null);
  const balanceFetchedRef = useRef(false);
  const queryClient = useQueryClient();

  // Check if current page should disable polling
  const shouldDisablePolling = useCallback(() => {
    const pathname = location.pathname;
    
    // Pages where polling should be disabled
    const disabledPages = [
      '/forgot-password', // Forgot password
      '/verify-email', // Email verification
      '/password-reset', // Password reset
      '/account-deletion', // Account deletion
      '/banned', // Banned pages
    ];
    
    // Check if current path matches any disabled page
    return disabledPages.some(page => pathname.startsWith(page));
  }, [location.pathname]);

  // Check if current page needs fast coin updates
  const needsFastCoinUpdates = useCallback(() => {
    const pathname = location.pathname;
    
    // Pages that need fast and accurate coin updates
    const fastUpdatePages = [
      '/coin-shop', // Coin shop - needs real-time balance and package updates
    ];
    
    return fastUpdatePages.some(page => pathname.startsWith(page));
  }, [location.pathname]);

  // Handle coin balance updates
  const handleCoinBalanceUpdate = useCallback((data) => {
    const { new_balance, transaction_type, amount } = data;
    
    // Update global cache
    globalBalanceCache = new_balance;
    globalBalanceTimestamp = Date.now();
    
    // Update our local balance reference
    lastBalanceRef.current = new_balance;
    balanceFetchedRef.current = true;
    
    // Emit a custom event that components can listen to
    const event = new CustomEvent('coinBalanceUpdated', {
      detail: {
        newBalance: new_balance,
        transactionType: transaction_type,
        amount: amount
      }
    });
    window.dispatchEvent(event);
  }, []);

  // Handle coin purchase completion
  const handleCoinPurchaseComplete = useCallback((data) => {
    const { new_balance, package_name, coin_amount } = data;
    
    // Update global cache
    globalBalanceCache = new_balance;
    globalBalanceTimestamp = Date.now();
    
    // Update our local balance reference
    lastBalanceRef.current = new_balance;
    balanceFetchedRef.current = true;
    
    const event = new CustomEvent('coinBalanceUpdated', {
      detail: {
        newBalance: new_balance,
        transactionType: 'purchase',
        amount: coin_amount,
        packageName: package_name
      }
    });
    window.dispatchEvent(event);
  }, []);

  // Handle avatar purchase
  const handleAvatarPurchase = useCallback((data) => {
    const { new_balance, avatar_name, cost } = data;
    
    // Update global cache
    globalBalanceCache = new_balance;
    globalBalanceTimestamp = Date.now();
    
    // Update our local balance reference
    lastBalanceRef.current = new_balance;
    balanceFetchedRef.current = true;
    
    const event = new CustomEvent('coinBalanceUpdated', {
      detail: {
        newBalance: new_balance,
        transactionType: 'avatar_purchase',
        amount: -cost,
        avatarName: avatar_name
      }
    });
    window.dispatchEvent(event);
  }, []);

  // Handle post boost
  const handlePostBoost = useCallback((data) => {
    const { new_balance, post_title, cost, post_id, daily_boosts_remaining } = data;
    
    // Update global cache
    globalBalanceCache = new_balance;
    globalBalanceTimestamp = Date.now();
    
    // Update our local balance reference
    lastBalanceRef.current = new_balance;
    balanceFetchedRef.current = true;
    
    // Update the post data in React Query cache to mark it as boosted
    if (post_id) {
      // Update all possible post query keys for comprehensive coverage
      const postQueryKeys = [
        ['posts', 'all'],
        ['posts', 'popular'],
        ['posts', 'home'],
        ['post', post_id]
      ];
      
      postQueryKeys.forEach(queryKey => {
        queryClient.setQueryData(queryKey, (oldData) => {
          if (!oldData) return oldData;
          
          // Helper function to deduplicate posts by ID
          const deduplicatePosts = (posts) => {
            const seenIds = new Set();
            return posts.filter(post => {
              const postId = post?.post_info?.id || post?.id;
              if (!postId || seenIds.has(postId)) {
                return false;
              }
              seenIds.add(postId);
              return true;
            });
          };
          
          if (oldData.pages) {
            // Handle infinite query structure
            return {
              ...oldData,
              pages: oldData.pages.map(page => 
                Array.isArray(page) ? deduplicatePosts(page.map(post => 
                  post.id === post_id || post.post_info?.id === post_id
                    ? { ...post, is_boosted: true }
                    : post
                )) : page
              )
            };
          } else if (Array.isArray(oldData)) {
            // Handle simple array structure - deduplicate after updating
            const updatedData = oldData.map(post => 
              post.id === post_id || post.post_info?.id === post_id
                ? { ...post, is_boosted: true }
                : post
            );
            return deduplicatePosts(updatedData);
          } else if (oldData.id === post_id || oldData.post_info?.id === post_id) {
            // Handle single post structure
            return { ...oldData, is_boosted: true };
          }
          return oldData;
        });
      });
      
      // Also update any thread-specific queries if we can determine the thread
      // This will be handled by the individual Post components via socket events
      
      // Don't invalidate queries - we want to keep the updated data in cache
      // queryClient.invalidateQueries(['posts']);
    }
    
    // Emit custom event for daily boost updates
    if (daily_boosts_remaining !== undefined) {
      const event = new CustomEvent('dailyBoostUpdated', {
        detail: {
          dailyBoostsRemaining: daily_boosts_remaining
        }
      });
      window.dispatchEvent(event);
    }
    
    const event = new CustomEvent('coinBalanceUpdated', {
      detail: {
        newBalance: new_balance,
        transactionType: 'post_boost',
        amount: -cost,
        postTitle: post_title
      }
    });
    window.dispatchEvent(event);
  }, [queryClient]);

  // Handle tip transactions
  const handleTipTransaction = useCallback((data) => {
    const { new_balance, tip_amount, recipient_username, is_sender } = data;
    
    // Update our local balance reference
    lastBalanceRef.current = new_balance;
    balanceFetchedRef.current = true;
    
    const event = new CustomEvent('coinBalanceUpdated', {
      detail: {
        newBalance: new_balance,
        transactionType: is_sender ? 'tip_sent' : 'tip_received',
        amount: is_sender ? -tip_amount : tip_amount,
        recipientUsername: recipient_username
      }
    });
    window.dispatchEvent(event);
  }, []);

  // Smart polling - only when necessary
  const startPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }

    // Don't start polling on disabled pages
    if (shouldDisablePolling()) {
      return;
    }

    // Only start polling if socket is not available AND we haven't fetched balance yet
    if (socket) {
      return;
    }

    // If we already have the balance, don't start polling
    if (globalBalanceFetched || balanceFetchedRef.current) {
      return;
    }

    // Prevent multiple global polling instances
    if (globalPollingActive) {
      return;
    }

    // Rate limiting check
    const now = Date.now();
    if (now - lastApiCallTime < MIN_API_CALL_INTERVAL) {
      return;
    }

    globalPollingActive = true;
    
    // Only poll until we get the balance, then stop
    pollingIntervalRef.current = setInterval(async () => {
      if (!user?.id) return;

      // Check if we already have a recent cached balance
      const now = Date.now();
      if (globalBalanceCache !== null && (now - globalBalanceTimestamp) < BALANCE_CACHE_DURATION) {
        // Use cached balance instead of making API call
        const cachedBalance = globalBalanceCache;
        lastBalanceRef.current = cachedBalance;
        balanceFetchedRef.current = true;
        globalBalanceFetched = true;
        stopPolling();
        
        const event = new CustomEvent('coinBalanceUpdated', {
          detail: {
            newBalance: cachedBalance,
            transactionType: 'cached_initial_fetch',
            amount: 0,
            timestamp: new Date().toISOString(),
            isBalanceChange: false
          }
        });
        window.dispatchEvent(event);
        return;
      }

      try {
        // Rate limiting check
        const now = Date.now();
        if (now - lastApiCallTime < MIN_API_CALL_INTERVAL) {
          return;
        }
        lastApiCallTime = now;
        
        const response = await axios.get('/api/coins/wallet');
        if (response.data.success) {
          const newBalance = response.data.balance;
          
          // Update global cache
          globalBalanceCache = newBalance;
          globalBalanceTimestamp = now;
          
          // Update our local balance reference
          lastBalanceRef.current = newBalance;
          balanceFetchedRef.current = true;
          globalBalanceFetched = true;
          
          // Stop polling since we now have the balance
          stopPolling();
          
          // Emit initial balance event
          const event = new CustomEvent('coinBalanceUpdated', {
            detail: {
              newBalance: newBalance,
              transactionType: 'initial_fetch',
              amount: 0,
              timestamp: new Date().toISOString(),
              isBalanceChange: false
            }
          });
          window.dispatchEvent(event);
        }
      } catch (error) {
        // Don't log rate limiting errors as warnings
        if (error.response?.status === 429) {
          // Increase polling interval temporarily when rate limited
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = setInterval(async () => {
              // Retry logic here
            }, 300000); // Wait 5 minutes before retrying (increased from 1 minute)
          }
        }
      }
    }, 120000); // Poll every 2 minutes until we get balance (increased from 30 seconds)
  }, [user?.id, socket, shouldDisablePolling, needsFastCoinUpdates]);

  // Stop polling
  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
      globalPollingActive = false;

    }
  }, []);

  // Function to manually refresh balance (for balance-affecting actions)
  const refreshBalance = useCallback(async () => {
    if (!user?.id) return;
    
    // Don't refresh on disabled pages
    if (shouldDisablePolling()) {
      return;
    }
    
    // On fast update pages, bypass rate limiting for immediate updates
    const bypassRateLimit = needsFastCoinUpdates();
    
    // Check if we have a recent cached balance
    const now = Date.now();
    if (globalBalanceCache !== null && (now - globalBalanceTimestamp) < BALANCE_CACHE_DURATION) {
      // Use cached balance if it's recent enough
      const cachedBalance = globalBalanceCache;
      
      // Only emit events if balance actually changed
      if (lastBalanceRef.current !== null && lastBalanceRef.current !== cachedBalance) {
        const event = new CustomEvent('coinBalanceUpdated', {
          detail: {
            newBalance: cachedBalance,
            transactionType: 'cached_refresh',
            amount: cachedBalance - lastBalanceRef.current,
            timestamp: new Date().toISOString(),
            isBalanceChange: true
          }
        });
        window.dispatchEvent(event);
      }
      
      // Update the last balance reference
      lastBalanceRef.current = cachedBalance;
      balanceFetchedRef.current = true;
      return;
    }
    
    try {
      // Rate limiting check (bypass on fast update pages)
      const now = Date.now();
      if (!bypassRateLimit && now - lastApiCallTime < MIN_API_CALL_INTERVAL) {
        return;
      }
      lastApiCallTime = now;
      
      const response = await axios.get('/api/coins/wallet');
      if (response.data.success) {
        const newBalance = response.data.balance;
        
        // Update global cache
        globalBalanceCache = newBalance;
        globalBalanceTimestamp = now;
        
        // Only emit events if balance actually changed
        if (lastBalanceRef.current !== null && lastBalanceRef.current !== newBalance) {
          const event = new CustomEvent('coinBalanceUpdated', {
            detail: {
              newBalance: newBalance,
              transactionType: 'manual_refresh',
              amount: newBalance - lastBalanceRef.current,
              timestamp: new Date().toISOString(),
              isBalanceChange: true
            }
          });
          window.dispatchEvent(event);
          
          // Also emit a specific event for balance changes
          const balanceChangeEvent = new CustomEvent('coinBalanceChanged', {
            detail: {
              newBalance: newBalance,
              oldBalance: lastBalanceRef.current,
              change: newBalance - lastBalanceRef.current,
              timestamp: new Date().toISOString()
            }
          });
          window.dispatchEvent(balanceChangeEvent);
        }
        
        // Update the last balance reference
        lastBalanceRef.current = newBalance;
        balanceFetchedRef.current = true;
        globalBalanceFetched = true;
      }
    } catch (error) {
      // Handle rate limiting silently
    }
  }, [user?.id, shouldDisablePolling, needsFastCoinUpdates]);

  // Get daily boost information with caching
  const getDailyBoostInfo = useCallback(async () => {
    // Don't fetch on disabled pages
    if (shouldDisablePolling()) {
      return coinDataCache.dailyBoostInfo.data; // Return cached data if available
    }
    
    // On fast update pages, always fetch fresh data (ignore cache)
    if (needsFastCoinUpdates()) {
      try {
        const response = await axios.get('/api/coins/posts/boost/daily-info');
        if (response.data.success) {
          updateCache('dailyBoostInfo', response.data.data);
          return response.data.data;
        }
        return null;
      } catch (error) {
        return coinDataCache.dailyBoostInfo.data; // Fallback to cached data
      }
    }
    
    // Check if we have recent cached daily boost info
    if (isCacheValid('dailyBoostInfo')) {
      return coinDataCache.dailyBoostInfo.data;
    }
    
    try {
      // Rate limiting check
      const now = Date.now();
      if (now - lastApiCallTime < MIN_API_CALL_INTERVAL) {
        return coinDataCache.dailyBoostInfo.data; // Return cached data if rate limited
      }
      lastApiCallTime = now;
      
      const response = await axios.get('/api/coins/posts/boost/daily-info');
      if (response.data.success) {
        // Cache the response
        updateCache('dailyBoostInfo', response.data.data);
        return response.data.data;
      }
      return null;
    } catch (error) {
      return null;
    }
  }, [shouldDisablePolling, needsFastCoinUpdates]);

  useEffect(() => {
    if (!user?.id) return;

    // Don't initialize or poll on disabled pages
    if (shouldDisablePolling()) {
      return;
    }

    // Initialize the last balance reference if not set
    if (lastBalanceRef.current === null && !balanceFetchedRef.current) {
      // Check if we have a recent cached balance first
      const now = Date.now();
      if (globalBalanceCache !== null && (now - globalBalanceTimestamp) < BALANCE_CACHE_DURATION) {
        // Use cached balance instead of making API call
        lastBalanceRef.current = globalBalanceCache;
        balanceFetchedRef.current = true;
        globalBalanceFetched = true;
      } else {
        // Only fetch if we don't have a recent cache and rate limiting allows
        const now = Date.now();
        if (now - lastApiCallTime >= MIN_API_CALL_INTERVAL) {
          lastApiCallTime = now;
          axios.get('/api/coins/wallet')
            .then(response => {
              if (response.data.success) {
                const newBalance = response.data.balance;
                lastBalanceRef.current = newBalance;
                balanceFetchedRef.current = true;
                globalBalanceFetched = true;
                
                // Update global cache
                globalBalanceCache = newBalance;
                globalBalanceTimestamp = now;
              }
            })
            .catch(error => {
              // Handle errors silently
              lastBalanceRef.current = 0;
              balanceFetchedRef.current = false;
            });
        }
      }
    }

    // Start polling as fallback ONLY if we don't have balance yet
    if (!globalPollingActive && !balanceFetchedRef.current && !globalBalanceFetched) {
      startPolling();
    }

    // Set up socket event listeners if socket is available (only once globally)
    if (socket && !globalSocketListenersActive) {
      globalSocketListenersActive = true;
      
      socket.on('coin_balance_updated', handleCoinBalanceUpdate);
      socket.on('coin_purchase_complete', handleCoinPurchaseComplete);
      socket.on('avatar_purchased', handleAvatarPurchase);
      socket.on('post_boosted', handlePostBoost);
      socket.on('tip_transaction', handleTipTransaction);
    }

    // Add this component to the global event listeners set
    globalEventListeners.add('active');

    return () => {
      // Remove this component from the global event listeners set
      globalEventListeners.delete('active');
      
      // Only stop polling if no other components are using it
      if (globalEventListeners.size === 0) {
        stopPolling();
        
        // Also remove socket listeners if no components are active
        if (socket && globalSocketListenersActive) {
          globalSocketListenersActive = false;
          socket.off('coin_balance_updated', handleCoinBalanceUpdate);
          socket.off('coin_purchase_complete', handleCoinPurchaseComplete);
          socket.off('avatar_purchased', handleAvatarPurchase);
          socket.off('post_boosted', handlePostBoost);
          socket.off('tip_transaction', handleTipTransaction);
        }
      }
    };
  }, [socket, user?.id, shouldDisablePolling, needsFastCoinUpdates, handleCoinBalanceUpdate, handleCoinPurchaseComplete, handleAvatarPurchase, handlePostBoost, handleTipTransaction, startPolling, stopPolling]);

  // Stop polling when navigating to disabled pages
  useEffect(() => {
    if (shouldDisablePolling()) {
      stopPolling();
    }
  }, [shouldDisablePolling, needsFastCoinUpdates, stopPolling]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // This cleanup is now handled in the main useEffect
    };
  }, []);

  // Function to clear global cache (useful for logout or when cache becomes stale)
  const clearBalanceCache = useCallback(() => {
    globalBalanceCache = null;
    globalBalanceTimestamp = 0;
    globalBalanceFetched = false;
  }, []);

  // Cached function to get coin packages
  const getCoinPackages = useCallback(async () => {
    // Don't fetch on disabled pages
    if (shouldDisablePolling()) {
      return coinDataCache.packages.data; // Return cached data if available
    }
    
    // On fast update pages, always fetch fresh data (ignore cache)
    if (needsFastCoinUpdates()) {
      try {
        const response = await axios.get('/api/coins/packages');
        if (response.data.success) {
          updateCache('packages', response.data.packages);
          return response.data.packages;
        }
        return null;
      } catch (error) {
        return coinDataCache.packages.data; // Fallback to cached data
      }
    }
    
    // Normal caching behavior for other pages
    if (isCacheValid('packages')) {
      return coinDataCache.packages.data;
    }
    
    try {
      // Rate limiting check
      const now = Date.now();
      if (now - lastApiCallTime < MIN_API_CALL_INTERVAL) {
        return coinDataCache.packages.data; // Return cached data if rate limited
      }
      lastApiCallTime = now;
      
      const response = await axios.get('/api/coins/packages');
      if (response.data.success) {
        updateCache('packages', response.data.packages);
        return response.data.packages;
      }
      return null;
    } catch (error) {
      return null;
    }
  }, [shouldDisablePolling, needsFastCoinUpdates]);

  // Cached function to get avatars
  const getAvatars = useCallback(async () => {
    // Don't fetch on disabled pages
    if (shouldDisablePolling()) {
      return coinDataCache.avatars.data; // Return cached data if available
    }
    
    // On fast update pages, always fetch fresh data (ignore cache)
    if (needsFastCoinUpdates()) {
      try {
        const response = await axios.get('/api/coins/avatars');
        if (response.data.success) {
          updateCache('avatars', response.data.avatars);
          return response.data.avatars;
        }
        return null;
      } catch (error) {
        return coinDataCache.avatars.data; // Fallback to cached data
      }
    }
    
    // Normal caching behavior for other pages
    if (isCacheValid('avatars')) {
      return coinDataCache.avatars.data;
    }
    
    try {
      // Rate limiting check
      const now = Date.now();
      if (now - lastApiCallTime < MIN_API_CALL_INTERVAL) {
        return coinDataCache.avatars.data; // Return cached data if rate limited
      }
      lastApiCallTime = now;
      
      const response = await axios.get('/api/coins/avatars');
      if (response.data.success) {
        updateCache('avatars', response.data.avatars);
        return response.data.avatars;
      }
      return null;
    } catch (error) {
      return null;
    }
  }, [shouldDisablePolling, needsFastCoinUpdates]);

  // Cached function to get owned avatars
  const getOwnedAvatars = useCallback(async () => {
    // Don't fetch on disabled pages
    if (shouldDisablePolling()) {
      return coinDataCache.ownedAvatars.data; // Return cached data if available
    }
    
    // On fast update pages, always fetch fresh data (ignore cache)
    if (needsFastCoinUpdates()) {
      try {
        const response = await axios.get('/api/coins/avatars/owned');
        if (response.data.success) {
          updateCache('ownedAvatars', response.data.avatars);
          return response.data.avatars;
        }
        return null;
      } catch (error) {
        return coinDataCache.ownedAvatars.data; // Fallback to cached data
      }
    }
    
    // Normal caching behavior for other pages
    if (isCacheValid('ownedAvatars')) {
      return coinDataCache.ownedAvatars.data;
    }
    
    try {
      // Rate limiting check
      const now = Date.now();
      if (now - lastApiCallTime < MIN_API_CALL_INTERVAL) {
        return coinDataCache.ownedAvatars.data; // Return cached data if rate limited
      }
      lastApiCallTime = now;
      
      const response = await axios.get('/api/coins/avatars/owned');
      if (response.data.success) {
        updateCache('ownedAvatars', response.data.avatars);
        return response.data.avatars;
      }
      return null;
    } catch (error) {
      return null;
    }
  }, [shouldDisablePolling, needsFastCoinUpdates]);

  // Function to clear all coin data cache
  const clearAllCoinCache = useCallback(() => {
    Object.keys(coinDataCache).forEach(key => {
      coinDataCache[key] = { data: null, timestamp: 0, duration: coinDataCache[key].duration };
    });
    clearBalanceCache();
  }, []);

  // Return functions to emit coin events (if needed)
  const emitCoinUpdate = useCallback((updateData) => {
    if (!socket) return;
    
    socket.emit('coin_update', updateData);
  }, [socket]);

  return {
    emitCoinUpdate,
    startPolling,
    stopPolling,
    refreshBalance, // Export this for manual balance refresh
    getDailyBoostInfo, // Export daily boost info function
    clearBalanceCache, // Export cache clearing function
    getCoinPackages, // Export cached coin packages function
    getAvatars, // Export cached avatars function
    getOwnedAvatars, // Export cached owned avatars function
    clearAllCoinCache // Export function to clear all coin cache
  };
} 