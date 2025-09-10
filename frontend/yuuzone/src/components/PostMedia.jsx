import { memo, useCallback, useState, useRef } from "react";
import PropTypes from "prop-types";
import { useInView } from "framer-motion";
import ReactPlayer from "react-player";
import Svg from "./Svg";

const PostMedia = memo(({ mediaUrl, isExpanded, onMediaClick }) => {
  const [showVideoPlayer, setShowVideoPlayer] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  
  // Use intersection observer for lazy loading
  const mediaRef = useRef(null);
  const inView = useInView(mediaRef, {
    once: true,
    margin: "50px"
  });

  // Utility functions for media detection
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

  // Enhanced video detection
  const isVideo = mediaUrl && (isValidVideoUrl(mediaUrl) || mediaUrl.includes('.mp4') || mediaUrl.includes('.webm') || mediaUrl.includes('.mov') || mediaUrl.includes('.avi'));

  const handleImageClick = useCallback(() => {
    if (onMediaClick) {
      onMediaClick('image');
    }
  }, [onMediaClick]);

  const handleVideoClick = useCallback(() => {
    if (onMediaClick) {
      onMediaClick('video');
    }
  }, [onMediaClick]);

  const handleVideoPlay = useCallback(() => {
    setShowVideoPlayer(true);
  }, []);

  if (!mediaUrl) return null;

  return (
    <div ref={mediaRef} className="relative">
      {isVideo ? (
        <div 
          className={`relative cursor-pointer overflow-hidden rounded-lg ${
            isExpanded ? 'max-w-full' : 'max-w-sm'
          }`}
          onClick={handleVideoClick}
        >
          {inView && (
            <ReactPlayer
              url={mediaUrl}
              width="100%"
              height={isExpanded ? "auto" : "200px"}
              controls={false}
              playing={false}
              light={true}
              style={{ borderRadius: '8px' }}
            />
          )}
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30 hover:bg-opacity-50 transition-all duration-200">
            <Svg type="play" className="w-12 h-12 text-white" />
          </div>
        </div>
      ) : (
        <img
          src={mediaUrl}
          alt="Post media"
          className={`cursor-pointer rounded-lg transition-all duration-200 hover:scale-[1.02] ${
            isExpanded ? 'max-w-full h-auto' : 'max-w-sm max-h-96 object-cover'
          }`}
          onClick={handleImageClick}
          onLoad={() => setImageLoaded(true)}
          onError={(e) => {
            e.target.style.display = 'none';
            if (e.target.nextSibling) {
              e.target.nextSibling.style.display = 'flex';
            }
          }}
          style={{ 
            opacity: imageLoaded ? 1 : 0,
            transition: 'opacity 0.3s ease-in-out'
          }}
        />
      )}
    </div>
  );
});

PostMedia.propTypes = {
  mediaUrl: PropTypes.string,
  isExpanded: PropTypes.bool,
  onMediaClick: PropTypes.func,
};

export default PostMedia; 