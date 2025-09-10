import { motion, AnimatePresence } from "framer-motion";
import PropTypes from "prop-types";
import { useCallback, useEffect, useRef, useState } from "react";
import ReactPlayer from "react-player";
import { useTranslation } from "react-i18next";
import Svg from "./Svg";

MediaPopup.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  mediaUrl: PropTypes.string.isRequired,
  mediaType: PropTypes.oneOf(['image', 'video']).isRequired,
  title: PropTypes.string,
  alt: PropTypes.string,
};

export default function MediaPopup({ isOpen, onClose, mediaUrl, mediaType, title, alt }) {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [showVideoPlayer, setShowVideoPlayer] = useState(false);
  const modalRef = useRef(null);

  // Utility functions
  const isImage = useCallback((url) => {
    return /(jpg|jpeg|png|webp|avif|gif|svg|image)/.test(url);
  }, []);

  const isValidYouTubeUrl = useCallback((url) => {
    if (!url || typeof url !== 'string') return false;
    const youtubePatterns = [
      /^(https?:\/\/)?(www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})(\S*)?$/,
      /^(https?:\/\/)?youtu\.be\/([a-zA-Z0-9_-]{11})(\S*)?$/,
      /^(https?:\/\/)?(www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]{11})(\S*)?$/,
      /^(https?:\/\/)?(www\.)?youtube\.com\/v\/([a-zA-Z0-9_-]{11})(\S*)?$/,
      /^(https?:\/\/)?m\.youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})(\S*)?$/,
      /^(https?:\/\/)?(www\.)?youtube\.com\/gaming\/watch\?v=([a-zA-Z0-9_-]{11})(\S*)?$/
    ];
    return youtubePatterns.some(pattern => pattern.test(url));
  }, []);

  const getYouTubeVideoId = useCallback((url) => {
    if (!url) return null;
    const youtuBeMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
    if (youtuBeMatch) return youtuBeMatch[1];
    const youtubeMatch = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
    if (youtubeMatch) return youtubeMatch[1];
    const embedMatch = url.match(/embed\/([a-zA-Z0-9_-]{11})/);
    if (embedMatch) return embedMatch[1];
    return null;
  }, []);

  const isValidVideoUrl = useCallback((url) => {
    if (!url || typeof url !== 'string') return false;
    if (isValidYouTubeUrl(url)) return true;
    if (/youtube\.com|youtu\.be/i.test(url)) return true;
    const videoExtensions = /\.(mp4|webm|ogg|avi|mov|wmv|flv|mkv)(\?.*)?$/i;
    if (videoExtensions.test(url)) return true;
    const supportedPlatforms = [
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
  }, [isValidYouTubeUrl]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden'; // Prevent background scrolling
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      setHasError(false);
      setShowVideoPlayer(false);
    }
  }, [isOpen]);

  const handleImageLoad = useCallback(() => {
    setIsLoading(false);
  }, []);

  const handleImageError = useCallback(() => {
    setIsLoading(false);
    setHasError(true);
  }, []);

  const handleVideoError = useCallback(() => {
    setIsLoading(false);
    setHasError(true);
  }, []);

  const handleVideoReady = useCallback(() => {
    setIsLoading(false);
  }, []);

  const handleThumbnailClick = useCallback(() => {
    setShowVideoPlayer(true);
  }, []);

  const handleBackdropClick = useCallback((e) => {
    if (e.target === modalRef.current) {
      onClose();
    }
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        ref={modalRef}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-90 p-4"
        onClick={handleBackdropClick}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="relative max-w-[90vw] max-h-[90vh] bg-theme-less-white dark:bg-theme-dark-bg rounded-lg shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-theme-border-light dark:border-theme-dark-border">
            <h3 className="text-lg font-semibold text-theme-text-primary dark:text-theme-dark-text">
              {title || (mediaType === 'image' ? t('media.imageViewer') : t('media.videoPlayer'))}
            </h3>
            <button
              onClick={onClose}
              className="p-2 hover:bg-theme-gray-blue dark:hover:bg-theme-dark-border rounded-full transition-colors"
            >
              <Svg type="close" className="w-5 h-5 text-theme-text-primary dark:text-theme-dark-text" />
            </button>
          </div>

          {/* Content */}
          <div className="relative">
            {mediaType === 'image' ? (
              <div className="relative">
                {isLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-theme-gray-blue dark:bg-theme-dark-border">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-theme-blue"></div>
                  </div>
                )}
                {hasError ? (
                  <div className="flex items-center justify-center w-full h-64 bg-theme-gray-blue dark:bg-theme-dark-border">
                    <div className="text-center">
                      <Svg type="image" className="w-12 h-12 mx-auto mb-2 text-theme-text-muted" />
                      <p className="text-theme-text-secondary dark:text-theme-dark-text">
                        {t('media.failedToLoadImage')}
                      </p>
                    </div>
                  </div>
                ) : (
                  <img
                    src={mediaUrl}
                    alt={alt || title || t('media.image')}
                    className="max-w-full max-h-[70vh] object-contain"
                    onLoad={handleImageLoad}
                    onError={handleImageError}
                    style={{ opacity: isLoading ? 0 : 1 }}
                  />
                )}
              </div>
            ) : (
              <div className="relative">
                {isValidVideoUrl(mediaUrl) ? (
                  isValidYouTubeUrl(mediaUrl) && !showVideoPlayer ? (
                    // YouTube thumbnail with play button
                    <div className="relative cursor-pointer" onClick={handleThumbnailClick}>
                      <img
                        src={`https://img.youtube.com/vi/${getYouTubeVideoId(mediaUrl)}/maxresdefault.jpg`}
                        alt="Video thumbnail"
                        className="max-w-full max-h-[70vh] object-contain"
                        onError={(e) => {
                          e.target.src = `https://img.youtube.com/vi/${getYouTubeVideoId(mediaUrl)}/hqdefault.jpg`;
                        }}
                      />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-20 h-20 bg-theme-dark-bg bg-opacity-70 rounded-md flex items-center justify-center">
                          <Svg type="play" className="w-10 h-10 text-theme-dark-text ml-1" />
                        </div>
                      </div>
                    </div>
                  ) : (
                    // Video player
                    <div className="relative">
                      {isLoading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-theme-gray-blue dark:bg-theme-dark-border z-10">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-theme-blue"></div>
                        </div>
                      )}
                      <ReactPlayer
                        url={mediaUrl}
                        width="100%"
                        height="auto"
                        controls
                        playing={showVideoPlayer}
                        onReady={handleVideoReady}
                        onError={handleVideoError}
                        config={{
                          youtube: {
                            playerVars: {
                              showinfo: 1,
                              origin: window.location.origin,
                              modestbranding: 1,
                              rel: 0,
                              autoplay: 1,
                              controls: 1,
                              disablekb: 0,
                              enablejsapi: 0,
                              fs: 1,
                              iv_load_policy: 3
                            },
                            preload: false
                          }
                        }}
                      />
                    </div>
                  )
                ) : (
                  <div className="flex items-center justify-center w-full h-64 bg-theme-gray-blue dark:bg-theme-dark-border">
                    <div className="text-center">
                      <Svg type="video" className="w-12 h-12 mx-auto mb-2 text-theme-text-muted" />
                      <p className="text-theme-text-secondary dark:text-theme-dark-text">
                        {t('media.invalidVideoUrl')}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-theme-border-light dark:border-theme-dark-border">
            <div className="flex items-center justify-between">
              <span className="text-sm text-theme-text-secondary dark:text-theme-dark-text">
                {mediaUrl}
              </span>
              <button
                onClick={() => window.open(mediaUrl, '_blank')}
                className="px-3 py-1 text-sm bg-theme-blue text-white rounded hover:bg-theme-blue-dark transition-colors"
              >
                {t('media.openInNewTab')}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
} 