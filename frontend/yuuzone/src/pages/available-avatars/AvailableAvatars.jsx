import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import AuthConsumer from '../../components/AuthContext';
import Svg from '../../components/Svg';
import useRealtimeCoins from '../../hooks/useRealtimeCoins';

export default function AvailableAvatars() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isAuthenticated, user } = AuthConsumer();
  const { getOwnedAvatars } = useRealtimeCoins();
  const [ownedAvatars, setOwnedAvatars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [equipping, setEquipping] = useState(null);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    fetchOwnedAvatars();
  }, [isAuthenticated, navigate]);

  // Listen for real-time coin balance updates
  useEffect(() => {
    const handleCoinBalanceUpdate = (event) => {
      const { newBalance, transactionType, avatarName } = event.detail;
      
      // If an avatar was purchased, refresh the avatar list
      if (transactionType === 'avatar_purchase' && avatarName) {
        fetchOwnedAvatars();
      }
    };

    window.addEventListener('coinBalanceUpdated', handleCoinBalanceUpdate);

    return () => {
      window.removeEventListener('coinBalanceUpdated', handleCoinBalanceUpdate);
    };
  }, []);

  const fetchOwnedAvatars = async () => {
    try {
      setLoading(true);
      const ownedAvatarsData = await getOwnedAvatars();
      
      if (ownedAvatarsData) {
        setOwnedAvatars(ownedAvatarsData.avatars || ownedAvatarsData);
      }
    } catch (error) {
      toast.error(t('coins.fetchError'));
    } finally {
      setLoading(false);
    }
  };

  const handleEquipAvatar = async (avatarId) => {
    try {
      setEquipping(true);
      const response = await axios.put('/api/coins/avatars/equip', {
        avatar_id: avatarId
      });

      if (response.data.success) {
        toast.success(t('coins.avatarEquipped'));
        fetchOwnedAvatars(); // Refresh to update equipped status
      }
    } catch (error) {
      toast.error(error.response?.data?.error || t('coins.equipError'));
    } finally {
      setEquipping(false);
    }
  };

  const handleGoToShop = () => {
    navigate('/coin-shop');
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
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white dark:bg-theme-dark-card rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-theme-text-primary dark:text-theme-dark-text">
                {t('coins.availableAvatars')}
              </h1>
              <p className="text-theme-text-secondary dark:text-theme-dark-text-secondary mt-2">
                {t('coins.availableAvatarsDescription')}
              </p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400 flex items-center justify-end">
                <Svg type="coin" className="w-6 h-6 mr-2" />
                {user?.wallet?.coin_balance || 0} {t('coins.coins')}
              </div>
              <p className="text-sm text-theme-text-secondary dark:text-theme-dark-text-secondary">
                {t('coins.yourBalance')}
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="bg-white dark:bg-theme-dark-card rounded-lg shadow-md p-6">
          {!ownedAvatars || !Array.isArray(ownedAvatars) || ownedAvatars.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">👤</div>
              <h2 className="text-2xl font-bold text-theme-text-primary dark:text-theme-dark-text mb-4">
                {t('coins.noAvatarsOwned')}
              </h2>
              <p className="text-theme-text-secondary dark:text-theme-dark-text-secondary mb-6">
                {t('coins.noAvatarsDescription')}
              </p>
              <button
                onClick={handleGoToShop}
                className="bg-theme-blue text-white py-3 px-6 rounded-lg hover:bg-blue-600 transition-colors font-medium text-lg"
              >
                <Svg type="coin" className="w-5 h-5 mr-2" />
                {t('coins.goToAvatarShop')}
              </button>
            </div>
          ) : (
            <div>
              <h2 className="text-2xl font-bold text-theme-text-primary dark:text-theme-dark-text mb-6">
                {t('coins.yourAvatars')} ({ownedAvatars?.length || 0})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {(ownedAvatars || []).map((userAvatar) => {
                  const avatar = userAvatar.avatar_data;
                  if (!avatar) return null;

                  return (
                    <div
                      key={userAvatar.id}
                      className={`bg-theme-bg-primary dark:bg-theme-dark-bg rounded-lg border-2 p-4 hover:shadow-lg transition-shadow ${
                        userAvatar.is_equipped
                          ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                          : 'border-theme-border-light dark:border-theme-dark-border'
                      }`}
                    >
                      <div className="text-center">
                        <div className="relative mb-3">
                          <img
                            src={avatar.image_url}
                            alt={avatar.name}
                            className="w-24 h-24 mx-auto rounded-lg object-cover"
                            onError={(e) => {
                              e.target.src = 'https://via.placeholder.com/96x96?text=Avatar';
                            }}
                          />
                          {userAvatar.is_equipped && (
                            <div className="absolute -top-2 -right-2 bg-green-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs">
                              ✓
                            </div>
                          )}
                        </div>
                        <h3 className="text-lg font-bold text-theme-text-primary dark:text-theme-dark-text mb-2">
                          {avatar.name}
                        </h3>
                        <p className="text-sm text-theme-text-secondary dark:text-theme-dark-text-secondary mb-2">
                          {t('coins.by')} {avatar.creator_name || 'YuuZone'}
                        </p>
                        <p className="text-sm text-theme-text-secondary dark:text-theme-dark-text-secondary mb-4">
                          {t('coins.purchased')}: {new Date(userAvatar.purchased_at).toLocaleDateString()}
                        </p>
                        {userAvatar.is_equipped ? (
                          <div className="text-green-600 dark:text-green-400 font-medium">
                            {t('coins.equipped')}
                          </div>
                        ) : (
                          <button
                            onClick={() => handleEquipAvatar(avatar.id)}
                            disabled={equipping}
                            className="w-full bg-theme-blue text-white py-2 px-4 rounded-lg hover:bg-blue-600 transition-colors font-medium disabled:opacity-50"
                          >
                            {equipping ? t('coins.equipping') : t('coins.equip')}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              
              <div className="mt-8 text-center">
                <button
                  onClick={handleGoToShop}
                  className="bg-gray-500 text-white py-2 px-6 rounded-lg hover:bg-gray-600 transition-colors font-medium"
                >
                  <Svg type="coin" className="w-4 h-4 mr-2" />
                  {t('coins.buyMoreAvatars')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 