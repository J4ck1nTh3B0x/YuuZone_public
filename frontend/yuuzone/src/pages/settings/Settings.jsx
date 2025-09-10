import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import AuthConsumer from "../../components/AuthContext";
import UpdateUser from "../../components/UpdateUser";
import Modal from "../../components/Modal";
import avatar from "../../assets/avatar.png";
import { toast } from 'react-toastify';
import CustomThemeEditor from "../../components/CustomThemeEditor";
import useRealtimeTranslationStats from "../../hooks/useRealtimeTranslationStats";
import useRealtimePurchaseHistory from "../../hooks/useRealtimePurchaseHistory";

// General Settings Component
const GeneralSettings = ({ user, language, handleLanguageChange, showUpdateProfile, setShowUpdateProfile, 
  newUsername, setNewUsername, newPassword, setNewPassword, confirmPassword, setConfirmPassword, 
  newEmail, setNewEmail, currentPassword, setCurrentPassword, showChangeUsername, setShowChangeUsername,
  showChangePassword, setShowChangePassword, showChangeEmail, setShowChangeEmail,
  handleUsernameChange, handlePasswordChange, handleEmailChange, setShowDeleteModal, 
  usernameLoading, passwordLoading, emailLoading, t }) => {
  return (
    <div className="space-y-6">
      {/* Update Profile */}
      <div className="border-b pb-4">
        <h3 className="text-lg font-semibold mb-2">{t('settings.profile')}</h3>
        <button
          onClick={() => setShowUpdateProfile(true)}
          className="px-4 py-2 bg-theme-blue text-white rounded-md hover:bg-blue-600"
        >
          {t('settings.updateProfile')}
        </button>
      </div>

      {/* Language Settings */}
      <div className="border-b pb-4">
        <h3 className="text-lg font-semibold mb-2 text-theme-text-primary dark:text-theme-dark-text">{t('settings.language')}</h3>
        <div className="flex space-x-2">
          {["ENG", "JAP", "VIE"].map((lang) => (
            <button
              key={lang}
              onClick={() => handleLanguageChange(lang)}
              className={`px-4 py-2 rounded-md ${
                language === lang
                  ? "bg-theme-blue text-white"
                  : "bg-gray-200 dark:bg-theme-dark-bg text-gray-700 dark:text-theme-dark-text hover:bg-gray-300 dark:hover:bg-theme-dark-hover"
              }`}
            >
              {lang}
            </button>
          ))}
        </div>
      </div>

      {/* Change Username */}
      <div className="border-b pb-4">
        <h3 className="text-lg font-semibold mb-2 text-theme-text-primary dark:text-theme-dark-text">{t('settings.username')}</h3>
        {!showChangeUsername ? (
          <button
            onClick={() => setShowChangeUsername(true)}
            className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 dark:bg-gray-600 dark:hover:bg-gray-700"
          >
            {t('settings.changeUsername')}
          </button>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); handleUsernameChange(); }} className="space-y-2">
            <input
              type="text"
              placeholder={t('settings.newUsername')}
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              autoComplete="username"
              maxLength={15}
              minLength={4}
              pattern="^[a-zA-Z][a-zA-Z0-9_]*$"
              title="Username must start with a letter and contain only letters, numbers, and underscores"
              className="w-full p-2 border rounded-md bg-theme-less-white dark:bg-theme-dark-bg dark:text-theme-dark-text dark:border-theme-dark-border dark:placeholder-theme-dark-placeholder-80"
            />
            <input
              type="password"
              placeholder={t('settings.currentPassword')}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
              className="w-full p-2 border rounded-md bg-theme-less-white dark:bg-theme-dark-bg dark:text-theme-dark-text dark:border-theme-dark-border dark:placeholder-theme-dark-placeholder-80"
            />
            <div className="flex space-x-2">
              <button
                type="submit"
                disabled={usernameLoading}
                className={`px-4 py-2 text-white rounded-md transition-colors duration-200 ${
                  usernameLoading 
                    ? 'bg-gray-400 cursor-not-allowed' 
                    : 'bg-theme-blue hover:bg-blue-600 dark:hover:bg-theme-blue-coral'
                }`}
              >
                {usernameLoading ? t('common.loading') : t('settings.update')}
              </button>
              <button
                type="button"
                disabled={usernameLoading}
                onClick={() => {
                  setShowChangeUsername(false);
                  setNewUsername("");
                  setCurrentPassword("");
                }}
                className={`px-4 py-2 text-white rounded-md transition-colors duration-200 ${
                  usernameLoading 
                    ? 'bg-gray-400 cursor-not-allowed' 
                    : 'bg-gray-500 hover:bg-gray-600 dark:bg-gray-600 dark:hover:bg-gray-700'
                }`}
              >
                {t('common.cancel')}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Change Password */}
      <div className="border-b pb-4">
        <h3 className="text-lg font-semibold mb-2 text-theme-text-primary dark:text-theme-dark-text">{t('settings.password')}</h3>
        {!showChangePassword ? (
          <button
            onClick={() => setShowChangePassword(true)}
            className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 dark:bg-gray-600 dark:hover:bg-gray-700"
          >
            {t('settings.changePassword')}
          </button>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); handlePasswordChange(); }} className="space-y-2">
            <input
              type="password"
              placeholder={t('settings.currentPassword')}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
              className="w-full p-2 border rounded-md bg-theme-less-white dark:bg-theme-dark-bg dark:text-theme-dark-text dark:border-theme-dark-border dark:placeholder-theme-dark-placeholder-80"
            />
            <input
              type="password"
              placeholder={t('settings.newPassword')}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              className="w-full p-2 border rounded-md bg-theme-less-white dark:bg-theme-dark-bg dark:text-theme-dark-text dark:border-theme-dark-border dark:placeholder-theme-dark-placeholder-80"
            />
            <input
              type="password"
              placeholder={t('settings.confirmPassword')}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              className="w-full p-2 border rounded-md bg-theme-less-white dark:bg-theme-dark-bg dark:text-theme-dark-text dark:border-theme-dark-border dark:placeholder-theme-dark-placeholder-80"
            />
            <div className="flex space-x-2">
              <button
                type="submit"
                disabled={passwordLoading}
                className={`px-4 py-2 text-white rounded-md transition-colors duration-200 ${
                  passwordLoading 
                    ? 'bg-gray-400 cursor-not-allowed' 
                    : 'bg-theme-blue hover:bg-blue-600 dark:hover:bg-theme-blue-coral'
                }`}
              >
                {passwordLoading ? t('common.loading') : t('settings.update')}
              </button>
              <button
                type="button"
                disabled={passwordLoading}
                onClick={() => {
                  setShowChangePassword(false);
                  setNewPassword("");
                  setConfirmPassword("");
                  setCurrentPassword("");
                }}
                className={`px-4 py-2 text-white rounded-md transition-colors duration-200 ${
                  passwordLoading 
                    ? 'bg-gray-400 cursor-not-allowed' 
                    : 'bg-gray-500 hover:bg-gray-600 dark:bg-gray-600 dark:hover:bg-gray-700'
                }`}
              >
                {t('common.cancel')}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Change Email */}
      <div className="border-b pb-4">
        <h3 className="text-lg font-semibold mb-2 text-theme-text-primary dark:text-theme-dark-text">{t('settings.email')}</h3>
        {!showChangeEmail ? (
          <button
            onClick={() => setShowChangeEmail(true)}
            className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 dark:bg-gray-600 dark:hover:bg-gray-700"
          >
            {t('settings.changeEmail')}
          </button>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); handleEmailChange(); }} className="space-y-2">
            <input
              type="email"
              name="email"
              id="email"
              autoComplete="email"
              placeholder={t('settings.newEmail')}
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className="w-full p-2 border rounded-md bg-theme-less-white dark:bg-theme-dark-bg dark:text-theme-dark-text dark:border-theme-dark-border dark:placeholder-theme-dark-placeholder-80"
            />
            <input
              type="password"
              placeholder={t('settings.currentPassword')}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
              className="w-full p-2 border rounded-md bg-theme-less-white dark:bg-theme-dark-bg dark:text-theme-dark-text dark:border-theme-dark-border dark:placeholder-theme-dark-placeholder-80"
            />
            <div className="flex space-x-2">
              <button
                type="submit"
                disabled={emailLoading}
                className={`px-4 py-2 text-white rounded-md transition-colors duration-200 ${
                  emailLoading 
                    ? 'bg-gray-400 cursor-not-allowed' 
                    : 'bg-theme-blue hover:bg-blue-600 dark:hover:bg-theme-blue-coral'
                }`}
              >
                {emailLoading ? t('common.loading') : t('settings.update')}
              </button>
              <button
                type="button"
                disabled={emailLoading}
                onClick={() => {
                  setShowChangeEmail(false);
                  setNewEmail("");
                  setCurrentPassword("");
                }}
                className={`px-4 py-2 text-white rounded-md transition-colors duration-200 ${
                  emailLoading 
                    ? 'bg-gray-400 cursor-not-allowed' 
                    : 'bg-gray-500 hover:bg-gray-600 dark:bg-gray-600 dark:hover:bg-gray-700'
                }`}
              >
                {t('common.cancel')}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Delete Account */}
      <div className="border-b pb-4">
        <h3 className="text-lg font-semibold mb-2 text-red-600 dark:text-red-400">{t('settings.dangerZone')}</h3>
        <button
          onClick={() => setShowDeleteModal(true)}
          className="px-4 py-2 !bg-red-600 !text-white rounded-md hover:!bg-red-700 dark:!bg-red-600 dark:hover:!bg-red-700"
        >
          {t('settings.deleteAccount')}
        </button>
      </div>
    </div>
  );
};

// Translation Settings Component
const TranslationSettings = ({ translationStats, loadingStats, translationHistory, loadingHistory, 
  selectedDate, setSelectedDate, showHistory, setShowHistory, fetchTranslationHistory, fetchTranslationStats, t }) => {
  return (
    <div className="space-y-6">
      <div className="border-b pb-4">
        <h3 className="text-lg font-semibold mb-2 text-theme-text-primary dark:text-theme-dark-text">
          {t('translation.translationUsage')}
        </h3>
        
        {loadingStats ? (
          <div className="text-gray-600 dark:text-gray-400">{t('common.loading')}...</div>
        ) : translationStats ? (
          <div className="space-y-3">
            {/* Translation Stats */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-blue-800 dark:text-blue-200 font-medium">
                    {t('translation.monthlyLimit')}:
                  </span>
                  <span className="text-blue-700 dark:text-blue-300 ml-2">
                    {translationStats.limit === -1 ? t('translation.translationUsageUnlimited') : translationStats.limit}
                  </span>
                </div>
                <div>
                  <span className="text-blue-800 dark:text-blue-200 font-medium">
                    {t('translation.translationsUsed')}:
                  </span>
                  <span className="text-blue-700 dark:text-blue-300 ml-2">
                    {translationStats.used}
                  </span>
                </div>
                <div>
                  <span className="text-blue-800 dark:text-blue-200 font-medium">
                    {t('translation.translationsRemaining')}:
                  </span>
                  <span className="text-blue-700 dark:text-blue-300 ml-2">
                    {translationStats.remaining === -1 ? t('translation.translationUsageUnlimited') : translationStats.remaining}
                  </span>
                </div>
                <div>
                  <span className="text-blue-800 dark:text-blue-200 font-medium">
                    {t('translation.translationUsageRole')}
                  </span>
                  <span className="text-blue-700 dark:text-blue-300 ml-2">
                    {translationStats.role === 'vip' ? t('translation.translationUsageVIP') :
                     translationStats.role === 'admin' ? t('translation.translationUsageAdmin') :
                     translationStats.role === 'mod' ? t('translation.translationUsageMod') :
                     translationStats.role === 'support' ? t('translation.translationUsageSupport') :
                     t('translation.translationUsageMember')}
                  </span>
                </div>
              </div>
              
              {/* Progress Bar */}
              {translationStats.limit !== -1 && (
                <div className="mt-3">
                  <div className="flex justify-between text-xs text-blue-600 dark:text-blue-400 mb-1">
                    <span>{t('translation.translationUsageDescription', { used: translationStats.used, limit: translationStats.limit })}</span>
                    <span>{Math.round((translationStats.used / translationStats.limit) * 100)}%</span>
                  </div>
                  <div className="w-full bg-blue-200 dark:bg-blue-800 rounded-full h-2">
                    <div 
                      className="bg-blue-600 dark:bg-blue-400 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${Math.min((translationStats.used / translationStats.limit) * 100, 100)}%` }}
                    ></div>
                  </div>
                </div>
              )}
              
              <div className="mt-3 text-xs text-blue-600 dark:text-blue-400">
                {t('translation.translationUsageReset')}
              </div>
            </div>
            
            {/* Translation History Section */}
            <div className="mt-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-md font-semibold text-blue-800 dark:text-blue-200">
                  {t('translation.translationHistory')}
                </h4>
                <button
                  onClick={() => {
                    setShowHistory(!showHistory);
                    if (!showHistory) {
                      fetchTranslationHistory();
                    }
                  }}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium"
                >
                  {showHistory ? t('translation.hideHistory') : t('translation.showHistory')}
                </button>
              </div>

              {showHistory && (
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  {/* Date Selector */}
                  <div className="flex items-center space-x-3 mb-4">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {t('translation.selectDate')}:
                    </label>
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => {
                        setSelectedDate(e.target.value);
                        fetchTranslationHistory(e.target.value);
                      }}
                      className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    />
                  </div>
            
                  {/* History List */}
                  {loadingHistory ? (
                    <div className="text-center py-4">
                      <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                      <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{t('common.loading')}...</p>
                    </div>
                  ) : translationHistory && Array.isArray(translationHistory) && translationHistory.length > 0 ? (
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {(translationHistory || []).map((item, index) => (
                        <div key={item.id || index} className="border border-gray-200 dark:border-gray-600 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center space-x-2">
                              <span className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded">
                                {item.post_id ? t('translation.post') : t('translation.comment')}
                              </span>
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                {new Date(item.translated_at).toLocaleTimeString()}
                              </span>
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {item.source_language} → {item.target_language}
                            </div>
                          </div>
                          
                          <div className="space-y-2">
                            <div>
                              <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                {t('translation.originalText')}:
                              </p>
                              <p className="text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 p-2 rounded">
                                {(item.original_text || '').length > 200 
                                  ? `${item.original_text.substring(0, 200)}...` 
                                  : item.original_text}
                              </p>
                            </div>
                                
                            <div>
                              <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                {t('translation.translatedText')}:
                              </p>
                              <p className="text-sm text-gray-600 dark:text-gray-400 bg-green-50 dark:bg-green-900/20 p-2 rounded">
                                {(item.translated_text || '').length > 200 
                                  ? `${item.translated_text.substring(0, 200)}...` 
                                  : item.translated_text}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {t('translation.noHistoryForDate')}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="text-gray-600 dark:text-gray-400">
            {t('translation.translationServiceUnavailable')}
          </div>
        )}
      </div>
    </div>
  );
};

// Subscription Settings Component
const SubscriptionSettings = ({ user, t, showThemeEditor, setShowThemeEditor, translationStats }) => {
  const navigate = useNavigate();
  const [subscriptionData, setSubscriptionData] = useState(null);
  const [userLimits, setUserLimits] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);

  useEffect(() => {
    // Optimize loading by using the new optimized endpoint
    const fetchData = async () => {
      setLoading(true);
      try {
        // Use the new optimized endpoint that returns all data in one call
        const response = await axios.get('/api/subscriptions/user/settings-data');
        const data = response.data;
        
        setSubscriptionData({
          current_tier: data.current_tier,
          subscriptions: data.subscriptions,
          user_subscription_types: data.user_subscription_types
        });
        setUserLimits(data.theme_slots);
      } catch (error) {
        try {
          // Fallback to the original endpoints
          const [tierResponse, limitsResponse] = await Promise.all([
            axios.get('/api/subscriptions/user/tier-status').catch(error => {
              return axios.get('/api/subscriptions/plans');
            }),
            axios.get('/api/subscriptions/themes/slots')
          ]);

          setSubscriptionData(tierResponse.data);
          setUserLimits(limitsResponse.data);
        } catch (fallbackError) {
          // Both endpoints failed
        }
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const getCurrentTierInfo = () => {
    // Check if user has active subscriptions first
    const hasActiveSubscription = subscriptionData?.subscriptions?.some(sub => 
      sub.status === 'active' || sub.status === 'pending'
    );
    
    // Check current tier from API response
    const currentTier = subscriptionData?.current_tier;
    
    // If user has active subscription or current tier is not free, they have access
    if (hasActiveSubscription || (currentTier && currentTier !== 'free')) {
      // Determine the actual tier
      let actualTier = currentTier;
      if (hasActiveSubscription && !currentTier) {
        // Fallback: check subscription types
        const subscriptionTypes = subscriptionData?.user_subscription_types || [];
        if (subscriptionTypes.includes('vip')) {
          actualTier = 'vip';
        } else if (subscriptionTypes.includes('support')) {
          actualTier = 'support';
        }
      }
      
      // Return tier info based on actual tier
      if (actualTier === 'support') {
        return {
          tier: 'support',
          name: 'Support',
          description: 'Support tier with enhanced features',
          daysRemaining: 29,
          benefits: [
            'Create up to 10 subthreads',
            'Custom theme support',
            'SUPPORT badge',
            'Priority support',
            'Enhanced file upload limits',
            'Increased translation limits'
          ]
        };
      } else if (actualTier === 'vip') {
        return {
          tier: 'vip',
          name: 'VIP',
          description: 'VIP tier with unlimited features',
          daysRemaining: 29,
          benefits: [
            'Unlimited subthreads',
            'Custom theme support',
            'VIP badge',
            'Priority support',
            'Unlimited file uploads',
            'Unlimited translations'
          ]
        };
      }
    }
    
    // Fallback for known support user (temporary workaround)
    const isKnownSupportUser = user?.username === 'kanw';
    if (isKnownSupportUser) {
      return {
        tier: 'support',
        name: 'Support',
        description: 'Support tier with enhanced features',
        daysRemaining: 29,
        benefits: [
          'Create up to 10 subthreads',
          'Custom theme support',
          'SUPPORT badge',
          'Priority support',
          'Enhanced file upload limits',
          'Increased translation limits'
        ]
      };
    }
    
    // Default to free tier
    return { 
      tier: 'free', 
      name: 'Free', 
      description: 'Basic user tier with limited features',
      daysRemaining: null,
      benefits: [
        'Create up to 3 subthreads',
        'Basic theme support',
        '10MB file upload limit',
`${translationStats?.limit || 100} translations per month`
      ]
    };
  };

  const handleCancelSubscription = async () => {
    try {
      setCancelling(true);
      const response = await axios.post('/api/subscriptions/cancel');
      
      if (response.data.success) {
        toast.success(t('subscription.cancellationSuccess'));
        setShowCancelModal(false);
        // Refresh subscription data
        const refreshResponse = await axios.get('/api/subscriptions/user/tier-status');
        setSubscriptionData(refreshResponse.data);
      }
    } catch (error) {
      toast.error(error.response?.data?.error || t('subscription.cancellationError'));
    } finally {
      setCancelling(false);
    }
  };

  const currentTier = subscriptionData ? getCurrentTierInfo() : {
    tier: 'loading',
    name: 'Loading...',
    description: 'Loading subscription data...',
    daysRemaining: null,
    benefits: []
  };
  
  return (
    <div className="space-y-6">
      <div className="border-b pb-4">
        <h3 className="text-lg font-semibold mb-2 text-theme-text-primary dark:text-theme-dark-text">
          {t('subscription.subscriptions')}
        </h3>
        
        {loading || !subscriptionData ? (
          <div className="text-gray-600 dark:text-gray-400">{t('common.loading')}...</div>
        ) : (
          <div className="space-y-4">
            {/* Current Subscription */}
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <h4 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-200">
                {t('subscription.currentSubscription')}
              </h4>
              
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-theme-blue"></div>
                  <span className="ml-3 text-gray-600 dark:text-gray-400">Loading subscription data...</span>
                </div>
              ) : (
                <>
                  <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h5 className="text-lg font-semibold text-blue-800 dark:text-blue-200">
                        {currentTier.name}
                      </h5>
                    </div>
                    <p className="text-sm text-blue-600 dark:text-blue-300 mb-3">
                      {currentTier.description}
                    </p>
                    
                    <div className="space-y-2">
                      {currentTier.benefits.map((benefit, index) => (
                        <div key={index} className="flex items-center text-sm text-blue-700 dark:text-blue-300">
                          <svg className="w-4 h-4 mr-2 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                          {benefit}
                        </div>
                      ))}
                    </div>

                    {currentTier.tier !== 'free' && currentTier.daysRemaining !== null && (
                      <div className="mb-3">
                        <div className="flex justify-between text-xs text-green-600 dark:text-green-400 mb-1">
                          <span>Subscription expires in {currentTier.daysRemaining} days</span>
                          <span>{Math.max(0, Math.round((currentTier.daysRemaining / 30) * 100))}% remaining</span>
                        </div>
                        <div className="w-full bg-green-200 dark:bg-green-800 rounded-full h-2">
                          <div 
                            className="bg-green-600 dark:bg-green-400 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${Math.max(0, Math.min((currentTier.daysRemaining / 30) * 100, 100))}%` }}
                          ></div>
                        </div>
                      </div>
                    )}
                    
                    {currentTier.tier !== 'free' && (
                      <div className="text-sm text-green-600 dark:text-green-400">
                        Your subscription is active and you have access to all {currentTier.name} features.
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>



            {/* Current Limits */}
            {userLimits && (
              <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
                <h4 className="text-purple-800 dark:text-purple-200 font-semibold mb-3">
                  {t('subscription.currentLimits')}:
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Theme Slots */}
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-purple-200 dark:border-purple-700">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-purple-700 dark:text-purple-300">
                        {t('subscription.themeSlots')}
                      </span>
                      <span className="text-xs text-purple-600 dark:text-purple-400">
                        {userLimits.used_slots}/{userLimits.total_slots}
                      </span>
                    </div>
                    <div className="w-full bg-purple-200 dark:bg-purple-800 rounded-full h-2">
                      <div 
                        className="bg-purple-600 dark:bg-purple-400 h-2 rounded-full transition-all duration-300"
                        style={{ 
                          width: `${userLimits.total_slots > 0 ? (userLimits.used_slots / userLimits.total_slots) * 100 : 0}%` 
                        }}
                      ></div>
                    </div>
                    <div className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                      {userLimits.available_slots > 0 
                        ? t('subscription.availableSlots', { count: userLimits.available_slots })
                        : t('subscription.noSlotsAvailable')
                      }
                    </div>
                  </div>

                  {/* Subthread Limit */}
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-purple-200 dark:border-purple-700">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-purple-700 dark:text-purple-300">
                        {t('subscription.subthreadLimit')}
                      </span>
                    </div>
                    <div className="text-lg font-semibold text-purple-800 dark:text-purple-200">
                      {currentTier.tier === 'vip' ? t('subscription.unlimited') : 
                       currentTier.tier === 'support' ? '10' : '3'}
                    </div>
                  </div>

                  {/* Upload Limit */}
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-purple-200 dark:border-purple-700">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-purple-700 dark:text-purple-300">
                        {t('subscription.uploadLimit')}
                      </span>
                    </div>
                    <div className="text-lg font-semibold text-purple-800 dark:text-purple-200">
                      {currentTier.tier === 'vip' ? '100MB' : 
                       currentTier.tier === 'support' ? '50MB' : '10MB'}
                    </div>
                  </div>

                  {/* Translation Limit */}
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-purple-200 dark:border-purple-700">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-purple-700 dark:text-purple-300">
                        {t('subscription.translationLimit')}
                      </span>
                    </div>
                    <div className="text-lg font-semibold text-purple-800 dark:text-purple-200">
                      {currentTier.tier === 'vip' ? t('subscription.unlimited') : 
                       currentTier.tier === 'support' ? `${translationStats?.limit || 500}/month` : `${translationStats?.limit || 100}/month`}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Custom Themes Section */}
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <h4 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-200">
                {t('themes.customThemes')}
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                {t('themes.createAndManageThemes')}
              </p>
              
              {loading || currentTier.tier === 'loading' ? (
                <div className="flex items-center justify-center py-6">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-theme-blue"></div>
                  <span className="ml-3 text-gray-600 dark:text-gray-400">Loading theme data...</span>
                </div>
              ) : currentTier.tier === 'free' ? (
                <div className="text-center py-6">
                  <div className="text-gray-400 dark:text-gray-500 text-4xl mb-3">🎨</div>
                  <p className="text-gray-500 dark:text-gray-400 mb-4">
                    {t('themes.upgradeToAccessThemes')}
                  </p>
                  <button
                    onClick={() => navigate('/subscriptions')}
                    className="bg-theme-blue hover:bg-theme-blue-coral text-white px-6 py-2 rounded-md transition-colors"
                  >
                    {t('subscription.buySubscription')}
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Quick Theme Actions */}
                  <div className="flex space-x-3">
                    {userLimits && userLimits.available_slots > 0 && (
                      <button
                        onClick={() => setShowThemeEditor(true)}
                        className="bg-theme-success hover:bg-theme-success-light text-white px-4 py-2 rounded-md transition-colors text-sm"
                      >
                        {t('themes.createNewTheme')}
                      </button>
                    )}
                    {userLimits && userLimits.used_slots > 0 && (
                      <button
                        onClick={() => setShowThemeEditor(true)}
                        className="bg-theme-blue hover:bg-theme-blue-coral text-white px-4 py-2 rounded-md transition-colors text-sm"
                      >
                        {t('themes.viewThemes')}
                      </button>
                    )}
                  </div>

                  {/* Theme Slots Summary */}
                  {userLimits && (
                    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">
                          {t('themes.themeSlots')}: {userLimits.used_slots}/{userLimits.total_slots}
                        </span>
                        <span className={`text-xs font-medium ${
                          userLimits.available_slots > 0 
                            ? 'text-theme-success' 
                            : 'text-theme-warning'
                        }`}>
                          {userLimits.available_slots > 0 
                            ? t('themes.availableSlots', { count: userLimits.available_slots })
                            : t('themes.noSlotsAvailable')
                          }
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Theme Editor Modal */}
            {showThemeEditor && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                      {t('themes.customThemes')}
                    </h3>
                    <button
                      onClick={() => setShowThemeEditor(false)}
                      className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <CustomThemeEditor 
                    disableModal={true} 
                    onThemeCreated={() => setShowThemeEditor(false)}
                    themeSlotsData={userLimits}
                  />
                </div>
              </div>
            )}

            {/* Subscription Management Buttons */}
            <div className="flex space-x-3">
              <button
                onClick={() => navigate('/subscriptions')}
                className="px-4 py-2 bg-theme-blue text-white rounded-md hover:bg-theme-blue-coral transition-colors"
              >
                {currentTier.tier === 'free' ? t('subscription.buySubscription') : t('subscription.manageSubscription')}
              </button>
              
              {/* Cancel Subscription Button - Only show for paid subscriptions */}
              {currentTier.tier !== 'free' && (
                <button
                  onClick={() => setShowCancelModal(true)}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                >
                  {t('subscription.cancelSubscription')}
                </button>
              )}
            </div>

            {/* Cancel Subscription Modal */}
            {showCancelModal && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
                  <div className="text-center">
                    <div className="text-red-500 text-6xl mb-4">⚠️</div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                      {t('subscription.cancelSubscriptionTitle')}
                    </h3>
                    <p className="text-gray-600 dark:text-gray-300 mb-6">
                      {t('subscription.cancelSubscriptionWarning')}
                    </p>
                    <p className="text-red-600 dark:text-red-400 text-sm mb-6">
                      {t('subscription.cancelSubscriptionImportant')}
                    </p>
                    <div className="flex space-x-3">
                      <button
                        onClick={handleCancelSubscription}
                        disabled={cancelling}
                        className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {cancelling ? t('common.loading') : t('subscription.confirmCancel')}
                      </button>
                      <button
                        onClick={() => setShowCancelModal(false)}
                        disabled={cancelling}
                        className="flex-1 px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {t('common.cancel')}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// PurchaseHistory Component
const PurchaseHistory = ({ t }) => {
  const [purchaseHistory, setPurchaseHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortOrder, setSortOrder] = useState('newest');
  const [newPurchases, setNewPurchases] = useState(new Set());

  // Initialize real-time purchase history updates
  useRealtimePurchaseHistory();

  useEffect(() => {
    fetchPurchaseHistory();
  }, []);

  // Listen for real-time purchase history updates
  useEffect(() => {
    const handlePurchaseHistoryUpdate = (event) => {
      const { type, purchaseType, purchaseData, purchaseId, newStatus } = event.detail;
      
      if (type === 'new_purchase') {
        // Add new purchase to the beginning of the list
        setPurchaseHistory(prevHistory => {
          const newPurchase = {
            ...purchaseData,
            id: purchaseData.id || `new_${Date.now()}`,
            created_at: purchaseData.created_at || new Date().toISOString()
          };
          
          // Check if purchase already exists (avoid duplicates)
          const exists = prevHistory.some(purchase => purchase.id === newPurchase.id);
          if (exists) {
            return prevHistory;
          }
          
          // Add to new purchases set for visual indicator
          setNewPurchases(prev => new Set([...prev, newPurchase.id]));
          
          // Remove from new purchases after 5 seconds
          setTimeout(() => {
            setNewPurchases(prev => {
              const updated = new Set(prev);
              updated.delete(newPurchase.id);
              return updated;
            });
          }, 5000);
          
          return [newPurchase, ...prevHistory];
        });
      } else if (type === 'status_update') {
        // Update purchase status
        setPurchaseHistory(prevHistory => 
          prevHistory.map(purchase => {
            if (purchase.id === purchaseId || purchase.id === `sub_${purchaseId}` || purchase.id === `coin_${purchaseId}` || purchase.id === `avatar_${purchaseId}` || purchase.id === `boost_${purchaseId}` || purchase.id === `tier_${purchaseId}`) {
              return {
                ...purchase,
                payment_status: newStatus,
                is_active: newStatus === 'completed' || newStatus === 'active'
              };
            }
            return purchase;
          })
        );
      }
    };

    // Add event listener for purchase history updates
    window.addEventListener('purchaseHistoryUpdated', handlePurchaseHistoryUpdate);

    return () => {
      // Clean up event listener
      window.removeEventListener('purchaseHistoryUpdated', handlePurchaseHistoryUpdate);
    };
  }, []);

  const fetchPurchaseHistory = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/subscriptions/purchase-history');
      if (response.data.success) {
        setPurchaseHistory(response.data.purchase_history);
      }
    } catch (error) {
      toast.error(t('settings.failedToLoadPurchaseHistory'));
    } finally {
      setLoading(false);
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'subscription':
        return '';
      case 'coin_purchase':
        return '';
      case 'avatar_purchase':
        return '';
      case 'post_boost':
        return '';
      case 'tier_purchase':
        return '';
      default:
        return '';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
      case 'active':
        return 'text-green-600 dark:text-green-400';
      case 'pending':
        return 'text-yellow-600 dark:text-yellow-400';
      case 'failed':
      case 'cancelled':
      case 'expired':
        return 'text-red-600 dark:text-red-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  const getPaymentStatus = (purchase) => {
    // Check if payment has expired
    if (purchase.expires_at) {
      const now = new Date();
      const expiresAt = new Date(purchase.expires_at);
      if (now > expiresAt && purchase.payment_status === 'pending') {
        return 'expired';
      }
    }
    return purchase.payment_status || (purchase.is_active ? 'active' : 'inactive');
  };

  const getPaymentMethod = (paymentMethod) => {
    // Change "momo" to "bank" since the system uses bank payments
    if (paymentMethod === 'momo') {
      return 'bank';
    }
    return paymentMethod;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatAmount = (amount, currency = 'VND') => {
    if (amount === null || amount === undefined) return 'N/A';
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: currency
    }).format(amount);
  };

  const filteredPurchases = purchaseHistory.filter(purchase => {
    const typeMatch = filterType === 'all' || purchase.type === filterType;
    const currentStatus = getPaymentStatus(purchase);
    const statusMatch = filterStatus === 'all' || currentStatus === filterStatus || purchase.is_active === (filterStatus === 'active');
    return typeMatch && statusMatch;
  });

  const sortedPurchases = [...filteredPurchases].sort((a, b) => {
    const dateA = new Date(a.created_at || 0);
    const dateB = new Date(b.created_at || 0);
    return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
  });

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">{t('settings.purchaseHistory')}</h3>
        <p className="text-theme-text-secondary dark:text-theme-dark-text-secondary">
          {t('settings.purchaseHistoryDescription')}
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div>
          <label className="block text-sm font-medium text-theme-text-primary dark:text-theme-dark-text mb-1">
            {t('settings.filterByType')}
          </label>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-2 border border-theme-border-light dark:border-theme-dark-border rounded-md bg-theme-bg-primary dark:bg-theme-dark-bg text-theme-text-primary dark:text-theme-dark-text"
          >
            <option value="all">{t('settings.allTypes')}</option>
            <option value="subscription">{t('settings.subscription')}</option>
            <option value="coin_purchase">{t('settings.coinPurchase')}</option>
            <option value="avatar_purchase">{t('settings.avatarPurchase')}</option>
            <option value="post_boost">{t('settings.postBoost')}</option>
            <option value="tier_purchase">{t('settings.tierPurchase')}</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-theme-text-primary dark:text-theme-dark-text mb-1">
            {t('settings.filterByStatus')}
          </label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 border border-theme-border-light dark:border-theme-dark-border rounded-md bg-theme-bg-primary dark:bg-theme-dark-bg text-theme-text-primary dark:text-theme-dark-text"
          >
            <option value="all">{t('settings.allStatuses')}</option>
            <option value="completed">{t('settings.completed')}</option>
            <option value="pending">{t('settings.pending')}</option>
            <option value="failed">{t('settings.failed')}</option>
            <option value="cancelled">{t('settings.cancelled')}</option>
            <option value="active">{t('settings.active')}</option>
            <option value="expired">{t('settings.expired')}</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-theme-text-primary dark:text-theme-dark-text mb-1">
            {t('settings.sortByDate')}
          </label>
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            className="px-3 py-2 border border-theme-border-light dark:border-theme-dark-border rounded-md bg-theme-bg-primary dark:bg-theme-dark-bg text-theme-text-primary dark:text-theme-dark-text"
          >
            <option value="newest">{t('settings.newestFirst')}</option>
            <option value="oldest">{t('settings.oldestFirst')}</option>
          </select>
        </div>
      </div>

      {/* Purchase History List */}
      {loading ? (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-theme-blue"></div>
          <p className="mt-2 text-sm text-theme-text-secondary dark:text-theme-dark-text-secondary">
            {t('settings.loading')}...
          </p>
        </div>
      ) : sortedPurchases && Array.isArray(sortedPurchases) && sortedPurchases.length > 0 ? (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-theme-text-secondary dark:text-theme-dark-text-secondary">
              {t('settings.totalPurchases')}: {sortedPurchases?.length || 0}
            </p>
          </div>
          
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {(sortedPurchases || []).map((purchase) => (
              <div
                key={purchase.id}
                className={`bg-theme-bg-primary dark:bg-theme-dark-bg border border-theme-border-light dark:border-theme-dark-border rounded-lg p-4 transition-all duration-300 ${
                  newPurchases.has(purchase.id) 
                    ? 'ring-2 ring-green-400 shadow-lg animate-pulse' 
                    : ''
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <h4 className="font-medium text-theme-text-primary dark:text-theme-dark-text">
                        {purchase.description || purchase.type}
                      </h4>
                      {newPurchases.has(purchase.id) && (
                        <span className="text-xs px-2 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-full animate-pulse">
                          {t('settings.new')}
                        </span>
                      )}
                      <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(getPaymentStatus(purchase))}`}>
                        {getPaymentStatus(purchase)}
                      </span>
                    </div>
                    
                    <div className="text-sm text-theme-text-secondary dark:text-theme-dark-text-secondary space-y-1">
                      <p>{t('settings.purchaseDate')}: {formatDate(purchase.created_at)}</p>
                      
                      {purchase.amount && (
                        <p>{t('settings.purchaseAmount')}: {formatAmount(purchase.amount, purchase.currency)}</p>
                      )}
                      
                      {purchase.coin_amount && (
                        <p>{t('settings.coinAmount')}: {purchase.coin_amount} {t('coins.coins')}</p>
                      )}
                      
                      {purchase.tier_name && (
                        <p>{t('settings.tierName')}: {purchase.tier_name}</p>
                      )}
                      
                      {purchase.avatar_name && (
                        <p>{t('settings.avatarName')}: {purchase.avatar_name}</p>
                      )}
                      
                      {purchase.post_id && (
                        <p>{t('settings.postId')}: #{purchase.post_id}</p>
                      )}
                      
                      {purchase.payment_method && (
                        <p>{t('settings.paymentMethod')}: {getPaymentMethod(purchase.payment_method)}</p>
                      )}
                      
                      {purchase.balance_after && (
                        <p>{t('settings.balanceAfter')}: {purchase.balance_after} {t('coins.coins')}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-8">
          <h3 className="text-lg font-medium text-theme-text-primary dark:text-theme-dark-text mb-2">
            {t('settings.noPurchases')}
          </h3>
          <p className="text-theme-text-secondary dark:text-theme-dark-text-secondary">
            {t('settings.noPurchasesDescription')}
          </p>
        </div>
      )}
    </div>
  );
};

export default function Settings() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, customTheme, setCustomTheme, updateUserData } = AuthConsumer();
  const { t, i18n } = useTranslation();
  
  // Initialize real-time translation stats updates
  const { 
    translationStats, 
    loadingStats, 
    fetchTranslationStats, 
    refreshTranslationStats 
  } = useRealtimeTranslationStats();
  
  const [activeTab, setActiveTab] = useState('general');
  const [showUpdateProfile, setShowUpdateProfile] = useState(false);
  const [language, setLanguage] = useState(() => {
    // Map i18n language codes to display codes
    const langMap = { 'en': 'ENG', 'ja': 'JAP', 'vi': 'VIE' };
    return langMap[i18n.language] || 'ENG';
  });
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [showChangeUsername, setShowChangeUsername] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showChangeEmail, setShowChangeEmail] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteDisabled, setDeleteDisabled] = useState(false);
  const [translationHistory, setTranslationHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [showHistory, setShowHistory] = useState(false);
  const [showThemeEditor, setShowThemeEditor] = useState(false);
  const [usernameLoading, setUsernameLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);

  // Handle URL parameters for direct tab access
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tabParam = urlParams.get('tab');
    if (tabParam && ['general', 'translation', 'themes', 'subscription'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, []);

  useEffect(() => {
    document.title = `${t('settings.settings')} - YuuZone`;
    return () => document.title = "YuuZone";
  }, [t]);

  // Fetch translation stats only when translation tab is active and not already fetched
  useEffect(() => {
    if (user && activeTab === 'translation' && !translationStats) {
      fetchTranslationStats();
    }
  }, [user, activeTab, translationStats, fetchTranslationStats]);

  const fetchTranslationHistory = async (date = selectedDate) => {
    setLoadingHistory(true);
    try {
      const response = await axios.get(`/api/translate/history?date=${date}`);
      setTranslationHistory(response.data.history);
    } catch (error) {
      toast.error(t('translation.failedToLoadHistory'));
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleLanguageChange = async (newLanguage) => {
    setLanguage(newLanguage);
    // Map display codes to i18n language codes
    const langMap = { 'ENG': 'en', 'JAP': 'ja', 'VIE': 'vi' };
    const i18nLang = langMap[newLanguage] || 'en';
    i18n.changeLanguage(i18nLang);
    // Save to localStorage for persistence
    localStorage.setItem('yuuzone_language', i18nLang);

    // Save to backend if user is authenticated
    if (user) {
      try {
        await axios.patch('/api/user/language', { language: i18nLang });
      } catch (error) {
        // console.error('Failed to save language preference:', error);
      }
    }
  };

  const handleDeleteAccount = async () => {
    const expectedText = `sudo rm ${user.username}`;
    if (deleteConfirmText !== expectedText) {
      toast.error(t('settings.pleaseTypeExactly', { text: expectedText }));
      return;
    }
    setDeleteLoading(true);
    setDeleteDisabled(true);
    try {
      // Request account deletion (sends verification email)
      await axios.post("/api/user/request-deletion");
      setShowDeleteModal(false);
      setDeleteConfirmText("");
      toast.success(t('settings.deletionVerificationSent'));
      setTimeout(() => {
        navigate("/login");
      }, 2000);
    } catch (error) {
      const errorMessage = error.response?.data?.user_message || t('settings.failedToDeleteAccount');
      toast.error(errorMessage);
      setDeleteLoading(false);
      setDeleteDisabled(false);
    }
  };

  const handleUsernameChange = async () => {
    if (!newUsername.trim()) {
      toast.error(t('settings.pleaseEnterNewUsername'));
      return;
    }

    // Client-side validation (same as backend)
    const trimmedUsername = newUsername.trim();
    
    if (trimmedUsername.length < 4 || trimmedUsername.length > 15) {
      toast.error(t('settings.usernameLengthError', { min: 4, max: 15 }));
      return;
    }

    // Validate username format (must start with letter, contain only letters, numbers, underscores)
    if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(trimmedUsername)) {
      toast.error(t('settings.usernameFormatError'));
      return;
    }

    // Check for reserved prefix
    if (trimmedUsername.startsWith('del_')) {
      toast.error(t('settings.usernameReservedPrefixError'));
      return;
    }

    if (usernameLoading) return; // Prevent spamming

    setUsernameLoading(true);
    try {
      const formData = new FormData();
      formData.append("username", trimmedUsername);
      formData.append("current_password", currentPassword);

      console.log('Sending username update request:', {
        username: trimmedUsername,
        hasPassword: !!currentPassword
      });

      const response = await axios.patch("/api/user/username", formData);
      console.log('Username update response:', response.data);
      
      // Update both query cache and AuthContext user state
      queryClient.setQueryData(["user"], () => response.data);
      
      // Update AuthContext user state immediately
      if (user && updateUserData) {
        updateUserData(response.data);
      }
      
      setShowChangeUsername(false);
      setNewUsername("");
      setCurrentPassword("");
      toast.success(t('settings.usernameUpdatedSuccessfully'));
    } catch (error) {
      console.error('Username update error:', error.response?.data || error.message);
      toast.error(error.response?.data?.message || t('settings.failedToUpdateUsername'));
    } finally {
      setUsernameLoading(false);
    }
  };

  const handlePasswordChange = async () => {
    if (!newPassword || !confirmPassword) {
      toast.error(t('settings.pleaseFillAllPasswordFields'));
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error(t('settings.passwordsDoNotMatch'));
      return;
    }

    if (passwordLoading) return; // Prevent spamming

    setPasswordLoading(true);
    try {
      const formData = new FormData();
      formData.append("new_password", newPassword);
      formData.append("current_password", currentPassword);

      console.log('Sending password update request:', {
        hasNewPassword: !!newPassword,
        hasCurrentPassword: !!currentPassword
      });

      const response = await axios.patch("/api/user/password", formData);
      console.log('Password update response:', response.data);
      
      setShowChangePassword(false);
      setNewPassword("");
      setConfirmPassword("");
      setCurrentPassword("");
      toast.success(t('settings.passwordUpdatedSuccessfully'));
    } catch (error) {
      console.error('Password update error:', error.response?.data || error.message);
      toast.error(error.response?.data?.message || t('settings.failedToUpdatePassword'));
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleEmailChange = async () => {
    if (!newEmail.trim()) {
      toast.error(t('settings.pleaseEnterNewEmail'));
      return;
    }

    if (emailLoading) return; // Prevent spamming

    setEmailLoading(true);
    try {
      const formData = new FormData();
      formData.append("email", newEmail);
      formData.append("current_password", currentPassword);

      console.log('Sending email update request:', {
        email: newEmail,
        hasPassword: !!currentPassword
      });

      const response = await axios.patch("/api/user/email", formData);
      console.log('Email update response:', response.data);
      
      // Update both query cache and AuthContext user state
      queryClient.setQueryData(["user"], () => response.data);
      
      // Update AuthContext user state immediately
      if (user && updateUserData) {
        updateUserData(response.data);
      }
      
      setShowChangeEmail(false);
      setNewEmail("");
      setCurrentPassword("");
      toast.success(t('settings.emailUpdatedSuccessfully'));
    } catch (error) {
      console.error('Email update error:', error.response?.data || error.message);
      toast.error(error.response?.data?.message || t('settings.failedToUpdateEmail'));
    } finally {
      setEmailLoading(false);
    }
  };

  const tabs = [
    { id: 'general', label: t('settings.generalSettings')},
    { id: 'translation', label: t('translation.translationUsage')},
    { id: 'subscription', label: t('subscription.subscriptions') },
    { id: 'purchase-history', label: t('settings.purchaseHistory') }
  ];

  return (
    <div className="flex flex-col flex-1 items-center w-full bg-theme-light-gray2 dark:bg-theme-dark-bg dark:text-theme-dark-text p-4">
      <div className="w-full max-w-4xl bg-theme-less-white dark:bg-theme-dark-card dark:text-theme-dark-text border border-theme-border-light dark:border-theme-dark-border rounded-md p-6 shadow-md">
        <h1 className="text-2xl font-bold mb-6 text-center text-theme-text-primary dark:text-theme-dark-text">{t('settings.settings')}</h1>
        
        {/* User Info Section */}
        <div className="flex items-center space-x-4 p-4 bg-theme-light-gray2 dark:bg-theme-dark-bg rounded-md mb-6">
          <img
            src={user.avatar || avatar}
            alt={t('settings.userAvatar')}
            className="w-16 h-16 rounded-md object-cover"
          />
          <div>
            <h2 className="text-lg font-semibold text-theme-text-primary dark:text-theme-dark-text">{user.username}</h2>
            <p className="text-theme-text-secondary dark:text-theme-dark-text">{t('settings.karma')}: {user.karma.user_karma}</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex space-x-1 mb-6 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center space-x-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-white dark:bg-gray-700 text-theme-blue shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="min-h-[400px]">
          {activeTab === 'general' && (
            <GeneralSettings
              user={user}
              language={language}
              handleLanguageChange={handleLanguageChange}
              showUpdateProfile={showUpdateProfile}
              setShowUpdateProfile={setShowUpdateProfile}
              newUsername={newUsername}
              setNewUsername={setNewUsername}
              newPassword={newPassword}
              setNewPassword={setNewPassword}
              confirmPassword={confirmPassword}
              setConfirmPassword={setConfirmPassword}
              newEmail={newEmail}
              setNewEmail={setNewEmail}
              currentPassword={currentPassword}
              setCurrentPassword={setCurrentPassword}
              showChangeUsername={showChangeUsername}
              setShowChangeUsername={setShowChangeUsername}
              showChangePassword={showChangePassword}
              setShowChangePassword={setShowChangePassword}
              showChangeEmail={showChangeEmail}
              setShowChangeEmail={setShowChangeEmail}
              handleUsernameChange={handleUsernameChange}
              handlePasswordChange={handlePasswordChange}
              handleEmailChange={handleEmailChange}
              setShowDeleteModal={setShowDeleteModal}
              usernameLoading={usernameLoading}
              passwordLoading={passwordLoading}
              emailLoading={emailLoading}
              t={t}
            />
          )}
          
          {activeTab === 'translation' && (
            <TranslationSettings
              translationStats={translationStats}
              loadingStats={loadingStats}
              translationHistory={translationHistory}
              loadingHistory={loadingHistory}
              selectedDate={selectedDate}
              setSelectedDate={setSelectedDate}
              showHistory={showHistory}
              setShowHistory={setShowHistory}
              fetchTranslationHistory={fetchTranslationHistory}
              fetchTranslationStats={() => {}} // No need to call fetchTranslationStats here, it's handled by useRealtimeTranslationStats
              t={t}
            />
          )}
          


          {activeTab === 'subscription' && (
            <SubscriptionSettings
              user={user}
              t={t}
              showThemeEditor={showThemeEditor}
              setShowThemeEditor={setShowThemeEditor}
              translationStats={translationStats}
            />
          )}

          {activeTab === 'purchase-history' && (
            <PurchaseHistory t={t} />
          )}
        </div>
      </div>

      {/* Delete Modal */}
      {showDeleteModal && (
        <Modal setShowModal={setShowDeleteModal}>
          <div className="bg-theme-less-white dark:bg-theme-dark-card p-6 rounded-md shadow-md w-full max-w-md">
            <h2 className="text-xl font-bold text-red-600 dark:text-red-400 mb-4 text-center">{t('settings.deleteAccount')}</h2>
            <p className="mb-2 text-gray-700 dark:text-gray-300 text-center">{t('settings.deleteAccountConfirm')}</p>
            <p className="mb-2 text-gray-700 dark:text-gray-300 text-center">{t('settings.deleteConfirmation', { username: user.username })}</p>
            <input
              type="text"
              placeholder={`sudo rm ${user.username}`}
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              className="w-full p-2 border rounded-md bg-theme-light-gray2 dark:bg-theme-dark-bg dark:text-theme-dark-text dark:border-theme-dark-border dark:placeholder-theme-dark-placeholder-80 mt-2 mb-4"
              disabled={deleteDisabled}
            />
            <div className="flex space-x-2 justify-center">
              <button
                onClick={handleDeleteAccount}
                className="px-4 py-2 !bg-red-600 !text-white rounded-md hover:!bg-red-700 dark:!bg-red-600 dark:hover:!bg-red-700 disabled:opacity-50"
                disabled={deleteDisabled || deleteLoading}
              >
                {deleteLoading ? t('common.loading') : t('settings.deleteAccount')}
              </button>
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 dark:bg-gray-600 dark:hover:bg-gray-700"
                disabled={deleteDisabled}
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Update Profile Modal */}
      {showUpdateProfile && (
        <Modal showModal={showUpdateProfile} setShowModal={setShowUpdateProfile}>
          <UpdateUser setModal={setShowUpdateProfile} />
        </Modal>
      )}
    </div>
  );
}
