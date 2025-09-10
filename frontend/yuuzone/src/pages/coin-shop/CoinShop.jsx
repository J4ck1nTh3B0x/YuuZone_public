import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import AuthConsumer from '../../components/AuthContext';
import Modal from '../../components/Modal';
import Svg from '../../components/Svg';
import useRealtimeCoins from '../../hooks/useRealtimeCoins';

export default function CoinShop() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isAuthenticated, user, socket } = AuthConsumer();
  const [activeTab, setActiveTab] = useState('coins');
  const [coinPackages, setCoinPackages] = useState([]);
  const [avatars, setAvatars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showQRModal, setShowQRModal] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [qrData, setQrData] = useState(null);
  const [timeLeft, setTimeLeft] = useState(300);
  const [isTimerActive, setIsTimerActive] = useState(false);
  const [checkingPayment, setCheckingPayment] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [sortBy, setSortBy] = useState('price');
  const [sortOrder, setSortOrder] = useState('asc');
  const [pendingPayments, setPendingPayments] = useState([]);
  const [paymentCompleted, setPaymentCompleted] = useState(false); // Track if payment was completed via real-time event
  const [balanceUpdating, setBalanceUpdating] = useState(false); // Track if balance is being updated
  const [lastCheckTime, setLastCheckTime] = useState(null); // Track last payment check time
  const [refreshing, setRefreshing] = useState(false); // Track if data is being refreshed

  // Initialize real-time coin updates
  const { refreshBalance, getCoinPackages, getAvatars } = useRealtimeCoins();

  // Add a fallback fetch mechanism
  useEffect(() => {
    if (isAuthenticated && user?.id && getCoinPackages && getAvatars) {
      // If we don't have data after 2 seconds, try fetching again
      const fallbackTimer = setTimeout(() => {
        if (coinPackages.length === 0 && avatars.length === 0) {
          fetchData();
        }
      }, 2000);

      return () => clearTimeout(fallbackTimer);
    }
  }, [isAuthenticated, user?.id, getCoinPackages, getAvatars, coinPackages.length, avatars.length]);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    // Wait for both authentication and hook functions to be ready
    if (getCoinPackages && getAvatars && user?.id) {
      fetchData();
    }
  }, [isAuthenticated, navigate, getCoinPackages, getAvatars, user?.id]);

  useEffect(() => {
    let timer;
    if (isTimerActive && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            setIsTimerActive(false);
            setShowQRModal(false);
            toast.error(t('coins.paymentExpired'));
            return 300;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isTimerActive, timeLeft, t]);

  // Auto-check payment status every 5 seconds when payment is active
  // This is a fallback in case real-time events fail
  useEffect(() => {
    let paymentCheckTimer;
    if (qrData?.payment_reference && !paymentCompleted) {

      
      // Check immediately
      setLastCheckTime(new Date());
      checkPaymentStatus();
      
      // Then check every 10 seconds
      paymentCheckTimer = setInterval(() => {
        setLastCheckTime(new Date());
        checkPaymentStatus();
      }, 10000); // Check every 10 seconds
    }
    return () => {
      if (paymentCheckTimer) {
        clearInterval(paymentCheckTimer);
      }
    };
  }, [qrData?.payment_reference, paymentCompleted]);

  // Listen for real-time coin balance updates
  useEffect(() => {
    const handleCoinBalanceUpdate = (event) => {
      const { newBalance, transactionType, amount, packageName, avatarName, isBalanceChange, timestamp } = event.detail;
      

      
      // Show success message based on transaction type
      if (transactionType === 'purchase' && packageName) {
        toast.success(`${t('coins.paymentCompleted')} - ${packageName}`);
        // Completely silent update - no fetchData, no interruption
      } else if (transactionType === 'avatar_purchase' && avatarName) {
        toast.success(`${t('coins.avatarPurchased')} - ${avatarName}`);
        
        // Update the avatar list to show the purchased avatar as owned
        setAvatars(prevAvatars => 
          prevAvatars.map(avatar => {
            if (avatar.name === avatarName) {
              return {
                ...avatar,
                owned: true,
                equipped: false
              };
            }
            return avatar;
          })
        );
        
        // Refresh data to ensure consistency
        fetchData();
      } else if (transactionType === 'real_time_update') {
        // Completely silent real-time update - no user interruption
        // No toasts, no fetchData, no UI changes
      } else if (transactionType === 'polling_update') {
        // Completely silent update from polling - no interruption
        // No fetchData, no toasts, no UI changes
      }
    };

    // Listen for specific balance change events
    const handleCoinBalanceChanged = (event) => {
      const { newBalance, oldBalance, change, timestamp } = event.detail;

      
      // Show visual feedback that balance is updating (silent)
      setBalanceUpdating(true);
      setTimeout(() => setBalanceUpdating(false), 2000); // Stop updating indicator after 2 seconds
      
      // Only show feedback for significant changes to avoid spam
      if (Math.abs(change) > 50) {
        if (change > 0) {
          toast.success(`💰 +${change} coins added! New balance: ${newBalance}`);
        } else if (change < 0) {
          toast.info(`💰 ${Math.abs(change)} coins spent. New balance: ${newBalance}`);
        }
      }
    };

    // Listen for payment completion events (for automatic redirects)
    const handlePaymentCompleted = async (event) => {
      const { payment_reference, payment_type, amount, tier_name } = event.detail;
      
      if (payment_type === 'coin') {
        setPaymentCompleted(true); // Mark payment as completed
        toast.success(`${t('coins.paymentCompleted')} - ${amount} coins added!`);
        setShowQRModal(false);
        setIsTimerActive(false);
        
        // Refresh balance after payment completion
        await refreshBalance();
        
        // Refresh user data to update coin balance before redirecting
        try {
          const userResponse = await axios.get('/api/user');
          if (userResponse.data) {
            // Update the user context with new balance
            window.dispatchEvent(new CustomEvent('userDataUpdated', {
              detail: userResponse.data
            }));
            // User data refreshed with new balance
          }
        } catch (error) {
          // Could not refresh user data
        }
        
        // Redirect to success page
        navigate(`/payment-success/${payment_reference}`);
      } else {
        // Payment type is not coin
      }
    };

    window.addEventListener('coinBalanceUpdated', handleCoinBalanceUpdate);
    window.addEventListener('coinBalanceChanged', handleCoinBalanceChanged);
    window.addEventListener('paymentCompleted', handlePaymentCompleted);

    return () => {
      window.removeEventListener('coinBalanceUpdated', handleCoinBalanceUpdate);
      window.removeEventListener('coinBalanceChanged', handleCoinBalanceChanged);
      window.removeEventListener('paymentCompleted', handlePaymentCompleted);
    };
  }, [t, socket, navigate]);

  const fetchData = async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoading(true);
      }
      

      
      // Fetch coin packages and avatars in parallel for better performance
      const [packagesData, avatarsData] = await Promise.all([
        getCoinPackages(),
        getAvatars()
      ]);
      

      
      if (packagesData) {
        setCoinPackages(packagesData.packages || packagesData);
      }
      
      if (avatarsData) {
        setAvatars(avatarsData.avatars || avatarsData);
      }
      
    } catch (error) {
      console.error('CoinShop: fetchData error', error);
      if (showLoading) {
        toast.error(t('coins.fetchError') || 'Failed to fetch data');
      }
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  };

  const handlePurchaseCoins = async (packageId) => {
    try {
      const response = await axios.post('/api/coins/purchase', {
        package_id: packageId
      });

      if (response.data.success) {
        setSelectedPackage(response.data.payment);
        setQrData(response.data.qr_data);
        setShowQRModal(true);
        setIsTimerActive(true);
        setTimeLeft(300);
        setPaymentCompleted(false); // Reset payment completed state
      }
    } catch (error) {
      toast.error(error.response?.data?.error || t('coins.purchaseError'));
    }
  };

  const handlePurchaseAvatar = async (avatarId) => {
    try {
      const response = await axios.post('/api/coins/avatars/purchase', {
        avatar_id: avatarId
      });

      if (response.data.success) {
        toast.success(t('coins.avatarPurchased'));
        // Refresh data silently to update avatar ownership status
        fetchData(false);
      }
    } catch (error) {
      toast.error(error.response?.data?.error || t('coins.avatarPurchaseError'));
    }
  };

  const checkPaymentStatus = async (paymentReference = null) => {
    const reference = paymentReference || qrData?.payment_reference;
          if (!reference) {
        return;
      }

          // Prevent multiple simultaneous requests
      if (checkingPayment) {
        return;
      }
    
    try {
      setCheckingPayment(true);
      const response = await axios.get(`/api/subscriptions/payment/status/${reference}`);
      
      if (response.data.status === 'completed') {
        setPaymentCompleted(true); // Mark as completed to stop polling
        toast.success(t('coins.paymentCompleted'));
        setShowQRModal(false);
        setIsTimerActive(false);
        
        // Refresh balance after payment completion
        await refreshBalance();
        
        // Refresh user data to update coin balance before redirecting
        try {
          const userResponse = await axios.get('/api/user');
          if (userResponse.data) {
            // Update the user context with new balance
            window.dispatchEvent(new CustomEvent('userDataUpdated', {
              detail: userResponse.data
            }));
            // User data refreshed with new balance
          }
        } catch (error) {
          // Could not refresh user data
        }
        
        // Redirect to success page
        navigate(`/payment-success/${reference}`);
      } else if (response.data.is_expired) {
        toast.error(t('coins.paymentExpired'));
        setShowQRModal(false);
        setIsTimerActive(false);
      } else {
        // Only show pending message for manual checks (not auto-checks)
        if (paymentReference) {
          toast.info(t('coins.paymentPending'));
        }
      }
    } catch (error) {
      // Only show error for manual checks (not auto-checks)
      if (paymentReference) {
        toast.error(t('coins.paymentStatusError'));
      }
    } finally {
      setCheckingPayment(false);
    }
  };

  const checkPendingPaymentStatus = async (paymentReference) => {
    try {
      setCheckingPayment(true);
      const response = await axios.get(`/api/subscriptions/payment/status/${paymentReference}`);
      
      if (response.data.status === 'completed') {
        toast.success(t('coins.paymentCompleted'));
        // Refresh balance after payment completion
        await refreshBalance();
        // Redirect to success page
        navigate(`/payment-success/${paymentReference}`);
      } else if (response.data.is_expired) {
        toast.error(t('coins.paymentExpired'));
        // Silent update - no fetchData to avoid interruption
      } else {
        toast.info(t('coins.paymentPending'));
      }
    } catch (error) {
      toast.error(t('coins.paymentStatusError'));
    } finally {
      setCheckingPayment(false);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Filter functions
  const filterCoinPackages = () => {
    let filtered = coinPackages;
    
    if (searchTerm) {
      filtered = filtered.filter(pkg => 
        pkg.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        pkg.coin_amount.toString().includes(searchTerm) ||
        pkg.price_vnd.toString().includes(searchTerm)
      );
    }
    
    return sortCoinPackages(filtered);
  };

  const filterAvatars = () => {
    let filtered = avatars;
    
    if (searchTerm) {
      filtered = filtered.filter(avatar => 
        avatar.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        avatar.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        avatar.category_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        avatar.price_coins.toString().includes(searchTerm) ||
        avatar.creator_name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    return sortAvatars(filtered);
  };

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  const handleFilterChange = (e) => {
    setFilterType(e.target.value);
    // Switch to appropriate tab based on filter
    if (e.target.value === 'coins') {
      setActiveTab('coins');
    } else if (e.target.value === 'avatars') {
      setActiveTab('avatars');
    }
  };

  // Sorting functions
  const sortCoinPackages = (packages) => {
    const sorted = [...packages];
    sorted.sort((a, b) => {
      let aValue, bValue;
      
      switch (sortBy) {
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'price':
          aValue = a.price_vnd;
          bValue = b.price_vnd;
          break;
        case 'coins':
          aValue = a.coin_amount;
          bValue = b.coin_amount;
          break;
        default:
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
      }

      if (sortOrder === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });
    return sorted;
  };

  const sortAvatars = (avatars) => {
    const sorted = [...avatars];
    sorted.sort((a, b) => {
      let aValue, bValue;
      
      switch (sortBy) {
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'price':
          aValue = a.price_coins;
          bValue = b.price_coins;
          break;
        case 'category':
          aValue = (a.category_name || 'Uncategorized').toLowerCase();
          bValue = (b.category_name || 'Uncategorized').toLowerCase();
          break;
        case 'creator':
          aValue = (a.creator_name || '').toLowerCase();
          bValue = (b.creator_name || '').toLowerCase();
          break;
        default:
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
      }

      if (sortOrder === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });
    return sorted;
  };

  const handleSortChange = (e) => {
    const [field, order] = e.target.value.split('-');
    setSortBy(field);
    setSortOrder(order);
  };

  // Get filtered data based on current tab and search
  const getFilteredData = () => {
    if (activeTab === 'coins') {
      return filterCoinPackages();
    } else if (activeTab === 'avatars') {
      return filterAvatars();
    }
    return [];
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-theme-blue"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-theme-light-gray2 dark:bg-theme-dark-bg pt-20 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white dark:bg-theme-dark-card rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-theme-text-primary dark:text-theme-dark-text">
                {t('coins.marketplace')}
              </h1>
              <p className="text-theme-text-secondary dark:text-theme-dark-text-secondary mt-2">
                {t('coins.marketplaceDescription')}
              </p>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => {
                    setRefreshing(true);
                    fetchData(false).finally(() => setRefreshing(false));
                  }}
                  disabled={loading || refreshing}
                  className="px-3 py-1 text-sm bg-theme-blue text-white rounded-md hover:bg-blue-600 transition-colors disabled:opacity-50"
                >
                  {refreshing ? t('common.loading') : t('coins.refresh')}
                </button>
                <div className={`text-2xl font-bold text-yellow-600 dark:text-yellow-400 flex items-center justify-end gap-2 transition-all duration-300 ${balanceUpdating ? 'animate-pulse scale-105' : ''}`}>
                  <Svg type="coin" className={`w-8 h-8 ${balanceUpdating ? 'animate-spin' : ''}`} />
                  {user?.wallet?.coin_balance || 0} {t('coins.coins')}
                  {balanceUpdating && (
                    <span className="text-sm text-green-500 animate-pulse">🔄</span>
                  )}
                </div>
              </div>
              <p className="text-sm text-theme-text-secondary dark:text-theme-dark-text-secondary">
                {balanceUpdating ? t('coins.updatingBalance', 'Updating...') : t('coins.yourBalance')}
              </p>
            </div>
          </div>
        </div>

        {/* Pending Payments Alert */}
        {pendingPayments.length > 0 && (
          <div className="mb-8 p-4 bg-yellow-100 dark:bg-yellow-900 border border-yellow-400 dark:border-yellow-600 rounded-lg">
            <h3 className="text-lg font-semibold text-yellow-800 dark:text-yellow-200 mb-2">
              {t('coins.pendingPayments')}
            </h3>
            <div className="space-y-2">
              {pendingPayments.map((payment, index) => (
                <div key={index} className="flex items-center justify-between text-sm">
                  <span className="text-yellow-700 dark:text-yellow-300">
                    {payment.notes?.replace('Payment reference: ', '')} - {payment.amount_vnd?.toLocaleString()} VND
                  </span>
                  <button
                    onClick={() => checkPendingPaymentStatus(payment.notes?.replace('Payment reference: ', ''))}
                    disabled={checkingPayment}
                    className="px-3 py-1 bg-yellow-600 hover:bg-yellow-700 text-white rounded text-xs disabled:opacity-50"
                  >
                    {checkingPayment ? t('coins.checking') : t('coins.checkStatus')}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Search and Filter Bar */}
        <div className="bg-white dark:bg-theme-dark-card rounded-lg shadow-md p-4 mb-6">
          <div className="flex items-center space-x-4">
            <div className="flex-1 relative">
              <input
                type="text"
                placeholder={t('coins.searchPlaceholder')}
                className="w-full pl-10 pr-4 py-2 border border-theme-border-light dark:border-theme-dark-border rounded-lg bg-theme-bg-primary dark:bg-theme-dark-bg text-theme-text-primary dark:text-theme-dark-text"
                value={searchTerm}
                onChange={handleSearchChange}
              />
              <Svg type="search" className="absolute left-3 top-2.5 w-5 h-5 text-theme-text-secondary" />
            </div>
            <select 
              className="px-4 py-2 border border-theme-border-light dark:border-theme-dark-border rounded-lg bg-theme-bg-primary dark:bg-theme-dark-bg text-theme-text-primary dark:text-theme-dark-text"
              value={filterType}
              onChange={handleFilterChange}
            >
              <option value="all">{t('coins.allItems')}</option>
              <option value="coins">{t('coins.coinPackages')}</option>
              <option value="avatars">{t('coins.avatars')}</option>
            </select>
            <select 
              className="px-4 py-2 border border-theme-border-light dark:border-theme-dark-border rounded-lg bg-theme-bg-primary dark:bg-theme-dark-bg text-theme-text-primary dark:text-theme-dark-text"
              value={`${sortBy}-${sortOrder}`}
              onChange={handleSortChange}
            >
              {activeTab === 'coins' ? (
                <>
                  <option value="price-asc">{t('coins.sortByPriceAsc')}</option>
                  <option value="price-desc">{t('coins.sortByPriceDesc')}</option>
                  <option value="coins-asc">{t('coins.sortByCoinsAsc')}</option>
                  <option value="coins-desc">{t('coins.sortByCoinsDesc')}</option>
                  <option value="name-asc">{t('coins.sortByNameAsc')}</option>
                  <option value="name-desc">{t('coins.sortByNameDesc')}</option>
                </>
              ) : (
                <>
                  <option value="price-asc">{t('coins.sortByPriceAsc')}</option>
                  <option value="price-desc">{t('coins.sortByPriceDesc')}</option>
                  <option value="category-asc">{t('coins.sortByCategoryAsc')}</option>
                  <option value="category-desc">{t('coins.sortByCategoryDesc')}</option>
                  <option value="creator-asc">{t('coins.sortByCreatorAsc')}</option>
                  <option value="creator-desc">{t('coins.sortByCreatorDesc')}</option>
                  <option value="name-asc">{t('coins.sortByNameAsc')}</option>
                  <option value="name-desc">{t('coins.sortByNameDesc')}</option>
                </>
              )}
            </select>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white dark:bg-theme-dark-card rounded-lg shadow-md p-4 mb-6">
          <div className="flex space-x-4">
            <button
              onClick={() => setActiveTab('coins')}
              className={`px-8 py-2 rounded-lg font-medium transition-colors flex items-center justify-center whitespace-normal ${
                activeTab === 'coins'
                  ? 'bg-theme-blue text-white'
                  : 'text-theme-text-primary dark:text-theme-dark-text hover:bg-theme-bg-hover'
              }`}
            >
              <Svg type="coin" className="w-5 h-5 mr-2 flex-shrink-0" />
              <span className="text-center">{t('coins.coinPackages')}</span>
            </button>
            <button
              onClick={() => setActiveTab('avatars')}
              className={`px-6 py-2 rounded-lg font-medium transition-colors flex items-center justify-center whitespace-normal ${
                activeTab === 'avatars'
                  ? 'bg-theme-blue text-white'
                  : 'text-theme-text-primary dark:text-theme-dark-text hover:bg-theme-bg-hover'
              }`}
            >
              <span className="mr-2">👤</span>
              <span className="text-center">{t('coins.avatarShop')}</span>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="bg-white dark:bg-theme-dark-card rounded-lg shadow-md p-6">
          {activeTab === 'coins' && (
            <div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
                {filterCoinPackages().length === 0 ? (
                  <div className="col-span-full text-center py-8">
                    <p className="text-theme-text-secondary dark:text-theme-dark-text-secondary">
                      {searchTerm ? t('coins.noCoinPackagesFound', { searchTerm }) : t('coins.noCoinPackagesAvailable')}
                    </p>
                  </div>
                ) : (
                  filterCoinPackages().map((pkg) => (
                    <div
                      key={pkg.id}
                      className="bg-theme-bg-primary dark:bg-theme-dark-bg rounded-lg border border-theme-border-light dark:border-theme-dark-border p-4 hover:shadow-lg transition-shadow"
                    >
                      <div className="text-center">
                        <div className="mb-2">
                          <Svg type="coin" className="w-12 h-12 text-yellow-600 dark:text-yellow-400 mx-auto" />
                        </div>
                        <h3 className="text-lg font-bold text-theme-text-primary dark:text-theme-dark-text mb-2">
                          {pkg.name}
                        </h3>
                        <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400 mb-4">
                          {pkg.coin_amount} {t('coins.coins')}
                        </p>
                        <p className="text-sm text-theme-text-secondary dark:text-theme-dark-text-secondary mb-4">
                          {pkg.price_vnd.toLocaleString()} VND
                        </p>
                        <button
                          onClick={() => handlePurchaseCoins(pkg.id)}
                          className="w-full bg-theme-blue text-white py-2 px-4 rounded-lg hover:bg-blue-600 transition-colors font-medium"
                        >
                          {t('coins.buyNow')}
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === 'avatars' && (
            <div>
              {(() => {
                // Group avatars by category
                const filteredAvatars = filterAvatars();
                const groupedAvatars = {};
                filteredAvatars.forEach(avatar => {
                  const categoryName = avatar.category_name || 'Uncategorized';
                  if (!groupedAvatars[categoryName]) {
                    groupedAvatars[categoryName] = [];
                  }
                  groupedAvatars[categoryName].push(avatar);
                });

                if (filteredAvatars.length === 0) {
                  return (
                    <div className="text-center py-8">
                      <p className="text-theme-text-secondary dark:text-theme-dark-text-secondary">
                        {searchTerm ? t('coins.noAvatarsFound', { searchTerm }) : t('coins.noAvatarsAvailable')}
                      </p>
                    </div>
                  );
                }

                return Object.entries(groupedAvatars).map(([categoryName, categoryAvatars]) => (
                  <div key={categoryName} className="mb-8">
                    <h3 className="text-xl font-bold text-theme-text-primary dark:text-theme-dark-text mb-4 border-b border-theme-border-light dark:border-theme-dark-border pb-2">
                      {categoryName}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                      {categoryAvatars.map((avatar) => (
                        <div
                          key={avatar.id}
                          className="bg-theme-bg-primary dark:bg-theme-dark-bg rounded-lg border border-theme-border-light dark:border-theme-dark-border p-4 hover:shadow-lg transition-shadow"
                        >
                          <div className="text-center">
                            <img
                              src={avatar.image_url}
                              alt={avatar.name}
                              className="w-24 h-24 mx-auto mb-3 rounded-lg object-cover"
                              onError={(e) => {
                                e.target.src = 'https://via.placeholder.com/96x96?text=Avatar';
                              }}
                            />
                            <h3 className="text-lg font-bold text-theme-text-primary dark:text-theme-dark-text mb-2">
                              {avatar.name}
                            </h3>
                            <div className="flex items-center justify-center mb-4">
                              <span className="text-yellow-600 dark:text-yellow-400 font-bold text-lg flex items-center gap-1">
                                <Svg type="coin" className="w-5 h-5" />
                                {avatar.price_coins}
                              </span>
                            </div>
                            {avatar.owned ? (
                              <div className="text-green-600 dark:text-green-400 font-medium">
                                {avatar.equipped ? t('coins.equipped') : t('coins.owned')}
                              </div>
                            ) : avatar.available_for_purchase ? (
                              <button
                                onClick={() => handlePurchaseAvatar(avatar.id)}
                                className="w-full bg-theme-blue text-white py-2 px-4 rounded-lg hover:bg-blue-600 transition-colors font-medium"
                              >
                                {t('coins.buyNow')}
                              </button>
                            ) : (
                              <div className="text-gray-500 dark:text-gray-400 font-medium">
                                {t('coins.unavailable')}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ));
              })()}
            </div>
          )}
        </div>
      </div>

      {/* QR Modal */}
      {showQRModal && qrData && (
        <Modal showModal={showQRModal} setShowModal={setShowQRModal}>
          <div className="bg-white dark:bg-theme-dark-card rounded-lg p-6 max-w-md mx-auto">
            <h2 className="text-2xl font-bold text-theme-text-primary dark:text-theme-dark-text mb-4 text-center">
              {t('coins.paymentQR')}
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
                {qrData.amount.toLocaleString()} VND
              </p>
              <p className="text-sm text-theme-text-secondary dark:text-theme-dark-text-secondary">
                {t('coins.paymentReference')}: {qrData.payment_reference}
              </p>
            </div>

            <div className="text-center mb-4">
              <div className="text-sm text-theme-text-secondary dark:text-theme-dark-text-secondary">
                {t('coins.timeRemaining')}: {formatTime(timeLeft)}
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
  );
} 