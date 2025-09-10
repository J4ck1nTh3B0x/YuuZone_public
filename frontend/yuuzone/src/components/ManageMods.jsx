import { focusManager, useMutation, useQuery } from "@tanstack/react-query";
import axios from "axios";
import PropTypes from "prop-types";
import { useEffect, useState } from "react";
import { toast } from 'react-toastify';
import { useTranslation } from "react-i18next";
import Svg from "./Svg";
import { Loader } from "./Loader";
import AuthConsumer from "./AuthContext";

ManageMods.propTypes = {
  mods: PropTypes.array,
  threadId: PropTypes.number,
  isOwner: PropTypes.bool,
  onOwnershipTransferred: PropTypes.func,
};

export default function ManageMods({ mods, threadId, onOwnershipTransferred }) {
  const { t } = useTranslation();
  const { socket, user } = AuthConsumer();
  const [modList, setModList] = useState(mods || []);
  const [search, setSearch] = useState("");
  const [currentUserRole, setCurrentUserRole] = useState(null);

  const { data, isFetching } = useQuery({
    queryKey: ["search/user", search],
    queryFn: async ({ signal }) => {
      return await axios.get(`/api/user/search/${search}`, { signal }).then((data) => data.data);
    },
    enabled: !!(search && search.length > 3),
  });

  // Fetch thread data with detailed mod information
  const { data: threadDataResponse } = useQuery({
    queryKey: ["thread", threadId],
    queryFn: async () => {
      return await axios.get(`/api/thread/${threadId}`).then((res) => res.data);
    },
    enabled: !!threadId,
  });

  useEffect(() => {
    focusManager.setFocused(false);
    return () => focusManager.setFocused(true);
  }, []);

  // Update state when thread data is fetched
  useEffect(() => {
    if (threadDataResponse?.threadData) {
      setModList(threadDataResponse.threadData.modList || []);
      setCurrentUserRole(threadDataResponse.threadData.currentUserRole);
    }
  }, [threadDataResponse]);

  // Setup socket.io client and event listeners
  useEffect(() => {
    if (!socket) return;

    const handleModAdded = ({ thread_id, username }) => {
      if (thread_id === threadId && !modList.some((mod) => mod.username === username)) {
        setModList((prev) => [...prev, { username, isMod: true, isAdmin: false, avatar: null }]);
      }
    };

    const handleModRemoved = ({ thread_id, username }) => {
      if (thread_id === threadId) {
        setModList((prev) => prev.filter((mod) => mod.username !== username));
      }
    };

    socket.on("mod_added", handleModAdded);
    socket.on("mod_removed", handleModRemoved);

    return () => {
      socket.off("mod_added", handleModAdded);
      socket.off("mod_removed", handleModRemoved);
    };
  }, [socket, threadId, modList]);

  const { mutate } = useMutation({
    mutationFn: async ({ username, isDelete = false }) => {
      if (isDelete) {
        return await axios
          .delete(`/api/thread/mod/${threadId}/${username}`, {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("token")}`, // Include token if required
            },
          })
          .then((res) => {
            setModList(modList.filter((user) => user.username !== username));
            return res.data;
          })
          .catch((err) => {
            console.error("Error:", err.response?.data?.message || err.message);
            toast.error(`${err.message} - ${err.response?.data?.message || ''}, ${t('alerts.onlyAdminsCanRemoveThreadCreator')}`);
          });
      } else {
        return await axios.put(`/api/thread/mod/${threadId}/${username}`).then((res) => {
          // Find user object from data by username
          const newUser = data?.find((user) => user.username === username);
          if (newUser) {
            // Add as mod with proper structure
            const modUser = {
              username: newUser.username,
              isMod: true,
              isAdmin: false,
              avatar: newUser.avatar || null
            };
            setModList([...modList, modUser]);
          }
          return res.data;
        });
      }
    },
  });

  // New mutation for banning/unbanning users
  const { mutate: mutateBan } = useMutation({
    mutationFn: async ({ username, ban = true, reason = "Unspecific Ban Reason" }) => {
      if (ban) {
        return await axios.post(`/api/thread/${threadId}/ban/${username}`, { reason });
      } else {
        return await axios.post(`/api/thread/${threadId}/unban/${username}`);
      }
    },
    onSuccess: () => {
      // Refresh mod list or other UI as needed
      toast.success(t('alerts.banUnbanActionSuccessful'));
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || t('alerts.failedToBanUnbanUser'));
    },
  });

  // Add UI for ban/unban buttons next to each mod

  const transferOwnershipMutation = useMutation({
    mutationFn: async (username) => {
      return await axios.post(`/api/thread/${threadId}/transfer-ownership/${username}`);
    },
    onSuccess: (data) => {
      toast.success(data.message || t('alerts.ownershipTransferredSuccessfully'));
      if (onOwnershipTransferred) {
        onOwnershipTransferred();
      }
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || t('alerts.failedToTransferOwnership'));
    },
  });

  // Remove the old fetchCurrentUserRole logic since we now get it from thread data

  if (!currentUserRole) {
    return null;
  }

  return (
    <div className="w-5/6 h-5/6 bg-theme-less-white rounded-md dark:bg-theme-dark-bg">
      <h1 className="pt-2 text-2xl font-semibold text-center text-theme-blue">Mod Manager</h1>
      <ul className="overflow-auto relative p-3 m-3 space-y-2 max-h-[40vh] list-none bg-theme-light-gray2 dark:bg-theme-dark-bg">
        {modList.map((mod) => (
          <li
            key={mod.username}
            className="flex justify-between items-center p-1 bg-theme-less-white dark:bg-theme-dark-card rounded-md cursor-pointer"
          >
            <span className="flex items-center space-x-2">
              <span>{mod.username}</span>
              {mod.isAdmin && (
                <Svg type="crown-admin" external={true} className="w-8 h-8 text-theme-yellow-crown" />
              )}
              {mod.isMod && !mod.isAdmin && (
                <Svg type="wrench-mod" external={true} className="w-5 h-5 text-theme-wine-wrench" />
              )}
            </span>
            <div className="flex space-x-2">
              {currentUserRole === "admin" && mod.username !== user?.username && (
                <button
                  onClick={() => {
                    if (window.confirm(t('alerts.transferOwnershipConfirm', { username: mod.username }))) {
                      transferOwnershipMutation.mutate(mod.username);
                    }
                  }}
                  className="text-green-600 hover:underline"
                  title={t('alerts.transferOwnership')}
                >
                  {t('alerts.transferOwnership')}
                </button>
              )}
              {currentUserRole === "admin" && mod.username !== user?.username && (
                <button
                  onClick={() => {
                    if (window.confirm(t('alerts.removeModConfirm', { username: mod.username }))) {
                      mutate({ username: mod.username, isDelete: true });
                    }
                  }}
                  className="text-red-600 hover:underline"
                  title={t('alerts.removeMod')}
                >
                  <Svg type="delete" className="w-8 h-8 font-bold text-theme-blue" />
                </button>
              )}
              {(currentUserRole === "admin" || currentUserRole === "mod") && mod.username !== user?.username && (
                <>
                  <button
                    onClick={() => {
                      const reason = prompt(t('alerts.enterBanReason', { username: mod.username }), t('alerts.unspecificBanReason'));
                      if (reason !== null && window.confirm(t('alerts.banUserConfirm', { username: mod.username }))) {
                        mutateBan({ username: mod.username, ban: true, reason });
                      }
                    }}
                    className="text-red-600 hover:underline"
                    title={t('alerts.banUser')}
                  >
                    {t('alerts.banUser')}
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm(t('alerts.unbanUserConfirm', { username: mod.username }))) {
                        mutateBan({ username: mod.username, ban: false });
                      }
                    }}
                    className="text-green-600 hover:underline"
                    title={t('alerts.unbanUser')}
                  >
                    {t('alerts.unbanUser')}
                  </button>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
      <div className="flex flex-col">
        {currentUserRole === "admin" && (
          <>
            <input
              type="text"
              name="username"
              id="username"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="p-2 mx-3 font-semibold border-2 md:mx-10"
              placeholder="Enter username to add new mod"
            />
            {isFetching ? (
              <div className="m-28">
                <Loader forPosts={true} />
              </div>
            ) : (
              data && (
                <ul className="overflow-auto relative p-4 m-3 space-y-2 md:max-h-[38vh] max-h-[45vh] list-none rounded-md bg-theme-light-gray2 dark:bg-theme-dark-card">
                  {data?.map(
                    (user) =>
                      !modList.some((mod) => mod.username === user.username) && (
                        <li
                          key={user.username}
                          className="flex justify-between items-center p-1 px-2 bg-theme-less-white dark:bg-theme-dark-card rounded-md cursor-pointer"
                          onClick={() => mutate({ username: user.username })}
                        >
                          {user.username}
                          <Svg type="add" className="w-8 h-8 font-bold text-theme-blue" />
                        </li>
                      )
                  )}
                </ul>
              )
            )}
          </>
        )}
      </div>
    </div>
  );
}
