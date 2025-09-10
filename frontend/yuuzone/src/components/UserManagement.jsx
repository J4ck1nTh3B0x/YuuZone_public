import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "react-toastify";
import { useConfirmContext } from "./useConfirm.jsx";
import Svg from "./Svg";
import LoadingDots from "./LoadingDots";
import useRealtimeUserManagement from "../hooks/useRealtimeUserManagement";
import PropTypes from "prop-types";

UserManagement.propTypes = {
  threadId: PropTypes.string.isRequired,
  onClose: PropTypes.func,
};

export default function UserManagement({ threadId, onClose }) {
  const { t } = useTranslation();
  const confirm = useConfirmContext();
  const [activeTab, setActiveTab] = useState("user-viewer");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [banReason, setBanReason] = useState("");
  const [showBanModal, setShowBanModal] = useState(false);

  // Initialize real-time user management hooks
  useRealtimeUserManagement(threadId);

  // Fetch user management data
  const { data: managementData, isLoading, refetch } = useQuery({
    queryKey: ["user-management", threadId],
    queryFn: async () => {
      const response = await axios.get(`/api/thread/${threadId}/user-management`);
      return response.data;
    },
  });

  // Search users
  const { data: searchResultsData, isFetching: isSearchingData } = useQuery({
    queryKey: ["search/user", searchQuery],
    queryFn: async ({ signal }) => {
      return await axios.get(`/api/user/search/${searchQuery}`, { signal }).then((data) => data.data);
    },
    enabled: !!(searchQuery && searchQuery.length > 3),
  });

  // User viewer data (similar to SubthreadSubscribersModal)
  const { data: userViewerData, isLoading: isUserViewerLoading, error: userViewerError } = useQuery({
    queryKey: ["subthreadSubscribers", threadId],
    queryFn: async () => {
      const response = await axios.get(`/api/thread/${threadId}/subscribers`);
      return response.data;
    },
    enabled: activeTab === "user-viewer",
  });

  // Ban user mutation
  const banMutation = useMutation({
    mutationFn: async ({ username, reason }) => {
      return await axios.post(`/api/thread/${threadId}/ban/${username}`, { reason });
    },
    onSuccess: () => {
      refetch();
      setShowBanModal(false);
      setBanReason("");
      setSelectedUser(null);
      toast.success(t('alerts.userBannedSuccessfully'));
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || t('alerts.failedToBanUser'));
    },
  });

  // Unban user mutation
  const unbanMutation = useMutation({
    mutationFn: async (username) => {
      return await axios.post(`/api/thread/${threadId}/unban/${username}`);
    },
    onSuccess: () => {
      refetch();
      toast.success(t('alerts.userUnbannedSuccessfully'));
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || t('alerts.failedToUnbanUser'));
    },
  });

  // Get user posts mutation
  const { data: userPosts, mutate: getUserPosts } = useMutation({
    mutationFn: async (username) => {
      const response = await axios.get(`/api/thread/${threadId}/user/${username}/posts`);
      return response.data;
    },
  });

  const handleBanUser = (username) => {
    setSelectedUser(username);
    setShowBanModal(true);
  };

  const confirmBan = () => {
    if (selectedUser) {
      banMutation.mutate({
        username: selectedUser,
        reason: banReason || t('alerts.unspecificBanReason')
      });
    }
  };

  const handleUnbanUser = async (username) => {
    const confirmed = await confirm(t('alerts.unbanUserConfirm', { username }));
    if (confirmed) {
      unbanMutation.mutate(username);
    }
  };



  if (isLoading) {
    return (
      <div className="w-5/6 h-5/6 bg-theme-less-white dark:bg-theme-dark-bg rounded-md flex items-center justify-center">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-8 h-8 border-4 border-theme-blue border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm text-gray-600 dark:text-theme-dark-text">Loading users...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-5/6 h-5/6 bg-theme-less-white dark:bg-theme-dark-bg rounded-md overflow-hidden dark:text-theme-dark-text">
      <div className="flex justify-between items-center p-4 border-b border-theme-border-light dark:border-theme-dark-border">
        <h1 className="text-2xl font-semibold text-theme-blue">User Management</h1>
        {onClose && (
          <button onClick={onClose} className="text-theme-text-secondary hover:text-theme-text-primary dark:text-theme-dark-text dark:hover:text-theme-dark-text">
            <Svg type="close" className="w-6 h-6" />
          </button>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-theme-border-light dark:border-theme-dark-border">
        <button
          onClick={() => setActiveTab("user-viewer")}
          className={`px-4 py-2 font-medium ${
            activeTab === "user-viewer"
              ? "text-theme-blue border-b-2 border-theme-blue"
              : "text-theme-text-secondary hover:text-theme-blue dark:text-theme-dark-text dark:hover:text-theme-blue"
          }`}
        >
          User Viewer ({managementData?.subscribers?.length || 0})
        </button>
        <button
          onClick={() => setActiveTab("banned")}
          className={`px-4 py-2 font-medium ${
            activeTab === "banned"
              ? "text-theme-blue border-b-2 border-theme-blue"
              : "text-theme-text-secondary hover:text-theme-blue dark:text-theme-dark-text dark:hover:text-theme-blue"
          }`}
        >
          Banned Users ({managementData?.banned_users?.length || 0})
        </button>
        <button
          onClick={() => setActiveTab("search")}
          className={`px-4 py-2 font-medium ${
            activeTab === "search"
              ? "text-theme-blue border-b-2 border-theme-blue"
              : "text-theme-text-secondary hover:text-theme-blue dark:text-theme-dark-text dark:hover:text-theme-blue"
          }`}
        >
          Search & Ban
        </button>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {/* User Viewer Tab */}
        {activeTab === "user-viewer" && (
          <div>
            <h3 className="text-lg font-semibold mb-4">Users Joined This Subthread</h3>
            {isUserViewerLoading && <p>Loading...</p>}
            {userViewerError && (
              <p className="text-theme-error">
                Unable to load the list of users at this time. Please try again later.
              </p>
            )}
            {!isUserViewerLoading && userViewerData && Array.isArray(userViewerData) && userViewerData.length === 0 && (
              <p>No users have joined this subthread yet.</p>
            )}
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {userViewerData &&
                userViewerData.map((user) => (
                  <div key={user.id} className="p-3 bg-theme-light-gray2 dark:bg-theme-dark-card rounded-md border-b border-theme-border-light dark:border-theme-dark-border">
                    <div className="flex items-center space-x-3">
                      {user.avatar && (
                        <img
                          src={user.avatar}
                          alt={user.username}
                          className="w-8 h-8 rounded-md"
                        />
                      )}
                      <span className="font-medium">{user.username}</span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Banned Users Tab */}
        {activeTab === "banned" && (
          <div className="space-y-2">
            {managementData?.banned_users?.map((bannedUser) => (
              <div
                key={bannedUser.username}
                className="flex justify-between items-center p-3 bg-theme-error-light rounded-md border border-theme-error-border"
              >
                <div className="flex items-center space-x-3">
                  {bannedUser.avatar && (
                    <img
                      src={bannedUser.avatar}
                      alt={bannedUser.username}
                      className="w-8 h-8 rounded-md"
                    />
                  )}
                  <div>
                    <span className="font-medium">{bannedUser.username}</span>
                    <div className="text-sm text-theme-text-secondary">
                      Reason: {bannedUser.reason}
                    </div>
                    <div className="text-xs text-theme-text-muted">
                      Banned: {new Date(bannedUser.banned_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleUnbanUser(bannedUser.username)}
                  className="text-theme-success hover:underline text-sm"
                >
                  Unban
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Search & Ban Tab */}
        {activeTab === "search" && (
          <div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full p-2 border-2 rounded-md mb-4 bg-theme-less-white dark:bg-theme-dark-card dark:text-theme-dark-text border-theme-border-light dark:border-theme-dark-border"
              placeholder="Search username to ban (even if not joined)"
            />
            {isSearchingData ? (
              <div className="flex justify-center py-4">
                <LoadingDots text={t('common.searching')} />
              </div>
            ) : (
              searchResultsData && (
                <div className="space-y-2">
                  {searchResultsData.map((user) => (
                    <div
                      key={user.username}
                      className="flex justify-between items-center p-3 bg-theme-light-gray2 dark:bg-theme-dark-card rounded-md"
                    >
                      <div className="flex items-center space-x-3">
                        {user.avatar && (
                          <img
                            src={user.avatar}
                            alt={user.username}
                            className="w-8 h-8 rounded-md"
                          />
                        )}
                        <span className="font-medium">{user.username}</span>
                      </div>
                      <button
                        onClick={() => handleBanUser(user.username)}
                        className="text-theme-error hover:underline text-sm"
                      >
                        Ban User
                      </button>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        )}
      </div>

      {/* Ban Modal */}
      {showBanModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-theme-less-white dark:bg-theme-dark-card p-6 rounded-lg max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4 text-theme-text-primary dark:text-theme-dark-text">Ban User: {selectedUser}</h3>
            <textarea
              value={banReason}
              onChange={(e) => setBanReason(e.target.value)}
              className="w-full p-2 border border-theme-border-light dark:border-theme-dark-border rounded-md mb-4 text-theme-text-primary dark:text-theme-dark-text bg-theme-less-white dark:bg-theme-dark-bg"
              rows="3"
              placeholder="Enter ban reason (optional)"
            />
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowBanModal(false)}
                className="px-4 py-2 text-theme-text-secondary hover:text-theme-text-primary dark:text-theme-dark-text dark:hover:text-theme-dark-text"
              >
                Cancel
              </button>
              <button
                onClick={confirmBan}
                className="px-4 py-2 bg-theme-error text-white rounded hover:bg-theme-error-dark"
              >
                Ban User
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User Posts Modal */}
      {userPosts && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-4xl w-full mx-4 max-h-[80vh] overflow-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">
                Posts by {userPosts.username} ({userPosts.total_posts} posts, {userPosts.total_comments} comments)
              </h3>
              <button
                onClick={() => getUserPosts(null)}
                className="text-theme-text-secondary hover:text-theme-text-primary"
              >
                <Svg type="close" className="w-6 h-6" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">Posts:</h4>
                {(userPosts.posts || []).map((post) => (
                  <div key={post.id} className="p-3 bg-theme-bg-secondary rounded mb-2">
                    <div className="font-medium">{post.title}</div>
                    <div className="text-sm text-theme-text-secondary">{post.content}</div>
                    <div className="text-xs text-theme-text-muted">
                      {new Date(post.created_at).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
              <div>
                <h4 className="font-medium mb-2">Comments:</h4>
                {(userPosts.comments || []).map((comment) => (
                  <div key={comment.id} className="p-3 bg-theme-bg-secondary rounded mb-2">
                    <div className="text-sm text-theme-text-secondary">{comment.content}</div>
                    <div className="text-xs text-theme-text-muted">
                      {new Date(comment.created_at).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
