import { useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import Markdown from "markdown-to-jsx";
import PropTypes from "prop-types";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { toast } from 'react-toastify';
import avatar from "../assets/avatar.png";
import AuthConsumer from "./AuthContext";
import Loader from "./Loader";
import Svg from "./Svg";
import { handleRateLimitError } from "../utils/formProtection";
import { useProtectedButton } from "../utils/buttonProtection";
import useRealtimePosts from "../hooks/useRealtimePosts";

NewPost.propTypes = {
  setShowModal: PropTypes.func,
  isEdit: PropTypes.bool,
  postInfo: PropTypes.object,
  threadInfo: PropTypes.object,
};

export default function NewPost({ setShowModal, isEdit = false, postInfo = {}, threadInfo = {} }) {
  const { t } = useTranslation();
  const { socket, user } = AuthConsumer();
  const queryClient = useQueryClient();
  const { addOptimisticPost } = useRealtimePosts({
    enableOptimisticUpdates: true,
    preserveScrollPosition: true
  });
  const [title, setTitle] = useState(postInfo?.title || "");
  const [content, setContent] = useState(postInfo?.content || "");
  const [media, setMedia] = useState([]);
  const [preMd, setPreMd] = useState(false);
  const [mediaType, setMediaType] = useState("media");
  const [imageUrl, setImageUrl] = useState("");
  const [urlError, setUrlError] = useState("");
  const [thread, setThread] = useState(isEdit ? { id: threadInfo.thread_id, name: threadInfo.thread_name } : false);
  const [showSuccessIndicator, setShowSuccessIndicator] = useState(false);

  // URL validation functions
  function isValidYouTubeUrl(url) {
    if (!url || typeof url !== 'string') return false;

    // More comprehensive YouTube URL patterns
    const youtubePatterns = [
      // Standard youtube.com URLs
      /^(https?:\/\/)?(www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})(\S*)?$/,
      // youtu.be short URLs
      /^(https?:\/\/)?youtu\.be\/([a-zA-Z0-9_-]{11})(\S*)?$/,
      // YouTube embed URLs
      /^(https?:\/\/)?(www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]{11})(\S*)?$/,
      // YouTube v/ URLs
      /^(https?:\/\/)?(www\.)?youtube\.com\/v\/([a-zA-Z0-9_-]{11})(\S*)?$/,
      // YouTube mobile URLs
      /^(https?:\/\/)?m\.youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})(\S*)?$/,
      // YouTube gaming URLs
      /^(https?:\/\/)?(www\.)?youtube\.com\/gaming\/watch\?v=([a-zA-Z0-9_-]{11})(\S*)?$/
    ];

    return youtubePatterns.some(pattern => pattern.test(url));
  }

  function isValidVideoUrl(url) {
    if (!url || typeof url !== 'string') return false;

    // Check for YouTube URLs (including more flexible patterns)
    if (isValidYouTubeUrl(url)) return true;

    // Additional YouTube patterns that might not be caught by the main function
    if (/youtube\.com|youtu\.be/i.test(url)) return true;

    // Check for direct video file URLs
    const videoExtensions = /\.(mp4|webm|ogg|avi|mov|wmv|flv|mkv)(\?.*)?$/i;
    if (videoExtensions.test(url)) return true;

    // Check for other video platforms
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
  }

  function isValidImageUrl(url) {
    if (!url || typeof url !== 'string') return false;

    // Check for direct image file URLs
    const imageExtensions = /\.(jpg|jpeg|png|webp|svg|bmp|tiff)(\?.*)?$/i;
    if (imageExtensions.test(url)) return true;

    // Check for common image hosting platforms
    const imageHosts = [
      /imgur\.com/,
      /i\.redd\.it/,
      /cloudinary\.com/,
      /unsplash\.com/,
      /pexels\.com/
    ];

    return imageHosts.some(pattern => pattern.test(url));
  }

  function validateMediaUrl(url) {
    if (!url.trim()) {
      setUrlError("");
      return true;
    }

    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      setUrlError("URL must start with http:// or https://");
      return false;
    }

    if (isValidVideoUrl(url) || isValidImageUrl(url)) {
      setUrlError("");
      return true;
    }

    setUrlError("Please enter a valid image or video URL (YouTube, Vimeo, direct file links, etc.)");
    return false;
  }

  const removeMedia = (index) => {
    setMedia(media.filter((_, i) => i !== index));
  };

  const [joinedSubthreads, setJoinedSubthreads] = useState([]);
  const [showJoinConfirm, setShowJoinConfirm] = useState(false);
  const [pendingJoinThread, setPendingJoinThread] = useState(null);
  const [showChooseSubthread, setShowChooseSubthread] = useState(false);
  const [isLoadingSubthreads, setIsLoadingSubthreads] = useState(true);

  // Fetch joined subthreads on mount
  useEffect(() => {
    setIsLoadingSubthreads(true);
    axios.get("/api/threads").then((res) => {
      setJoinedSubthreads(res.data.subscribed || []);
      setIsLoadingSubthreads(false);
    }).catch((err) => {
      setIsLoadingSubthreads(false);
    });
  }, []);

  // Use protected button hook for form submission
  const { isActive: isSubmitting, isLoading, onClick: protectedSubmit } = useProtectedButton(
    `new-post-${isEdit ? 'edit' : 'create'}`,
    async (e) => {
      e?.preventDefault();
      if (joinedSubthreads.length === 0) {
        toast.error(t('posts.notJoinedSubthread'));
        return;
      }
      if (!thread) {
        toast.error(t('posts.selectSubthread'));
        return;
      }
      // Check if user joined the selected subthread
      const isJoined = joinedSubthreads.some((sub) => sub.id === thread.id);
      if (!isJoined) {
        setPendingJoinThread(thread);
        setShowJoinConfirm(true);
        return;
      }

      // Validate title
      if (!title.trim()) {
        toast.error(t('posts.titleRequired'));
        return;
      }

      // Validate URL if mediaType is "url" and imageUrl is provided
      if (mediaType === "url" && imageUrl.trim() && !validateMediaUrl(imageUrl)) {
        return; // Don't submit if URL validation fails
      }

      const formData = new FormData();
      formData.append("title", title);
      formData.append("content_type", mediaType);
      formData.append("content_url", imageUrl);
      formData.append("content", content);
      
      // Handle multiple media files
      if (mediaType === "media" && media.length > 0) {
        media.forEach((mediaItem, index) => {
          if (mediaItem.file) {
            formData.append("media", mediaItem.file, mediaItem.file.name);
          } else if (mediaItem.url) {
            // For URLs, we'll handle them differently
            formData.append(`media_url_${index}`, mediaItem.url);
          }
        });
      }
      
      formData.append("subthread_id", thread.id);
      
      if (!isEdit) {
        // Create optimistic post data for immediate UI feedback
        const optimisticPostData = {
          id: `temp_${Date.now()}`,
          post_info: {
            id: `temp_${Date.now()}`,
            title: title,
            content: content,
            media: media.length > 0 ? media.map(m => m.file ? URL.createObjectURL(m.file) : m.url) : null,
            created_at: new Date().toISOString(),
            user_info: {
              user_name: user?.username,
              user_avatar: user?.avatar
            },
            thread_id: thread.id,
            thread_name: thread.name,
            post_karma: 0,
            comments_count: 0,
            is_edited: false
          },
          user_vote: 0,
          is_saved: false
        };

        // Add optimistic post immediately
        addOptimisticPost(optimisticPostData, thread.id);

        await axios
          .post("/api/post", formData, { headers: { "Content-Type": "multipart/form-data" } })
          .then((response) => {
            // Show brief success indicator
            setShowSuccessIndicator(true);
            
            // Emit immediate real-time update for instant UI feedback
            if (socket) {
              socket.emit('post_created', {
                postData: response.data,
                subthreadId: thread.id,
                createdBy: user?.username
              });
            }
            
            setTimeout(() => {
              setShowModal(false);
            }, 500); // Close modal after 500ms to show success state
          })
          .catch((err) => {
            // Handle rate limiting and duplicate submission errors
            if (handleRateLimitError(err, 'post')) {
              return;
            }
            
            let errorMessage = t('alerts.failedToCreatePost');
            if (err.response?.data?.message) {
              errorMessage = err.response.data.message;
            }
            toast.error(errorMessage);
          });
      } else {
        await axios
          .patch(`/api/post/${postInfo.id}`, formData, { headers: { "Content-Type": "multipart/form-data" } })
          .then((res) => {
            // Update the specific post data immediately for instant feedback
            queryClient.setQueryData(["post/comment", `${postInfo.id}`], (oldData) => {
              return { ...oldData, post_info: res.data.new_data };
            });
            
            // Emit immediate real-time update for instant UI feedback
            if (socket) {
              socket.emit('post_updated', {
                postId: postInfo.id,
                newData: res.data.new_data,
                subthreadId: thread.id,
                updatedBy: user?.username
              });
            }
            
            // Show brief success indicator
            setShowSuccessIndicator(true);
            setTimeout(() => {
              setShowModal(false);
            }, 500); // Close modal after 500ms to show success state
          })
          .catch((err) => {
            // Handle rate limiting and duplicate submission errors
            if (handleRateLimitError(err, 'post')) {
              return;
            }
            
            let errorMessage = t('alerts.failedToUpdatePost');

            if (err.response?.data?.message) {
              errorMessage = err.response.data.message;
            } else if (err.response?.status === 401) {
              errorMessage = t('alerts.unauthorizedAction');
            } else if (err.response?.status === 400) {
              errorMessage = t('alerts.invalidFieldsUpdate');
            } else if (err.response?.status >= 500) {
              errorMessage = t('alerts.serverError');
            }

            toast.error(errorMessage);
          });
      }
    },
    {
      cooldownMs: 3000,
      actionName: isEdit ? 'updating post' : 'creating post',
      showToast: true
    }
  );



  // Function to join a subthread
  const joinSubthread = async (subthread) => {
    try {
      await axios.post(`/api/threads/subscription/${subthread.id}`);
      setJoinedSubthreads((prev) => [...prev, subthread]);
      setThread(subthread);
      setShowJoinConfirm(false);
      setPendingJoinThread(null);
    } catch {
      toast.error(t('alerts.failedToJoinSubthread'));
    }
  };

  // Function to cancel join
  const cancelJoin = () => {
    setShowJoinConfirm(false);
    setPendingJoinThread(null);
    setThread(false);
  };
  return (
    <div className="flex flex-col w-5/6 p-5 space-y-5 rounded-md h-4/6 blur-none md:w-3/4 md:h-5/6 md:p-10 bg-theme-light-gray2 dark:bg-theme-dark-bg dark:text-theme-dark-text">
      <div className="flex flex-col items-center justify-between p-4 space-y-3 bg-theme-less-white dark:bg-theme-dark-card rounded-lg md:flex-row md:space-y-0">
        <div className="flex items-center space-x-3">
          <p className="dark:text-theme-dark-text-secondary">{isEdit ? t('posts.editing') : t('posts.posting')} {t('posts.as')}</p>
                      <img 
              src={user.avatar || avatar} 
              className="object-cover w-8 h-8 rounded-md md:w-12 md:h-12" 
              alt="" 
              width="48"
              height="48"
            />
          <p className="dark:text-theme-dark-text-secondary">{user.username}</p>
        </div>
        <div className="flex items-center mr-2 space-x-2 md:space-x-3">
          <p className="hidden md:block dark:text-theme-dark-text-secondary">{isEdit ? t('posts.editing') : t('posts.posting')} {t('posts.on')}</p>
          <p className="md:hidden dark:text-theme-dark-text-secondary">{t('posts.on')}</p>
          {thread ? (
            <div className="flex items-center p-1 space-x-3">
              <p className="tracking-wide medium text- md:text-base text-theme-blue">{thread.name}</p>
              <Svg type="delete" className="w-7 h-7 text-theme-blue" onClick={() => setThread(false)} />
            </div>
          ) : (
            <>
              <button
                type="button"
                className="px-3 py-1 text-sm font-semibold text-white bg-theme-blue rounded-md hover:bg-blue-700"
                onClick={() => setShowChooseSubthread(true)}
              >
                {t('posts.chooseSubthread')}
              </button>
              {showChooseSubthread && (
                <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
                  <div className="bg-white dark:bg-theme-dark-card p-6 rounded-md shadow-md max-w-md w-full dark:text-theme-dark-text">
                    {isLoadingSubthreads ? (
                      <>
                        <h3 className="mb-4 text-lg font-semibold dark:text-theme-dark-text-secondary">{t('posts.selectASubthread')}</h3>
                        <div className="flex justify-center items-center py-8">
                          <div className="w-8 h-8 border-4 border-theme-blue border-t-transparent rounded-full animate-spin"></div>
                        </div>
                      </>
                    ) : joinedSubthreads.length > 0 ? (
                      <>
                        <h3 className="mb-4 text-lg font-semibold dark:text-theme-dark-text-secondary">{t('posts.selectASubthread')}</h3>
                        <ul className="max-h-60 overflow-auto">
                          {joinedSubthreads.map((sub) => (
                            <li
                              key={sub.id}
                              className="p-2 cursor-pointer hover:bg-theme-light-gray2 dark:hover:bg-theme-dark-bg rounded-md dark:text-theme-dark-text"
                              onClick={() => {
                                setThread(sub);
                                setShowChooseSubthread(false);
                              }}
                            >
                              {sub.name}
                            </li>
                          ))}
                        </ul>
                        <button
                          className="mt-4 px-4 py-2 bg-gray-300 dark:bg-theme-dark-bg dark:text-theme-dark-text rounded-md hover:bg-gray-400 dark:hover:bg-theme-dark-card"
                          onClick={() => setShowChooseSubthread(false)}
                        >
                          {t('common.cancel')}
                        </button>
                      </>
                    ) : (
                      <>
                        <p className="mb-4 dark:text-theme-dark-text-secondary">
                          {t('posts.notJoinedMessage')} <a href="/home" className="text-theme-blue underline">Home</a> {t('posts.orCreateYourOwn')}.
                        </p>
                        <button
                          className="px-4 py-2 bg-gray-300 dark:bg-theme-dark-bg dark:text-theme-dark-text rounded-md hover:bg-gray-400 dark:hover:bg-theme-dark-card"
                          onClick={() => setShowChooseSubthread(false)}
                        >
                          {t('common.close')}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      <form
        encType="multipart/form-data"
        onSubmit={protectedSubmit}
        className="flex flex-col flex-1 justify-around p-1.5 w-full h-1/2 bg-theme-less-white dark:bg-theme-dark-card rounded-md">
        <label htmlFor="title">
          <span className="dark:text-theme-dark-text-secondary">{t('posts.title')}</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            type="text"
            name="title"
            id="title"
            className="w-full border-b border-gray-800 dark:border-theme-dark-border focus:outline-none bg-transparent dark:bg-theme-dark-bg text-theme-text-primary dark:text-theme-dark-text placeholder-theme-text-secondary dark:placeholder-theme-dark-placeholder-80"
            required
            maxLength={256}
          />
        </label>
        <label htmlFor="content" className="">
          <span className="dark:text-theme-dark-text-secondary">{preMd ? t('posts.markdownPreview') : t('posts.content')}</span>
          <button
            type="button"
            className="active:scale-90 ml-5 my-0.5 py-0.5 px-2 bg-blue-600 text-white font-semibold rounded-md"
            onClick={() => setPreMd(!preMd)}>
            {preMd ? t('posts.closePreview') : t('posts.previewMarkdown')}
          </button>
          <div className="flex flex-col space-y-2">
            {preMd ? (
              <div className="max-w-full p-2 overflow-auto prose border border-gray-800 dark:border-theme-dark-border h-28 bg-theme-less-white dark:bg-theme-dark-bg text-theme-text-primary dark:text-theme-dark-text">
                <Markdown options={{ forceBlock: true, wrapper: 'div' }} className="w-full">
                  {content.replace("\n", "<br />\n") || "This is markdown preview"}
                </Markdown>
              </div>
            ) : (
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                name="content"
                id="content"
                className="w-full p-2 border border-gray-800 dark:border-theme-dark-border h-28 md:max-h-32 focus:outline-none bg-theme-less-white dark:bg-theme-dark-bg text-theme-text-primary dark:text-theme-dark-text placeholder-theme-text-secondary dark:placeholder-theme-dark-placeholder-80"
              />
            )}
          </div>
        </label>
        <label htmlFor="media" className="flex flex-col items-center space-y-3 md:space-y-0 md:space-x-5 md:flex-row">
          <select
            className="px-10 py-2 bg-theme-less-white dark:bg-theme-dark-bg border rounded-md md:px-12 text-theme-text-primary dark:text-theme-dark-text border-gray-800 dark:border-theme-dark-border"
            name="mediaType"
            id="mediaType"
            onChange={(e) => setMediaType(e.target.value)}>
            <option value="media">{t('posts.media')}</option>
            <option value="url">URL</option>
          </select>
          {mediaType === "media" ? (
            <div className="w-full space-y-2">
              {/* Media upload section */}
              <div className="flex flex-col space-y-2">
                <label htmlFor="media" className="flex items-center space-x-2">
                  <input
                    onChange={(e) => {
                      const files = Array.from(e.target.files);
                      const validFiles = files.filter(file => {
                        if (file.size > 10485760) {
                          toast.error(t('posts.fileTooLarge'));
                          return false;
                        }
                        if (media.length + files.length > 4) {
                          toast.error(t('posts.maxImagesReached'));
                          return false;
                        }
                        return true;
                      });
                      
                      const newMedia = validFiles.map(file => ({ file }));
                      setMedia(prev => [...prev, ...newMedia]);
                    }}
                    type="file"
                    name="media"
                    alt="media"
                    accept="image/*, video/*"
                    id="media"
                    multiple
                    className="w-full focus:outline-none text-theme-text-primary dark:text-theme-dark-text"
                  />
                </label>
                
                {/* Display selected media */}
                {media.length > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {media.map((mediaItem, index) => (
                      <div key={index} className="relative group">
                        <img
                          src={mediaItem.file ? URL.createObjectURL(mediaItem.file) : mediaItem.url}
                          alt={mediaItem.title || `Media ${index + 1}`}
                          className="w-full h-24 object-cover rounded-md"
                        />
                        <button
                          type="button"
                          onClick={() => removeMedia(index)}
                          className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="w-full">
              <input
                type="text"
                name="media_url"
                id="media_url"
                placeholder={t('posts.enterImageVideoUrl')}
                className={`w-full p-2 border rounded-md focus:outline-none bg-theme-less-white dark:bg-theme-dark-bg text-theme-text-primary dark:text-theme-dark-text placeholder-theme-text-secondary dark:placeholder-theme-dark-placeholder-80 ${
                  urlError ? 'border-red-500' : 'border-gray-800 dark:border-theme-dark-border'
                }`}
                value={imageUrl}
                onChange={(e) => {
                  setImageUrl(e.target.value);
                  if (e.target.value.trim()) {
                    validateMediaUrl(e.target.value);
                  } else {
                    setUrlError("");
                  }
                }}
              />
              {urlError && (
                <p className="text-red-500 text-sm mt-1">{urlError}</p>
              )}
            </div>
          )}
        </label>
        
        {isEdit && (
          <span className="text-sm font-semibold text-red-500">
            {t('posts.onlyAddImageEdit')}
          </span>
        )}
        <button
          type="submit"
          disabled={isSubmitting || isLoading || showSuccessIndicator}
          className={`py-2 font-semibold text-white rounded-md transition-all duration-200 ease-in-out ${
            showSuccessIndicator
              ? 'bg-green-500 cursor-not-allowed'
              : isSubmitting || isLoading 
                ? 'bg-theme-button-active cursor-not-allowed opacity-75' 
                : 'bg-theme-blue hover:bg-theme-blue-dark active:scale-95'
          }`}>
          {showSuccessIndicator ? (
            <div className="inline-flex items-center">
              <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              {isEdit ? t('posts.updated') : t('posts.created')}
            </div>
          ) : (isSubmitting || isLoading) ? (
            <div className="inline-flex items-center">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
              {t('common.submitting')}
            </div>
          ) : (
            t('common.submit')
          )}
        </button>
      </form>
      {showJoinConfirm && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-theme-less-white dark:bg-theme-dark-card p-6 rounded-md shadow-md max-w-sm w-full dark:text-theme-dark-text">
            <p className="mb-4 dark:text-theme-dark-text-secondary">
              {t('posts.notMemberJoinPrompt', { subthreadName: pendingJoinThread?.name })}
            </p>
            <div className="flex justify-end space-x-4">
              <button
                className="px-4 py-2 bg-theme-bg-tertiary dark:bg-theme-dark-bg dark:text-theme-dark-text rounded-md hover:bg-theme-bg-secondary dark:hover:bg-theme-dark-card"
                onClick={cancelJoin}
              >
                {t('common.cancel')}
              </button>
              <button
                className="px-4 py-2 bg-theme-blue text-white rounded-md hover:bg-theme-blue-dark transition-all duration-200 ease-in-out"
                onClick={() => joinSubthread(pendingJoinThread)}
              >
                Join
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
