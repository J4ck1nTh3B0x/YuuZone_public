import AuthConsumer from "./AuthContext";
import PropTypes from "prop-types";
import avatar from "../assets/avatar.png";
import { useEffect, useState, useCallback } from "react";
import { toast } from 'react-toastify';
import axios from "axios";
import { focusManager, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import Svg from "./Svg";
import useRealtimeCoins from "../hooks/useRealtimeCoins";

UpdateUser.propTypes = {
  setModal: PropTypes.func,
};

export default function UpdateUser({ setModal }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { user } = AuthConsumer();
  const { getOwnedAvatars, clearAllCoinCache } = useRealtimeCoins();
  const [bio, setBio] = useState(user.bio);
  const [media, setMedia] = useState("");
  const [mediaType, setMediaType] = useState("image");
  const [imageUrl, setImageUrl] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [ownedAvatars, setOwnedAvatars] = useState([]);
  const [loadingAvatars, setLoadingAvatars] = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState(null);

  // Utility functions for media handling
  const isImage = useCallback((url) => {
    return /(jpg|jpeg|png|webp|avif|gif|svg|image)/.test(url);
  }, []);

  const isValidVideoUrl = useCallback((url) => {
    if (!url || typeof url !== 'string') return false;
    const videoExtensions = /\.(mp4|webm|ogg|avi|mov|wmv|flv|mkv)(\?.*)?$/i;
    if (videoExtensions.test(url)) return true;
    const supportedPlatforms = [
      /youtube\.com|youtu\.be/i,
      /vimeo\.com/,
      /dailymotion\.com/,
      /facebook\.com.*\/videos/,
      /twitch\.tv/,
      /streamable\.com/,
      /tiktok\.com/,
      /instagram\.com.*\/reel/,
      /twitter\.com.*\/video/,
      /x\.com.*\/video/
    ];
    return supportedPlatforms.some(pattern => pattern.test(url));
  }, []);

  const handleMediaPreview = useCallback(() => {
    let url = "";
    if (mediaType === "image" && media) {
      url = URL.createObjectURL(media);
    } else if (mediaType === "url" && imageUrl) {
      url = imageUrl;
    } else if (mediaType === "available_avatar" && selectedAvatar) {
      url = selectedAvatar.avatar_data.image_url;
    }
    
    if (url) {
      setPreviewUrl(url);
      setShowModal(true);
    }
  }, [mediaType, media, imageUrl, selectedAvatar]);

  const handleModalClose = useCallback(() => {
    setShowModal(false);
    // Clean up object URL if it was created
    if (mediaType === "image" && media && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
  }, [mediaType, media, previewUrl]);

  const handleBackdropClick = useCallback((e) => {
    if (e.target === e.currentTarget) {
      handleModalClose();
    }
  }, [handleModalClose]);

  // Fetch owned avatars when needed
  const fetchOwnedAvatars = useCallback(async () => {
    try {
      setLoadingAvatars(true);
      console.log('🔍 Fetching owned avatars...');
      
      // Force a fresh fetch by clearing cache first
      if (clearAllCoinCache) {
        clearAllCoinCache();
      }
      
      const ownedAvatarsData = await getOwnedAvatars();
      console.log('🔍 getOwnedAvatars returned:', ownedAvatarsData);
      
      if (ownedAvatarsData) {
        const avatars = ownedAvatarsData.avatars || ownedAvatarsData;
        console.log('🔍 Setting avatars:', avatars);
        console.log('🔍 Avatars type:', typeof avatars);
        console.log('🔍 Avatars is array:', Array.isArray(avatars));
        console.log('🔍 Avatars length:', avatars?.length);
        setOwnedAvatars(avatars);
      } else {
        console.log('🔍 No avatar data returned');
        setOwnedAvatars([]);
      }
    } catch (error) {
      console.error('🔍 Error fetching avatars:', error);
      toast.error(t('coins.fetchError'));
      setOwnedAvatars([]);
    } finally {
      setLoadingAvatars(false);
    }
  }, [t, getOwnedAvatars, clearAllCoinCache]);

  // Handle avatar selection
  const handleAvatarSelect = useCallback((userAvatar) => {
    setSelectedAvatar(userAvatar);
    setShowAvatarModal(false);
  }, []);

  // Reset selected avatar when media type changes
  useEffect(() => {
    if (mediaType !== "available_avatar") {
      setSelectedAvatar(null);
      setShowAvatarModal(false);
    } else {
      // Automatically open the avatar modal when "Available Avatar" is selected
      setShowAvatarModal(true);
    }
  }, [mediaType]);

  // Fetch avatars when avatar modal is opened
  useEffect(() => {
    if (showAvatarModal && (!ownedAvatars || !Array.isArray(ownedAvatars) || ownedAvatars.length === 0)) {
      fetchOwnedAvatars();
    }
  }, [showAvatarModal, ownedAvatars?.length, fetchOwnedAvatars]);

  async function handleSubmit(e) {
    e?.preventDefault();
    const formData = new FormData();
    formData.append("bio", bio);
    formData.append("content_type", mediaType);
    formData.append("content_url", imageUrl);
    
    if (mediaType === "image" && media) {
      formData.append("avatar", media, media.name);
    } else if (mediaType === "available_avatar" && selectedAvatar) {
      formData.append("avatar_id", selectedAvatar.avatar_id);
    }
    
    await axios
      .patch("/api/user", formData, { headers: { "Content-Type": "multipart/form-data" } })
      .then((res) => {
        setModal(false);
        queryClient.setQueryData(["user", user.username], () => res.data);
        queryClient.setQueryData(["user"], () => res.data);
      })
      .catch((err) => toast.error(`${err.message} ${t('alerts.checkYourFields')}`));
  }

  useEffect(() => {
    focusManager.setFocused(false);
    return () => {
      focusManager.setFocused(true);
      // Clean up object URL on unmount
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  return (
    <>
      <div className="flex flex-col p-5 space-y-5 w-5/6 rounded-md min-h-3/6 md:w-3/4 md:p-10 bg-theme-light-gray2 dark:bg-theme-dark-card dark:text-theme-dark-text">
        <div className="flex flex-col justify-between items-center p-4 space-y-3 bg-theme-less-white dark:bg-theme-dark-bg rounded-lg md:flex-row md:space-y-0">
          <p className="text-theme-text-primary dark:text-theme-dark-text">Updating Profile for</p>
          <img src={user.avatar || avatar} className="object-cover w-10 h-10 rounded-md md:w-14 md:h-14" alt="" />
          <p className="text-theme-text-primary dark:text-theme-dark-text">{user.username}</p>
        </div>
        <form className="flex flex-col p-5 space-y-5 bg-theme-less-white dark:bg-theme-dark-bg rounded-md" onSubmit={handleSubmit}>
          <label htmlFor="bio" className="flex flex-col p-2 md:space-x-3 md:flex-row">
            <span className="text-sm font-light text-theme-text-primary dark:text-theme-dark-text">Bio</span>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              type="text"
              name="bio"
              id="bio"
              className="w-full h-20 max-h-28 border-b border-gray-800 dark:border-theme-dark-border focus:outline-none bg-transparent dark:text-theme-dark-text dark:placeholder-theme-dark-placeholder-80"
            />
          </label>
          <label htmlFor="media" className="flex flex-col items-center space-y-3 md:space-y-0 md:space-x-5 md:flex-row">
            <select
              className="px-10 py-2 bg-theme-less-white dark:bg-theme-dark-bg rounded-md border dark:border-theme-dark-border md:px-12 dark:text-theme-dark-text"
              name="media"
              id="media"
              onChange={(e) => setMediaType(e.target.value)}>
              <option value="image" className="dark:bg-theme-dark-bg dark:text-theme-dark-text">Image</option>
              <option value="url" className="dark:bg-theme-dark-bg dark:text-theme-dark-text">URL</option>
              <option value="available_avatar" className="dark:bg-theme-dark-bg dark:text-theme-dark-text">{t('coins.availableAvatar')}</option>
            </select>
            {mediaType === "image" ? (
              <input
                onChange={(e) => {
                  if (e.target.files[0].size > 10485760) {
                    toast.error(t('alerts.fileTooLarge'));
                  } else {
                    setMedia(e.target.files[0]);
                  }
                }}
                type="file"
                name="file"
                accept="image/*"
                id="image"
                className="w-full focus:outline-none dark:text-theme-dark-text"
              />
            ) : mediaType === "url" ? (
              <input
                type="text"
                name="media_url"
                id="media_url"
                className="p-2 w-full rounded-md border border-gray-800 dark:border-theme-dark-border focus:outline-none bg-theme-less-white dark:bg-theme-dark-bg dark:text-theme-dark-text dark:placeholder-theme-dark-placeholder-80"
                onChange={(e) => setImageUrl(e.target.value)}
              />
            ) : (
              <div className="flex flex-col space-y-2 w-full">
                {selectedAvatar ? (
                  <div className="flex items-center space-x-3 p-2 bg-theme-light-gray2 dark:bg-theme-dark-bg rounded-md">
                    <img
                      src={selectedAvatar.avatar_data.image_url}
                      alt={selectedAvatar.avatar_data.name}
                      className="w-12 h-12 rounded-md object-cover"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-theme-text-primary dark:text-theme-dark-text">
                        {selectedAvatar.avatar_data.name}
                      </p>
                      <p className="text-xs text-theme-text-secondary dark:text-theme-dark-text-secondary">
                        {t('coins.chooseFromOwned')}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedAvatar(null)}
                      className="text-red-500 hover:text-red-700"
                    >
                      ×
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2 px-4 py-2 bg-theme-light-gray2 dark:bg-theme-dark-bg rounded-md border border-gray-300 dark:border-theme-dark-border">
                    <Svg type="user" className="w-4 h-4 text-gray-500" />
                    <span className="text-sm text-gray-500 dark:text-theme-dark-text-secondary">
                      {t('coins.selectAvatar')}
                    </span>
                  </div>
                )}
              </div>
            )}
          </label>
          
          {/* Preview button */}
          {(mediaType === "image" && media) || (mediaType === "url" && imageUrl) || (mediaType === "available_avatar" && selectedAvatar) ? (
            <button
              type="button"
              onClick={handleMediaPreview}
              className="px-4 py-2 bg-theme-bg-secondary dark:bg-theme-dark-bg text-theme-text-primary dark:text-theme-dark-text rounded-md hover:bg-theme-bg-tertiary dark:hover:bg-theme-dark-card transition-colors"
            >
              {t('coins.previewAvatar')}
            </button>
          ) : null}

          <span className="text-sm font-semibold text-red-500 dark:text-red-400">
            Only Add Image if you want to modify the original image if empty the original will be used.
          </span>

          <button
            onClick={handleSubmit}
            className="py-2 font-semibold text-white rounded-md bg-theme-blue active:scale-95 dark:bg-theme-blue dark:hover:bg-theme-blue-coral">
            {t('common.submit')}
          </button>
        </form>
      </div>

      {/* Avatar Selection Modal */}
      {showAvatarModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-theme-less-white dark:bg-theme-dark-card p-6 rounded-md shadow-md max-w-4xl w-full max-h-[80vh] overflow-y-auto dark:text-theme-dark-text">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold dark:text-theme-dark-text-secondary">
                {t('coins.selectAvatar')}
              </h3>
              <button
                onClick={() => setShowAvatarModal(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                ×
              </button>
            </div>
            
            {loadingAvatars ? (
              <div className="flex justify-center items-center py-8">
                <div className="w-8 h-8 border-4 border-theme-blue border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : !ownedAvatars || !Array.isArray(ownedAvatars) || ownedAvatars.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-4xl mb-4">👤</div>
                <h4 className="text-lg font-medium text-theme-text-primary dark:text-theme-dark-text mb-2">
                  {t('coins.noAvatarsOwned')}
                </h4>
                <p className="text-theme-text-secondary dark:text-theme-dark-text-secondary mb-4">
                  {t('coins.noAvatarsDescription')}
                </p>
                <button
                  onClick={() => {
                    setShowAvatarModal(false);
                    navigate('/coin-shop');
                  }}
                  className="bg-theme-blue text-white py-2 px-4 rounded-md hover:bg-blue-600 transition-colors"
                >
                  {t('coins.goToAvatarShop')}
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {(ownedAvatars || []).map((userAvatar) => {
                  const avatar = userAvatar.avatar_data;
                  if (!avatar) return null;

                  return (
                    <div
                      key={userAvatar.id}
                      className={`bg-theme-bg-primary dark:bg-theme-dark-bg rounded-lg border-2 p-4 hover:shadow-lg transition-shadow cursor-pointer ${
                        userAvatar.is_equipped
                          ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                          : 'border-theme-border-light dark:border-theme-dark-border'
                      }`}
                      onClick={() => handleAvatarSelect(userAvatar)}
                    >
                      <div className="text-center">
                        <div className="relative mb-3">
                          <img
                            src={avatar.image_url}
                            alt={avatar.name}
                            className="w-20 h-20 mx-auto rounded-lg object-cover"
                            onError={(e) => {
                              e.target.src = 'https://via.placeholder.com/80x80?text=Avatar';
                            }}
                          />
                          {userAvatar.is_equipped && (
                            <div className="absolute -top-2 -right-2 bg-green-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">
                              ✓
                            </div>
                          )}
                        </div>
                        <h4 className="text-sm font-medium text-theme-text-primary dark:text-theme-dark-text mb-1">
                          {avatar.name}
                        </h4>
                        <p className="text-xs text-theme-text-secondary dark:text-theme-dark-text-secondary">
                          {userAvatar.is_equipped ? t('coins.equipped') : t('coins.owned')}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Media Preview Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-75 z-50"
            onClick={handleBackdropClick}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="relative max-w-4xl max-h-[90vh] overflow-auto bg-white dark:bg-theme-dark-card rounded-lg shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-theme-dark-border">
                <h3 className="text-lg font-semibold text-theme-text-primary dark:text-theme-dark-text">
                  {t('coins.previewAvatar')}
                </h3>
                <button
                  onClick={handleModalClose}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-2xl"
                >
                  ×
                </button>
              </div>

              {/* Content */}
              <div className="relative">
                {isImage(previewUrl) ? (
                  <div className="relative">
                    <img
                      src={previewUrl}
                      alt="Preview"
                      className="max-w-full max-h-[70vh] object-contain"
                    />
                  </div>
                ) : (
                  <div className="relative w-full h-96">
                    <iframe
                      src={previewUrl}
                      className="w-full h-full"
                      frameBorder="0"
                      allowFullScreen
                      title="Video Preview"
                    />
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
