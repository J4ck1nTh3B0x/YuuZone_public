import { useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import AuthConsumer from '../components/AuthContext';

/**
 * Custom hook for handling real-time purchase history updates
 * Listens for purchase-related events and updates the purchase history accordingly
 */
export default function useRealtimePurchaseHistory() {
  const { socket } = AuthConsumer();
  const queryClient = useQueryClient();

  // Handle new purchase events
  const handleNewPurchase = useCallback((data) => {
    const { purchase_type, purchase_data } = data;
    
    // Emit a custom event that the PurchaseHistory component can listen to
    const event = new CustomEvent('purchaseHistoryUpdated', {
      detail: {
        type: 'new_purchase',
        purchaseType: purchase_type,
        purchaseData: purchase_data
      }
    });
    window.dispatchEvent(event);
  }, []);

  // Handle purchase status updates
  const handlePurchaseStatusUpdate = useCallback((data) => {
    const { purchase_id, purchase_type, new_status } = data;
    
    const event = new CustomEvent('purchaseHistoryUpdated', {
      detail: {
        type: 'status_update',
        purchaseId: purchase_id,
        purchaseType: purchase_type,
        newStatus: new_status
      }
    });
    window.dispatchEvent(event);
  }, []);

  // Handle subscription purchases
  const handleSubscriptionPurchase = useCallback((data) => {
    const { tier_name, tier_slug, amount, currency, payment_status } = data;
    
    const event = new CustomEvent('purchaseHistoryUpdated', {
      detail: {
        type: 'new_purchase',
        purchaseType: 'subscription',
        purchaseData: {
          id: `sub_${Date.now()}`,
          type: 'subscription',
          tier_name,
          tier_slug,
          amount,
          currency,
          payment_status,
          created_at: new Date().toISOString(),
          description: `Subscription to ${tier_name}`
        }
      }
    });
    window.dispatchEvent(event);
  }, []);

  // Handle coin purchases
  const handleCoinPurchase = useCallback((data) => {
    const { package_name, coin_amount, amount, currency, payment_status } = data;
    
    const event = new CustomEvent('purchaseHistoryUpdated', {
      detail: {
        type: 'new_purchase',
        purchaseType: 'coin_purchase',
        purchaseData: {
          id: `coin_${Date.now()}`,
          type: 'coin_purchase',
          package_name,
          coin_amount,
          amount,
          currency,
          payment_status,
          created_at: new Date().toISOString(),
          description: `Purchased ${coin_amount} coins`
        }
      }
    });
    window.dispatchEvent(event);
  }, []);

  // Handle avatar purchases
  const handleAvatarPurchase = useCallback((data) => {
    const { avatar_name, price_coins, avatar_image } = data;
    
    const event = new CustomEvent('purchaseHistoryUpdated', {
      detail: {
        type: 'new_purchase',
        purchaseType: 'avatar_purchase',
        purchaseData: {
          id: `avatar_${Date.now()}`,
          type: 'avatar_purchase',
          avatar_name,
          price_coins,
          avatar_image,
          created_at: new Date().toISOString(),
          description: `Purchased avatar: ${avatar_name}`
        }
      }
    });
    window.dispatchEvent(event);
  }, []);

  // Handle post boosts
  const handlePostBoost = useCallback((data) => {
    const { post_id, cost } = data;
    
    // Update the post data in React Query cache to mark it as boosted
    if (post_id) {
      // Update all possible post query keys for comprehensive coverage
      // Get all possible sorting and duration combinations
      const sortOptions = ['top', 'hot', 'new'];
      const durationOptions = ['day', 'week', 'month', 'year', 'alltime'];
      
      const postQueryKeys = [
        ['posts', 'all'],
        ['posts', 'popular'],
        ['posts', 'home'],
        ['post', post_id]
      ];
      
      // Add all sorting and duration combinations for each feed type
      ['all', 'popular', 'home'].forEach(feedType => {
        sortOptions.forEach(sortBy => {
          durationOptions.forEach(duration => {
            postQueryKeys.push(['posts', feedType, sortBy, duration]);
          });
        });
      });
      
      postQueryKeys.forEach(queryKey => {
        queryClient.setQueryData(queryKey, (oldData) => {
          if (!oldData) return oldData;
          
          if (oldData.pages) {
            // Handle infinite query structure
            return {
              ...oldData,
              pages: oldData.pages.map(page => 
                Array.isArray(page) ? page.map(post => 
                  post.id === post_id || post.post_info?.id === post_id
                    ? { ...post, is_boosted: true }
                    : post
                ) : page
              )
            };
          } else if (Array.isArray(oldData)) {
            // Handle simple array structure
            return oldData.map(post => 
              post.id === post_id || post.post_info?.id === post_id
                ? { ...post, is_boosted: true }
                : post
            );
          } else if (oldData.id === post_id || oldData.post_info?.id === post_id) {
            // Handle single post structure
            return { ...oldData, is_boosted: true };
          }
          return oldData;
        });
      });
      
      // Don't invalidate queries - we want to keep the updated data in cache
      // queryClient.invalidateQueries(['posts']);
    }
    
    const event = new CustomEvent('purchaseHistoryUpdated', {
      detail: {
        type: 'new_purchase',
        purchaseType: 'post_boost',
        purchaseData: {
          id: `boost_${Date.now()}`,
          type: 'post_boost',
          post_id,
          amount: -cost,
          created_at: new Date().toISOString(),
          description: `Boosted post #${post_id}`
        }
      }
    });
    window.dispatchEvent(event);
  }, [queryClient]);

  // Handle tier purchases with coins
  const handleTierPurchase = useCallback((data) => {
    const { tier_name, tier_slug, cost } = data;
    
    const event = new CustomEvent('purchaseHistoryUpdated', {
      detail: {
        type: 'new_purchase',
        purchaseType: 'tier_purchase',
        purchaseData: {
          id: `tier_${Date.now()}`,
          type: 'tier_purchase',
          tier_name,
          tier_slug,
          amount: -cost,
          created_at: new Date().toISOString(),
          description: `Purchased tier: ${tier_name}`
        }
      }
    });
    window.dispatchEvent(event);
  }, []);

  useEffect(() => {
    if (!socket) return;

    // Set up event listeners for purchase-related events
    socket.on('new_purchase', handleNewPurchase);
    socket.on('purchase_status_updated', handlePurchaseStatusUpdate);
    socket.on('subscription_purchased', handleSubscriptionPurchase);
    socket.on('coin_purchase_complete', handleCoinPurchase);
    socket.on('avatar_purchased', handleAvatarPurchase);
    socket.on('post_boosted', handlePostBoost);
    socket.on('tier_purchased', handleTierPurchase);

    return () => {
      // Clean up event listeners
      socket.off('new_purchase', handleNewPurchase);
      socket.off('purchase_status_updated', handlePurchaseStatusUpdate);
      socket.off('subscription_purchased', handleSubscriptionPurchase);
      socket.off('coin_purchase_complete', handleCoinPurchase);
      socket.off('avatar_purchased', handleAvatarPurchase);
      socket.off('post_boosted', handlePostBoost);
      socket.off('tier_purchased', handleTierPurchase);
    };
  }, [socket, handleNewPurchase, handlePurchaseStatusUpdate, handleSubscriptionPurchase, handleCoinPurchase, handleAvatarPurchase, handlePostBoost, handleTierPurchase]);

  // Return functions to emit purchase events (if needed)
  const emitPurchaseUpdate = useCallback((updateData) => {
    if (!socket) return;
    
    socket.emit('purchase_update', updateData);
  }, [socket]);

  return {
    emitPurchaseUpdate
  };
} 