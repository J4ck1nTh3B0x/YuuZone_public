import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { AnimatePresence } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import AuthConsumer from "../../components/AuthContext";
import InfinitePostsLayout from "../../components/InfinitePosts";
import ManageMods from "../../components/ManageMods";
import UserManagement from "../../components/UserManagement";

import Modal from "../../components/Modal";
import { NewThread } from "../../components/NewThread";
import NewPost from "../../components/NewPost";
import { Loader } from "../../components/Loader";
import Svg from "../../components/Svg";
import useSocket from "../../hooks/useSocket";
import useRealtimeSubthread from "../../hooks/useRealtimeSubthread";
import useRealtimeUserManagement from "../../hooks/useRealtimeUserManagement";
import LiveActivityIndicator from "../../components/LiveActivityIndicator";

import { handleBanError } from "../../utils/banHandler";
import { toast } from 'react-toastify';
import { useConfirmContext } from '../../components/useConfirm.jsx';

export function SubThread() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isAuthenticated, user } = AuthConsumer();
  const confirm = useConfirmContext();
  const [modalData, setModalData] = useState(null);
  const [showNewPostModal, setShowNewPostModal] = useState(false);
  const listRef = useRef(null);

  const queryClient = useQueryClient();
  const params = useParams();
  // Initialize real-time hooks
  const subthreadName = params.threadName; // Thread name for API calls
  const [subthreadId, setSubthreadId] = useState(null); // Will store actual ID when data loads
  
  useRealtimeSubthread(subthreadName, params.threadName);
  useRealtimeUserManagement(subthreadName);
  
  const { data, isFetching } = useQuery({
    queryKey: ["thread", params.threadName],
    queryFn: async () => {
      try {
        return await axios.get(`/api/threads/${params.threadName}`).then((res) => res.data);
      } catch (error) {
        if (handleBanError(error, navigate)) {
          return null;
        }
        throw error;
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - thread data can be stale longer
    gcTime: 10 * 60 * 1000, // 10 minutes - keep thread data longer
    refetchOnWindowFocus: false, // Prevent refetch when window regains focus
    refetchOnMount: false, // Prevent refetch when component mounts
    refetchOnReconnect: false, // Prevent refetch on network reconnect
  });
  
  useEffect(() => { document.title = "t/" + params.threadName; return () => { document.title = "yuuzone" } }, [params.threadName]);
  const threadData = data?.threadData;

  // Set the actual subthread ID when data loads
  useEffect(() => {
    if (threadData?.id) {
      setSubthreadId(threadData.id);
    }
  }, [threadData?.id]);

  // Get current user's role for this specific subthread
  const currentUserRole = threadData?.currentUserRole;
  const currentUserRoles = threadData?.currentUserRoles || [];
  const isAdmin = currentUserRoles.includes("admin") || currentUserRole === "admin";
  const isMod = currentUserRoles.includes("mod") || currentUserRole === "mod";


  const { connected, socket } = useSocket(threadData?.name);



  useEffect(() => {
    if (!connected) return;

    socket.on("new_post", () => {
      queryClient.setQueryData(["thread", params.threadName], (oldData) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          threadData: {
            ...oldData.threadData,
            PostsCount: oldData.threadData.PostsCount + 1,
          },
        };
      });
      // Don't invalidate posts query - let real-time updates handle new posts
      // This prevents losing user drafts when new posts are created
    });

    socket.on("subthread_joined", ({ subthreadId: eventSubthreadId }) => {
      if (subthreadId && eventSubthreadId === subthreadId) {
        console.log('🟢 Subthread joined event received in SubThread:', eventSubthreadId);
        queryClient.setQueryData(["thread", params.threadName], (oldData) => {
          if (!oldData) return oldData;
          return {
            ...oldData,
            threadData: {
              ...oldData.threadData,
              subscriberCount: oldData.threadData.subscriberCount + 1,
            },
          };
        });
        
        // ALSO update the sidebar cache to keep it in sync
        queryClient.setQueryData(['threads/all'], (oldData) => {
          if (!oldData) return oldData;
          
          const updateSubthreadCount = (threadList) => {
            if (!Array.isArray(threadList)) return threadList;
            return threadList.map(thread => 
              thread.id === subthreadId 
                ? { ...thread, subscriberCount: (thread.subscriberCount || 0) + 1 }
                : thread
            );
          };

          return {
            ...oldData,
            subscribed: updateSubthreadCount(oldData.subscribed),
            all: updateSubthreadCount(oldData.all),
            popular: updateSubthreadCount(oldData.popular)
          };
        });
      }
    });

    socket.on("subthread_left", ({ subthreadId: eventSubthreadId }) => {
      if (subthreadId && eventSubthreadId === subthreadId) {
        console.log('🔴 Subthread left event received in SubThread:', eventSubthreadId);
        queryClient.setQueryData(["thread", params.threadName], (oldData) => {
          if (!oldData) return oldData;
          return {
            ...oldData,
            threadData: {
              ...oldData.threadData,
              subscriberCount: Math.max(0, oldData.threadData.subscriberCount - 1),
            },
          };
        });
        
        // ALSO update the sidebar cache to keep it in sync
        queryClient.setQueryData(['threads/all'], (oldData) => {
          if (!oldData) return oldData;
          
          const updateSubthreadCount = (threadList) => {
            if (!Array.isArray(threadList)) return threadList;
            return threadList.map(thread => 
              thread.id === subthreadId 
                ? { ...thread, subscriberCount: Math.max(0, (thread.subscriberCount || 0) - 1) }
                : thread
            );
          };

          return {
            ...oldData,
            subscribed: updateSubthreadCount(oldData.subscribed),
            all: updateSubthreadCount(oldData.all),
            popular: updateSubthreadCount(oldData.popular)
          };
        });
      }
    });

    socket.on("mod_added", ({ thread_id, username }) => {
      if (subthreadId && thread_id === subthreadId) {
        queryClient.setQueryData(["thread", params.threadName], (oldData) => {
          if (!oldData) return oldData;
          const newModList = oldData.threadData.modList ? [...oldData.threadData.modList, username] : [username];
          return {
            ...oldData,
            threadData: {
              ...oldData.threadData,
              modList: newModList,
            },
          };
        });
      }
    });

    socket.on("mod_removed", ({ thread_id, username }) => {
      if (subthreadId && thread_id === subthreadId) {
        queryClient.setQueryData(["thread", params.threadName], (oldData) => {
          if (!oldData) return oldData;
          const newModList = oldData.threadData.modList ? oldData.threadData.modList.filter(mod => mod.username !== username) : [];
          return {
            ...oldData,
            threadData: {
              ...oldData.threadData,
              modList: newModList,
            },
          };
        });
      }
    });

    return () => {
      socket.off("new_post");
      socket.off("subthread_joined");
      socket.off("subthread_left");
      socket.off("mod_added");
      socket.off("mod_removed");
    };
  }, [connected, socket, queryClient, params.threadName, threadData?.id]);

  const { mutate } = useMutation({
    mutationFn: async (has_subscribed) => {
      if (has_subscribed) {
        axios.delete(`/api/threads/subscription/${threadData.id}`).then(() =>
          queryClient.setQueryData(["thread", params.threadName], (oldData) => {
            return { threadData: { ...oldData.threadData, has_subscribed: false } };
          })
        );
      } else {
        axios.post(`/api/threads/subscription/${threadData.id}`).then(() =>
          queryClient.setQueryData(["thread", params.threadName], (oldData) => {
            return { threadData: { ...oldData.threadData, has_subscribed: true } };
          })
        );
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      return await axios.delete(`/api/thread/${threadData.id}`);
    },
    onSuccess: () => {
      navigate("/");
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || t('alerts.unableToDeleteSubthread'));
    },
  });

  // Redirect to banned page if user is banned (after all hooks)
  if (threadData?.is_banned) {
    navigate(`/banned/${threadData.id}`);
    return null;
  }

  function handleChange(value) {
    switch (value) {
      case "more":
        break;
      case "edit":
        setModalData(<NewThread ogInfo={threadData} edit={true} setShowModal={setModalData} />);
        break;
      case "manage-mods": {
        const modsForManage = (threadData.modList || []).map(mod => typeof mod === "string" ? { username: mod } : mod);
        setModalData(<ManageMods mods={modsForManage} threadId={threadData.id} />);
        break;
      }
      case "user-management":
        setModalData(<UserManagement threadId={threadData.id} onClose={() => setModalData(null)} />);
        break;

      case "delete": {
        const confirmed = confirm(t('alerts.deleteSubthreadConfirm'));
        if (confirmed) {
          deleteMutation.mutate();
        }
        break;
      }
      case "logo":
        setModalData(
          <img src={threadData?.logo} className="object-cover w-11/12 max-h-5/6 md:w-max md:max-h-screen" alt="" />
        );
        break;
      default:
        navigate(`/u/${value}`);
    }
    listRef.current.value = "more";
  }

  return (
    <div className="flex flex-col flex-1 items-center w-full bg-theme-light-gray2 dark:bg-theme-dark-bg dark:text-theme-dark-text">
      <div className="flex flex-col p-5 space-y-1 w-full bg-theme-less-white dark:bg-theme-dark-card rounded-md md:pb-3 md:space-y-3">
        {isFetching ? (
          <Loader forPosts={true} />
        ) : (
          <div
            className={`flex p-2 flex-col md:flex-row items-center rounded-md md:rounded-md bg-theme-light-gray2 dark:bg-theme-dark-bg ${!threadData?.logo && "py-5"}`}
          >
            {threadData?.logo && (
              <img
                src={threadData?.logo}
                className="object-cover w-32 h-32 rounded-md cursor-pointer md:w-36 md:h-36"
                alt=""
                onClick={() => handleChange("logo")}
              />
            )}
            <div className="flex flex-col flex-1 justify-around items-center p-2 space-y-1">
              <div className="flex items-center space-x-5">
                <h1 className="text-xl font-semibold text-theme-text-primary dark:text-theme-dark-text">{threadData?.name}</h1>
              </div>
              <p className="text-lg text-theme-text-secondary dark:text-theme-dark-text">Since: {new Date(threadData?.created_at).toDateString()}</p>
              {threadData?.description && (
                <p className={`text-center py-4 md:py-2 text-sm dark:text-theme-dark-text ${threadData?.description.length > 90 && "text-lg"}`}>
                  {threadData?.description}
                  {threadData?.description.length > 90 && "..."}
                </p>
              )}
              <div className="flex justify-between mt-2 space-x-7 w-full md:w-11/12">
                <p className="text-sm text-theme-text-secondary dark:text-theme-dark-text">{threadData?.subscriberCount} subscribers</p>
                <p className="text-sm text-theme-text-secondary dark:text-theme-dark-text">{threadData?.PostsCount} posts</p>
                <p className="text-sm text-theme-text-secondary dark:text-theme-dark-text">{threadData?.CommentsCount} comments</p>
              </div>
              
              {/* Live Activity Indicator */}
              <LiveActivityIndicator 
                subthreadId={subthreadId}
                showUserCount={true}
                showActivity={true}
                showSystemStatus={true}
                maxActivityItems={3}
                className="mt-3"
              />
            </div>
          </div>
        )}
        <div className="flex flex-col justify-around space-y-3 md:space-x-10 md:flex-row md:space-y-0">
          <div className="flex flex-col space-y-2 md:flex-row md:space-y-0 md:space-x-4">
            {isAuthenticated && (
              <button
                className={`px-32 py-2 text-white rounded-md active:scale-90 ${threadData?.has_subscribed ? "bg-blue-400" : "bg-theme-blue-coral"} dark:bg-theme-blue-coral`}
                onClick={() => mutate(threadData?.has_subscribed)}
                disabled={threadData?.created_by === user.id && (threadData?.modList.length > 0)}
                title={threadData?.created_by === user.id && (threadData?.modList.length > 0) ? t('subthreads.transferOwnershipBeforeLeaving') : ""}
              >
                {threadData?.has_subscribed ? t('subthreads.leave') : t('subthreads.join')}
              </button>
            )}

          </div>
          <div className="flex items-center space-x-2">
            <select
              ref={listRef}
              defaultValue={"more"}
              onChange={(e) => handleChange(e.target.value)}
              name="mods"
              id="mods"
              className="px-3 py-1 text-center text-2xl font-extrabold rounded-md md:block bg-transparent appearance-none cursor-pointer border-none outline-none dark:text-white focus:outline-none focus:ring-0 focus:border-none"
              style={{ backgroundImage: 'none', outline: 'none', boxShadow: 'none' }}>
              <option value={"more"} className="text-base font-normal dark:text-white dark:bg-theme-dark-card" style={{ display: 'none' }}>⋯</option>
              {/* Admin/Owner Options */}
              {(isAuthenticated && (isAdmin || user.id === threadData?.created_by)) && (
                <optgroup label={t('subthreads.adminOptions')} className="text-lg font-bold dark:text-white">
                  <option value="edit" className="text-lg font-normal dark:text-white dark:bg-theme-dark-card">{t('subthreads.editSubthread')}</option>
                  <option value="manage-mods" className="text-lg font-normal dark:text-white dark:bg-theme-dark-card">{t('subthreads.manageMods')}</option>
                  <option value="user-management" className="text-lg font-normal dark:text-white dark:bg-theme-dark-card">{t('moderation.userManagement')}</option>
                  <option value="delete" className="text-lg font-normal dark:text-white dark:bg-theme-dark-card">{t('subthreads.deleteSubthread')}</option>
                </optgroup>
              )}
              {/* Mod Options */}
              {(isAuthenticated && isMod && !isAdmin && user.id !== threadData?.created_by) && (
                <optgroup label={t('moderation.moderatorOptions')} className="text-lg font-bold dark:text-white">
                  <option value="user-management" className="text-lg font-normal dark:text-white dark:bg-theme-dark-card">{t('moderation.userManagement')}</option>
                </optgroup>
              )}
              {(() => {
                if (!threadData) return null;
                const adminUsernames = threadData.created_by_username ? [threadData.created_by_username] : [];
                const mods = threadData.modList.filter(
                  (mod) => !adminUsernames.includes(typeof mod === "string" ? mod : mod.username || mod)
                );
                return (
                  <>
                    <optgroup label={t('moderation.subthreadAdmin')} className="text-lg font-bold dark:text-white">
                      {adminUsernames.length > 0 ? (
                        adminUsernames.map((admin) => (
                          <option key={admin} value={admin} className="text-lg font-normal dark:text-white dark:bg-theme-dark-card">
                            {admin}
                          </option>
                        ))
                      ) : (
                        <option value="abandoned" className="text-lg font-normal text-theme-text-muted dark:text-theme-text-secondary dark:bg-theme-dark-card">
                          {t('moderation.abandoned')}
                        </option>
                      )}
                    </optgroup>
                    <optgroup label={t('moderation.subthreadMods')} className="text-lg font-bold dark:text-white">
                      {mods.map((mod) => (
                        <option key={typeof mod === "string" ? mod : mod.username || mod} value={typeof mod === "string" ? mod : mod.username || mod} className="text-lg font-normal dark:text-white dark:bg-theme-dark-card">
                          {typeof mod === "string" ? mod : mod.username || mod}
                        </option>
                      ))}
                    </optgroup>
                  </>
                );
              })()}
            </select>
            {(isAuthenticated && (isAdmin || user.id === threadData?.created_by || isMod)) && (
              <>
                {isAdmin && <Svg type="crown-admin" external={true} className="w-8 h-8 ml-2 text-theme-yellow-crown" />}
                {(isMod && !isAdmin) && <Svg type="wrench-mod" external={true} className="w-5 h-5 ml-2 text-theme-wine-wrench" />}
              </>
            )}
          </div>
        </div>
      </div>
      <InfinitePostsLayout
        apiQueryKey={threadData?.name}
        linkUrl={`posts/thread/${threadData?.id}`}
        enabled={threadData !== undefined}
      />
      <AnimatePresence>
        {modalData && <Modal setShowModal={setModalData}>{modalData}</Modal>}
        {showNewPostModal && (
          <Modal setShowModal={setShowNewPostModal}>
            <NewPost 
              setShowModal={setShowNewPostModal} 
              threadInfo={{
                thread_id: threadData?.id,
                thread_name: threadData?.name
              }}
            />
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}



export default SubThread;
