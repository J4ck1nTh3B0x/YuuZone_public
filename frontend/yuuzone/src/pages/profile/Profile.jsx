import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { AnimatePresence } from "framer-motion";
import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import avatar from "../../assets/avatar.png";
import AuthConsumer from "../../components/AuthContext";
import InfinitePostsLayout from "../../components/InfinitePosts";
import Modal from "../../components/Modal";
import { Chat } from "../inbox/Inbox";
import { Loader } from "../../components/Loader";
import Svg from "../../components/Svg";
import useClickOutside from "../../hooks/useClickOutside";
import useRealtimeNotifications from "../../hooks/useRealtimeNotifications";
import { toast } from 'react-toastify';
import UserBadge from "../../components/UserBadge";
import { shouldDisableThreadApis } from "../../utils/pageUtils";

export function Profile() {
  const { user } = AuthConsumer();
  const { username } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();

  // Initialize real-time notifications
  useRealtimeNotifications();
  const [action, setAction] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const dropdownRef = useRef(null);

  useClickOutside(dropdownRef, () => setShowDropdown(false));
  const { data, isFetching: userIsFetching } = useQuery({
    queryKey: ["user", username],
    queryFn: async () => {
      return await axios.get(`/api/user/${username}`).then((res) => res.data);
    },
  });

  // Check if current page should disable thread APIs
  const disableThreadApis = shouldDisableThreadApis(location.pathname);

  // Check if current user has blocked this user
  const { data: blockedUsers } = useQuery({
    queryKey: ["blockedUsers"],
    queryFn: async () => {
      return await axios.get("/api/user/blocked").then((res) => res.data);
    },
    enabled: user && user.username !== username && !disableThreadApis, // Only fetch if viewing another user's profile and APIs not disabled
  });

  // Check if current user is blocked by the profile owner
  const { data: isBlockedByUser } = useQuery({
    queryKey: ["isBlockedBy", username],
    queryFn: async () => {
      return await axios.get(`/api/user/blocked-by/${username}`).then((res) => res.data.blocked);
    },
    enabled: user && user.username !== username && !disableThreadApis, // Only fetch if viewing another user's profile and APIs not disabled
  });

  useEffect(() => {
    if (blockedUsers && data) {
      const blocked = blockedUsers.some(blockedUser => blockedUser.username === data.username);
      setIsBlocked(blocked);
    }
  }, [blockedUsers, data]);
  useEffect(() => {
    if (action === "message") {
      setAction(<Chat sender={data} setCurChat={setAction} newChat={true} />);
    }
  }, [action, data]);

  const handleMessage = () => {
    // Navigate to inbox and start a new chat
    navigate('/inbox', { state: { startChatWith: data } });
    setShowDropdown(false);
  };

  const handleBlock = async () => {
    try {
      await axios.post(`/api/user/block/${data.username}`);
      setIsBlocked(true);
      setShowDropdown(false);
      toast.success(t('alerts.userBlocked', { username: data.username }));
    } catch (error) {
      toast.error(error.response?.data?.message || t('alerts.failedToBlockUser'));
    }
  };

  const handleUnblock = async () => {
    try {
      await axios.post(`/api/user/unblock/${data.username}`);
      setIsBlocked(false);
      setShowDropdown(false);
      toast.success(t('alerts.userUnblocked', { username: data.username }));
    } catch (error) {
      toast.error(error.response?.data?.message || t('alerts.failedToUnblockUser'));
    }
  };

  useEffect(() => { document.title = "u/" + username; return () => document.title = "yuuzone" }, [username]);
  return (
    <div className="flex flex-col flex-1 items-center w-full bg-theme-light-gray2 dark:bg-theme-dark-bg dark:text-theme-dark-text">
      {userIsFetching ? (
        <Loader forPosts={true} />
      ) : isBlockedByUser ? (
        // Show blocked message
        <div className="flex flex-col items-center justify-center w-full min-h-96 bg-theme-less-white dark:bg-theme-dark-card rounded-md p-8 m-4">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-theme-text-primary mb-4">
              {t('user.blockedByUser', { username })}
            </h1>
            <p className="text-lg text-theme-text-secondary">
              {t('user.blockedByUserDescription')}
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center w-full bg-theme-light-gray2 dark:bg-theme-dark-bg">
          <div className="flex flex-col p-2 w-full bg-theme-less-white dark:bg-theme-dark-card rounded-md md:p-5 relative">
            {/* Three-dot menu for other users (only if not blocked) */}
            {user.username !== data?.username && !isBlockedByUser && (
              <div className="absolute top-4 right-4 z-10" ref={dropdownRef}>
                <button
                  onClick={() => setShowDropdown(!showDropdown)}
                  className="flex items-center justify-center w-8 h-8 text-theme-text-primary"
                  title="More options"
                >
                  <Svg type="more" className="w-6 h-6" />
                </button>

                {showDropdown && (
                  <div className="absolute top-full right-0 mt-1 w-40 bg-white dark:bg-theme-dark-card rounded-md shadow-lg border border-gray-200 dark:border-theme-dark-border z-50 dark:text-theme-dark-text">
                    <div className="py-1">
                      <button
                        onClick={handleMessage}
                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-theme-dark-text hover:bg-gray-100 dark:hover:bg-theme-dark-bg"
                      >
                        {t('user.message')}
                      </button>
                      <button
                        onClick={isBlocked ? handleUnblock : handleBlock}
                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-theme-dark-text hover:bg-gray-100 dark:hover:bg-theme-dark-bg"
                      >
                        {isBlocked ? t('user.unblock') : t('user.block')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
            <div className="flex flex-col flex-1 justify-between items-center p-2 w-full rounded-md md:flex-row md:rounded-md bg-theme-light-gray2 dark:bg-theme-dark-card dark:text-theme-dark-text">
              <img
                src={data.avatar || avatar}
                className="object-cover w-24 h-24 bg-theme-less-white rounded-md cursor-pointer md:w-36 md:h-36"
                alt=""
                onClick={() =>
                  setAction(
                    <img
                      src={data.avatar || avatar}
                      className="object-cover w-11/12 max-h-5/6 md:w-max md:max-h-screen"
                      alt=""
                    />
                  )
                }
              />
              <div className="flex flex-col flex-1 items-center w-full md:p-2">
                <h1 className="mt-2 text-lg font-semibold md:m-0">u/{data.username}</h1>
                {/* Tier badge */}
                <div className="mt-2 mb-2">
                  <UserBadge 
                    subscriptionTypes={data?.subscription_types || []} 
                    className="px-3 py-1 rounded-lg text-xs font-bold"
                  />
                </div>
                <p className="my-4 w-11/12 text-sm text-center md:my-2 md:text-base">{data?.bio}</p>
                <div className="flex justify-between items-center w-full md:w-11/12">
                  <p className="text-xs md:text-sm">{t('user.karma')}: {data?.karma.user_karma}</p>
                  <p className="text-xs md:text-sm">{t('user.cakeDayOn')}: {new Date(data?.registrationDate).toDateString()}</p>
                </div>
              </div>
            </div>
            <div className="flex flex-col my-2 text-sm md:text-sm">
              <div className="flex justify-between space-x-2">
                <p className="">{t('user.totalPosts')}: {data?.karma.posts_count}</p>
                <p className="">{t('user.postsKarma')}: {data?.karma.posts_karma}</p>
              </div>

              <div className="flex justify-between space-x-2">
                <p className="">{t('user.totalComments')}: {data?.karma.comments_count}</p>
                <p className="">{t('user.commentsKarma')}: {data?.karma.comments_karma}</p>
              </div>
            </div>
          </div>
        </div>
      )}
      {data?.deleted && !userIsFetching && (
        <div className="flex flex-col items-center justify-center w-full min-h-96 bg-theme-less-white dark:bg-theme-dark-card rounded-md p-8 m-4">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-theme-text-primary mb-4">
              {t('user.userNotExist')}
            </h1>
            <p className="text-lg text-theme-text-secondary">
              {t('user.userNotExistDescription')}
            </p>
          </div>
        </div>
      )}
      {!isBlockedByUser && (
        <InfinitePostsLayout
          apiQueryKey={data?.username}
          linkUrl={`posts/user/${data?.username}`}
          enabled={data?.username !== undefined}
        />
      )}
      <AnimatePresence>
        {action !== false && (
          <Modal showModal={action} setShowModal={setAction}>
            {action}
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}

export default Profile;
