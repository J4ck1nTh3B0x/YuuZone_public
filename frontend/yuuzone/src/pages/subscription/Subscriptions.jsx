import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import AuthConsumer from '../../components/AuthContext';
import SubscriptionCard from '../../components/SubscriptionCard';
import Modal from '../../components/Modal';
import { toast } from 'react-toastify';

const Subscriptions = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { socket } = AuthConsumer();
  const [subscriptionData, setSubscriptionData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showQRModal, setShowQRModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [qrData, setQrData] = useState(null);
  const [pendingPayments, setPendingPayments] = useState([]);
  const [checkingPayment, setCheckingPayment] = useState(false);
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes in seconds
  const [isTimerActive, setIsTimerActive] = useState(false);
  const [paymentCompleted, setPaymentCompleted] = useState(false); // Track if payment was completed via real-time event
  const timerRef = useRef(null);

  // Payment completion handlers
  const handleSocketPaymentCompleted = async (data) => {
    console.log('🔍 DEBUG: Subscription page received socket payment_completed event:', data);
    
    const { payment_reference, payment_type, amount, tier_name, user_subscription_types } = data;
    
    if (payment_type === 'subscription') {
      console.log('🔍 DEBUG: Processing subscription payment completion via socket event');
      setPaymentCompleted(true); // Mark payment as completed to stop all checking
      toast.success(`${t('subscription.paymentCompleted')} - ${tier_name || 'Subscription'}`);
      setShowQRModal(false);
      setIsTimerActive(false);
      
      // Refresh subscription data to update tier status before redirecting
      try {
        const response = await axios.get('/api/subscriptions/plans');
        if (response.data) {
          // Update the subscription data with fresh data
          setSubscriptionData(response.data);
        }
      } catch (error) {
        // Could not refresh subscription data
      }
      
      // Redirect to success page
      navigate(`/payment-success/${payment_reference}`);
    }
  };

  useEffect(() => {
    fetchSubscriptionData();
    fetchPendingPayments();
    console.log('🔍 DEBUG: Subscription page mounted, socket connected:', socket?.connected);
  }, []);

  // Set up socket listeners immediately when component mounts
  useEffect(() => {
    console.log('🔍 DEBUG: Setting up socket listeners, socket connected:', socket?.connected);
    
    const setupListeners = () => {
      if (socket && socket.connected && !paymentCompleted) {
        console.log('🔍 DEBUG: Socket is connected, setting up listeners');
        
        // Set up payment completion listeners
        socket.on('payment_completed', (data) => {
          console.log('🔍 DEBUG: Subscription page received payment_completed socket event:', data);
          handleSocketPaymentCompleted(data);
        });
      }
    };

    // Set up listeners immediately if socket is already connected
    setupListeners();

    // Set up listeners when socket connects
    if (socket) {
      socket.on('connect', () => {
        console.log('🔍 DEBUG: Socket connected, setting up listeners');
        setupListeners();
      });
    }

    return () => {
      if (socket && socket.connected) {
        socket.off('payment_completed');
        socket.off('connect');
      }
    };
  }, [socket, paymentCompleted]);

  // Countdown timer effect
  useEffect(() => {
    if (isTimerActive && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prevTime) => {
          if (prevTime <= 1) {
            // Timer expired
            setIsTimerActive(false);
            toast.error(t('subscription.paymentExpired'));
            setShowQRModal(false);
            fetchPendingPayments(); // Refresh to remove expired payment
            return 0;
          }
          return prevTime - 1;
        });
      }, 1000);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isTimerActive, timeLeft, t]);

  // Auto-check payment status every 3 seconds when payment is active (increased frequency for better responsiveness)
  // This is a fallback in case real-time events fail
  useEffect(() => {
    let paymentCheckTimer;
    
    // Only start checking if payment is active and not completed
    if (isTimerActive && qrData?.payment_reference && timeLeft > 0 && !paymentCompleted) {
      console.log('🔍 DEBUG: Starting automatic payment status check every 3 seconds');
      paymentCheckTimer = setInterval(() => {
        // Double-check that payment is still not completed before making API call
        if (!paymentCompleted) {
          checkPaymentStatus(qrData.payment_reference, true); // true for auto-check
        }
      }, 3000); // Check every 3 seconds for faster response
    } else if (paymentCompleted) {
      console.log('🔍 DEBUG: Payment completed, stopping automatic status check');
    }
    
    return () => {
      if (paymentCheckTimer) {
        console.log('🔍 DEBUG: Cleaning up automatic payment status check timer');
        clearInterval(paymentCheckTimer);
      }
    };
  }, [isTimerActive, qrData?.payment_reference, timeLeft, paymentCompleted]);

  // Listen for payment completion events (for automatic redirects)
  useEffect(() => {
    const handlePaymentCompleted = async (event) => {
      const { payment_reference, payment_type, amount, tier_name, user_subscription_types } = event.detail;
      
      console.log('🔍 DEBUG: Subscription page received paymentCompleted event:', { payment_reference, payment_type, amount, tier_name });
      
      if (payment_type === 'subscription') {
        setPaymentCompleted(true); // Mark payment as completed
        toast.success(`${t('subscription.paymentCompleted')} - ${tier_name || 'Subscription'}`);
        setShowQRModal(false);
        setIsTimerActive(false);
        
        // Refresh subscription data to update tier status before redirecting
        try {
          const response = await axios.get('/api/subscriptions/plans');
          if (response.data) {
            // Update the subscription data with fresh data
            setSubscriptionData(response.data);
          }
        } catch (error) {
          // Could not refresh subscription data
        }
        
        // Redirect to success page
        navigate(`/payment-success/${payment_reference}`);
      }
    };

    // Only set up listener if payment is not completed
    if (!paymentCompleted) {
      window.addEventListener('paymentCompleted', handlePaymentCompleted);
    }

    return () => {
      window.removeEventListener('paymentCompleted', handlePaymentCompleted);
    };
  }, [navigate, t, paymentCompleted]);

  // Listen for subscription purchase events (for UI updates)
  useEffect(() => {
    const handleSubscriptionPurchased = async (data) => {
      const { tier_name, tier_slug, amount, currency, payment_status } = data;
      
      // Show success message
      toast.success(`${t('subscription.paymentCompleted')} - ${tier_name || 'Subscription'}`);
      
      // Refresh subscription data to update tier status
      try {
        const response = await axios.get('/api/subscriptions/plans');
        if (response.data) {
          setSubscriptionData(response.data);
        }
      } catch (error) {
        console.error('Failed to refresh subscription data:', error);
      }
      
      // Update user context with new subscription types
      try {
        const userResponse = await axios.get('/api/user');
        if (userResponse.data) {
          window.dispatchEvent(new CustomEvent('userDataUpdated', {
            detail: userResponse.data
          }));
        }
      } catch (error) {
        console.error('Failed to refresh user data:', error);
      }
    };

    // Only set up listener if payment is not completed to prevent spam
    if (!paymentCompleted && socket && socket.connected) {
      socket.on('subscription_purchased', handleSubscriptionPurchased);
    }

    return () => {
      if (socket && socket.connected) {
        socket.off('subscription_purchased', handleSubscriptionPurchased);
      }
    };
  }, [socket, t, paymentCompleted]);

  // Reset timer when modal closes
  useEffect(() => {
    if (!showQRModal) {
      setIsTimerActive(false);
      setTimeLeft(300);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  }, [showQRModal]);

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const fetchSubscriptionData = async () => {
    try {
      const response = await axios.get('/api/subscriptions/plans');
      setSubscriptionData(response.data);
    } catch (error) {
      toast.error(t('subscription.toastErrorFailedToLoadSubscriptionData'));
    } finally {
      setLoading(false);
    }
  };

  const fetchPendingPayments = async () => {
    try {
      const response = await axios.get('/api/subscriptions/payment/pending');
      setPendingPayments(response.data.pending_payments || []);
    } catch (error) {
      // Error fetching pending payments
    }
  };

  const handleBuyClick = async (subscriptionType) => {
    try {
      setSelectedPlan(subscriptionType);
      setLoading(true);
      
      const response = await axios.get(`/api/subscriptions/payment/qr/${subscriptionType}`);
      setQrData(response.data);
      setShowQRModal(true);
      
      // Start countdown timer
      setTimeLeft(300); // 5 minutes
      setIsTimerActive(true);
      setPaymentCompleted(false); // Reset payment completed state
      
      // Silent update - no fetchPendingPayments to avoid interruption
    } catch (error) {
      if (error.response?.data?.error) {
        toast.error(error.response.data.error);
      } else {
        toast.error(t('subscription.toastErrorFailedToGeneratePaymentQR'));
      }
    } finally {
      setLoading(false);
    }
  };

  const reopenPaymentQR = (payment) => {
    // Ensure the payment object has all required fields for the QR modal
    const qrDataForModal = {
      qr_url: payment.qr_url,
      amount: payment.amount,
      package_name: payment.package_name || payment.tier_name,
      payment_reference: payment.notes?.replace('Payment reference: ', '') || '',
      expires_at: payment.expires_at
    };
    
    setQrData(qrDataForModal);
    setShowQRModal(true);
    setIsTimerActive(true); // Re-activate timer
    setPaymentCompleted(false); // Reset payment completed state
    setTimeLeft(300); // Reset timer to 5 minutes
    
    // Clear any existing timer and start new one
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    
    timerRef.current = setInterval(() => {
      setTimeLeft((prevTime) => {
        if (prevTime <= 1) {
          setIsTimerActive(false);
          toast.error(t('subscription.paymentExpired'));
          setShowQRModal(false);
          // Silent update - no fetchPendingPayments to avoid interruption
          return 0;
        }
        return prevTime - 1;
      });
    }, 1000);
  };

  // Add payment status check function
  const checkPaymentStatus = async (paymentReference = null, isAutoCheck = false) => {
    const reference = paymentReference || qrData?.payment_reference;
    if (!reference) {
      return;
    }

    // Prevent multiple simultaneous requests
    if (checkingPayment) {
      return;
    }

    // Don't check if payment is already completed via real-time event
    if (paymentCompleted) {
      return;
    }

    try {
      setCheckingPayment(true);
      const response = await axios.get(`/api/subscriptions/payment/status/${reference}`);
      
      if (response.data.status === 'completed') {
        setPaymentCompleted(true); // Mark as completed to stop polling
        toast.success(t('subscription.paymentCompleted'));
        setShowQRModal(false);
        setIsTimerActive(false);
        
        // Refresh subscription data to update tier status before redirecting
        try {
          const response = await axios.get('/api/subscriptions/plans');
          if (response.data) {
            setSubscriptionData(response.data);
          }
        } catch (error) {
          // Could not refresh subscription data
        }
        
        // Redirect to success page
        navigate(`/payment-success/${reference}`);
      } else if (response.data.is_expired) {
        if (!isAutoCheck) { // Only show error for manual checks
          toast.error(t('subscription.paymentExpired'));
        }
        setShowQRModal(false);
        setIsTimerActive(false);
        fetchPendingPayments(); // Refresh to remove expired payment
      }
    } catch (error) {
      if (!isAutoCheck) { // Only log errors for manual checks
        console.error('Error checking payment status:', error);
      }
    } finally {
      setCheckingPayment(false);
    }
  };

  const isOwned = (type) => {
    if (type === 'free') return true; // Free tier is always "owned"
    if (!subscriptionData?.user_subscription_types) return false;
    return subscriptionData.user_subscription_types.includes(type);
  };

  const getCurrentTier = () => {
    if (!subscriptionData?.user_subscription_types || subscriptionData.user_subscription_types.length === 0) {
      return 'free'; // No paid tiers, user is on free tier
    }
    
    // Return the highest tier (VIP > Support > Free)
    const tierOrder = { 'vip': 3, 'support': 2, 'free': 1 };
    let highestTier = 'free';
    let highestValue = 1;
    
    for (const tier of subscriptionData.user_subscription_types) {
      if (tierOrder[tier] > highestValue) {
        highestTier = tier;
        highestValue = tierOrder[tier];
      }
    }
    
    return highestTier;
  };

  const getExpiresIn = (type) => {
    if (type === 'free') return null; // Free tier doesn't expire
    if (!subscriptionData?.user_subscriptions) return null;
    const subscription = subscriptionData.user_subscriptions.find(sub => sub.tier_slug === type);
    return subscription?.days_remaining || null;
  };

  const subscriptionPlans = [
    ...(subscriptionData?.plans ? Object.entries(subscriptionData.plans)
      .map(([slug, plan]) => ({
        type: slug === 'member' ? 'free' : slug, // Map 'member' to 'free' for frontend
        name: plan.name,
        price: `${plan.price.toLocaleString()} VND/month`,
        description: plan.description,
        benefits: plan.features?.benefits || []
      })) : [])
  ];

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-theme-blue"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen dark:bg-theme-dark-bg py-12 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl font-bold text-theme-blue mb-4">
            {t('subscription.subscriptions')}
          </h1>
          <p className="text-theme-text-secondary dark:text-theme-dark-text-secondary text-lg max-w-2xl mx-auto">
            {t('subscription.subscriptionDescription')}
          </p>
        </motion.div>

        {/* Pending Payments Alert */}
        {pendingPayments && Array.isArray(pendingPayments) && pendingPayments.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 p-4 bg-yellow-100 dark:bg-yellow-900 border border-yellow-400 dark:border-yellow-600 rounded-lg"
          >
            <h3 className="text-lg font-semibold text-yellow-800 dark:text-yellow-200 mb-2">
              {t('subscription.pendingPayments')}
            </h3>
            <div className="space-y-2">
              {(pendingPayments || []).map((payment, index) => (
                <div key={index} className="flex items-center justify-between text-sm">
                  <span className="text-yellow-700 dark:text-yellow-300">
                    {payment.notes?.replace('Payment reference: ', '')} - {payment.amount?.toLocaleString()} VND
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => reopenPaymentQR(payment)}
                      disabled={checkingPayment}
                      className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs disabled:opacity-50"
                    >
                      {t('subscription.payNow')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Subscription Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {subscriptionPlans.map((plan, index) => (
            <motion.div
              key={plan.type}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <SubscriptionCard
                type={plan.type}
                name={plan.name}
                price={plan.price}
                description={plan.description}
                benefits={plan.benefits}
                isOwned={isOwned(plan.type)}
                expiresIn={getExpiresIn(plan.type)}
                onBuyClick={handleBuyClick}
                isCurrentTier={plan.type === getCurrentTier()}
              />
            </motion.div>
          ))}
        </div>

        {/* QR Code Modal */}
        {showQRModal && qrData && (
          <Modal showModal={showQRModal} setShowModal={setShowQRModal}>
            <div className="bg-white dark:bg-theme-dark-card rounded-lg p-6 max-w-md mx-auto">
              <h2 className="text-2xl font-bold text-theme-text-primary dark:text-theme-dark-text mb-4 text-center">
                {t('subscription.paymentQR')}
              </h2>
              
              <div className="text-center mb-4">
                <img
                  src={qrData.qr_url}
                  alt="Payment QR Code"
                  className="mx-auto border-2 border-theme-border-light dark:border-theme-dark-border rounded-lg"
                />
              </div>

              <div className="text-center mb-4">
                <p className="text-lg font-bold text-theme-text-primary dark:text-theme-dark-text">
                  {qrData.package_name}
                </p>
                <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                  {qrData.amount?.toLocaleString()} VND
                </p>
                <p className="text-sm text-theme-text-secondary dark:text-theme-dark-text-secondary">
                  {t('subscription.paymentReference')}: {qrData.payment_reference}
                </p>
              </div>

              <div className="text-center mb-4">
                <div className="text-sm text-theme-text-secondary dark:text-theme-dark-text-secondary">
                  {t('subscription.timeRemaining')}: {formatTime(timeLeft)}
                </div>
              </div>

              <div className="flex flex-col space-y-2">
                <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
                  Reference: {qrData.payment_reference}
                </div>
                <button
                  onClick={() => setShowQRModal(false)}
                  className="w-full bg-gray-500 text-white py-2 px-4 rounded-lg hover:bg-gray-600 transition-colors font-medium"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          </Modal>
        )}
      </div>
    </div>
  );
};

export default Subscriptions; 