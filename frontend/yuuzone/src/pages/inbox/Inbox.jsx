import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AnimatePresence } from "framer-motion";
import AuthConsumer from "../../components/AuthContext";
import Svg from "../../components/Svg";
// import MessageActions from "../../components/MessageActions";
// import MessageEditModal from "../../components/MessageEditModal";
import useChatSocket from "../../hooks/useChatSocket";
import defaultAvatar from "../../assets/avatar.png";
import { toast } from 'react-toastify';
import { useConfirmContext } from '../../components/useConfirm.jsx';
import PropTypes from 'prop-types';
import Modal from "../../components/Modal";
import ReactPlayer from "react-player";

// Simple loading spinner component for inbox
function LoadingSpinner({ size = "w-6 h-6" }) {
  return (
    <div className={`animate-spin rounded-full h-6 w-6 border-b-2 border-theme-blue ${size}`}></div>
  );
}

LoadingSpinner.propTypes = {
  size: PropTypes.string,
};

export default function Inbox() {
  const { socket } = AuthConsumer();
  const { t } = useTranslation();
  const [curChat, setCurChat] = useState(null);
  const [showUserInfo, setShowUserInfo] = useState(true);
  const [editingMessage, setEditingMessage] = useState(null);
  const location = useLocation();

  // Handle starting a new chat from navigation state
  useEffect(() => {
    if (location.state?.startChatWith) {
      setCurChat(location.state.startChatWith);
      // Clear the state to prevent re-triggering
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  // Removed chat panel width measurement - let CSS handle layout

  const { data: inboxData, isLoading } = useQuery({
    queryKey: ["inbox"],
    queryFn: async () => {
      return await axios.get("/api/messages/inbox").then((res) => res.data);
    },
    staleTime: 3 * 60 * 1000, // 3 minutes - inbox data can be stale longer
    gcTime: 8 * 60 * 1000, // 8 minutes - keep inbox data longer
    refetchOnWindowFocus: false, // Prevent refetch when window regains focus
    refetchOnMount: false, // Prevent refetch when component mounts
    refetchOnReconnect: false, // Prevent refetch on network reconnect
  });

  useEffect(() => {
    if (curChat) {
      document.title = `${t('navigation.inbox')} | ${curChat.username}`;
    } else {
      document.title = `yuuzone | ${t('navigation.inbox')}`;
    }
    return () => {
      document.title = "yuuzone";
    };
  }, [curChat, t]);

  // Remove duplicate socket listener - Chat component will handle message updates
  // This prevents conflicts between multiple listeners
  useEffect(() => {
    if (!socket) return;

    socket.on("connect_error", () => {
      // console.error("Socket connection error:", err.message);
    });

    return () => {
      // Clean up only the connect_error listener
    };
  }, [socket]);

  return (
    <div className="fixed top-16 left-0 right-0 bottom-0 flex bg-theme-light-gray2 dark:bg-theme-dark-bg overflow-hidden">
      {/* Left Sidebar - Conversations */}
      <div className={`${curChat ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-80 bg-theme-less-white dark:bg-theme-dark-card border-r border-theme-border-light dark:border-theme-dark-border flex-shrink-0 dark:text-theme-dark-text h-full`}>
        {/* Header */}
        <div className="flex items-center p-3 md:p-4 border-b border-theme-border-light dark:border-theme-dark-border flex-shrink-0">
          <div className="flex items-center space-x-2">
            <Svg type="message" className="w-5 h-5 md:w-6 md:h-6 text-theme-text-secondary" />
            <h1 className="text-base md:text-lg font-semibold text-theme-text-primary dark:text-theme-dark-text truncate">{t('messages.directMessages')}</h1>
          </div>
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {isLoading ? (
            <div className="flex justify-center items-center h-32">
              <LoadingSpinner />
            </div>
          ) : inboxData && Array.isArray(inboxData) && inboxData.length > 0 ? (
            inboxData.slice(0, 20).map((message) => (
              <div
                key={message.message_id}
                className={`flex items-center p-2 md:p-3 mx-1 md:mx-2 my-1 cursor-pointer rounded-md transition-colors ${
                  curChat?.username === message.sender.username
                    ? "bg-theme-blue-light border border-theme-blue-border"
                    : "hover:bg-theme-bg-tertiary dark:hover:bg-theme-dark-bg"
                }`}
                onClick={() => setCurChat(message.sender)}
              >
                <div className="relative flex-shrink-0">
                  <img
                    src={message.sender.avatar || defaultAvatar}
                    alt={message.sender.username}
                    className="w-8 h-8 md:w-10 md:h-10 rounded-md object-cover"
                    onError={(e) => {
                      e.target.src = defaultAvatar;
                    }}
                  />

                </div>
                <div className="flex-1 ml-2 md:ml-3 min-w-0">
                  <div className="flex justify-between items-center">
                    <h3 className="font-medium text-theme-text-primary dark:text-theme-dark-text truncate text-sm md:text-base">{message.sender.username}</h3>
                    <span className="text-xs text-theme-text-secondary dark:text-theme-dark-text-secondary flex-shrink-0 ml-1">
                      {new Date(message.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric'
                      })}
                    </span>
                  </div>
                  <p className="text-xs md:text-sm text-theme-text-secondary dark:text-theme-dark-text-secondary truncate">{message.content}</p>
                </div>
                {!message.seen && !message.latest_from_user && (
                  <div className="w-2 h-2 bg-theme-blue rounded-md ml-1 md:ml-2 flex-shrink-0"></div>
                )}
              </div>
            ))
          ) : (
            <div className="text-center text-theme-text-secondary py-8 px-4 dark:bg-theme-dark-bg dark:text-theme-dark-text">
              <Svg type="message" className="w-12 h-12 mx-auto mb-3 text-theme-text-secondary" />
              <p className="text-sm">{t('messages.noConversationsYet')}</p>
              <p className="text-xs text-theme-text-secondary mt-1">{t('messages.startConversation')}</p>
            </div>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex flex-col h-full min-h-0 flex-1">
        {curChat && curChat.username ? (
          <Chat
            sender={curChat}
            setCurChat={setCurChat}
            showUserInfo={showUserInfo}
            setShowUserInfo={setShowUserInfo}
            editingMessage={editingMessage}
            setEditingMessage={setEditingMessage}
          />
        ) : (
          <div className="hidden md:flex flex-col items-center justify-center flex-1 h-full bg-theme-light-gray2 dark:bg-theme-dark-bg text-theme-text-secondary dark:text-theme-dark-text">
            <div className="text-center">
              <Svg type="message" className="w-20 h-20 mx-auto mb-4 text-theme-text-secondary dark:text-theme-dark-text" />
              <h2 className="text-xl font-semibold text-theme-text-primary dark:text-theme-dark-text mb-2">{t('messages.yourConversations')}</h2>
              <p className="text-theme-text-secondary dark:text-theme-dark-text">{t('messages.sendPrivateMessages')}</p>
            </div>
          </div>
        )}
      </div>

      {/* Right Sidebar - User Profile (Toggleable) - Fixed width to maintain ratio */}
      {curChat && showUserInfo && (
        <UserInfoPanel user={curChat} />
      )}
    </div>
  );
}

export const Chat = ({ sender, setCurChat, newChat = false, showUserInfo, setShowUserInfo, editingMessage, setEditingMessage }) => {
  const myRef = useRef(null);
  const queryClient = useQueryClient();
  const { user } = AuthConsumer();
  const { t } = useTranslation();
  const confirm = useConfirmContext();
  const [message, setMessage] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const [typingTimeout, setTypingTimeout] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const [modalShow, setShowModal] = useState(false);
  const [modalData, setModalData] = useState(null);
  const [showNewMessageIndicator, setShowNewMessageIndicator] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);

  const {
    connected, onMessage, onTyping, onStopTyping, onMessageEdit, onMessageDelete, sendTyping, sendStopTyping
  } = useChatSocket(user?.username, sender?.username) || {};

  const { data, isLoading, error } = useQuery({
    queryKey: ["chat", sender?.username],
    queryFn: async () => {
      if (!sender?.username) return [];
      const response = await axios.get(`/api/messages/chat/${sender.username}`);
      return response.data;
    },
    enabled: !!sender?.username,
    retry: 2,
    retryDelay: 1000,
    staleTime: 2 * 60 * 1000, // 2 minutes - chat data can be stale longer
    gcTime: 5 * 60 * 1000, // 5 minutes - keep chat data longer
    refetchOnWindowFocus: false, // Prevent refetch when window regains focus
    refetchOnMount: false, // Prevent refetch when component mounts
    refetchOnReconnect: false, // Prevent refetch on network reconnect
  });

  // Send message mutation
  const { mutate } = useMutation({
    mutationFn: async (params) => {
      if (params.file) {
        // Handle file upload
        const formData = new FormData();
        formData.append('content', params.message || '');
        formData.append('receiver', params.sender.username);
        formData.append('file', params.file);

        return await axios
          .post("/api/messages", formData, {
            headers: { "Content-Type": "multipart/form-data" }
          })
          .then((res) => {
            return res.data;
          });
      } else {
        // Handle text-only message
        return await axios
          .post("/api/messages", { content: params.message, receiver: params.sender.username })
          .then((res) => {
            return res.data;
          });
      }
    },
    onMutate: () => {
      setIsSending(true);
    },
    onSuccess: (data) => {
      setMessage(""); // Clear the input field
      setSelectedFile(null); // Clear the selected file
      setFilePreview(null); // Clear the file preview
      setIsSending(false); // Re-enable sending
      queryClient.setQueryData(["chat", sender?.username], (oldData) => {
        const newChatData = [...(oldData || []), data];
        return newChatData; // Add the sent message to the chat bubble
      });
      queryClient.setQueryData(["inbox"], (oldData) => {
        return Array.isArray(oldData) ? oldData.map((m) =>
          m.sender.username === sender?.username
            ? { ...m, content: data.content, created_at: data.created_at, message_id: data.message_id }
            : m
        ) : [];
      });
      
      // Auto-scroll to bottom if user is at the bottom when they send a message
      setTimeout(() => {
        // Check if user is actually at the bottom before auto-scrolling
        if (messagesContainerRef.current) {
          const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
          const isActuallyAtBottom = scrollTop + clientHeight >= scrollHeight - 10;
          
          if (isActuallyAtBottom) {
            scrollToBottom();
          }
        }
      }, 100);
    },
    onError: () => {
      setIsSending(false); // Re-enable sending on error
    },
  });

  // Edit message mutation
  const editMessageMutation = useMutation({
    mutationFn: async ({ messageId, content }) => {
      const response = await axios.put(`/api/messages/${messageId}/edit`, {
        content: content
      });
      return response.data;
    },
    onSuccess: (data) => {
      // Update local state immediately
      queryClient.setQueryData(["chat", sender?.username], (oldData) => {
        if (!Array.isArray(oldData)) return [];
        return oldData.map(msg =>
          msg.message_id === data.message_id
            ? { ...msg, content: data.content, edited_at: data.edited_at }
            : msg
        );
      });
    },
    onError: () => {
      toast.error(t('messages.editFailed'));
    }
  });

  // Delete message mutation
  const deleteMessageMutation = useMutation({
    mutationFn: async (messageId) => {
      const response = await axios.delete(`/api/messages/${messageId}/delete`);
      return response.data;
    },
    onSuccess: (data, messageId) => {
      // Update local state immediately
      queryClient.setQueryData(["chat", sender?.username], (oldData) => {
        if (!Array.isArray(oldData)) return [];
        return oldData.filter(msg => msg.message_id !== messageId);
      });
    },
    onError: () => {
      toast.error(t('messages.deleteFailed'));
    }
  });

  // Mark messages as seen when chat is opened
  useEffect(() => {
    if (!sender?.username) return;

    // Mark messages from this sender as seen
    axios.post('/api/messages/mark-seen', {
      sender: sender.username
    }).then(() => {
      // Update inbox data to mark messages as seen
      queryClient.setQueryData(["inbox"], (oldData) => {
        if (!Array.isArray(oldData)) return oldData;
        return oldData.map(msg =>
          msg.sender.username === sender.username && !msg.latest_from_user
            ? { ...msg, seen: true }
            : msg
        );
      });
    }).catch(() => {
      // console.error('Failed to mark messages as seen:', error);
    });
  }, [sender?.username, queryClient]);

  // Listen for real-time messages
  useEffect(() => {
    if (!connected || !sender?.username) return;

    const unsubscribe = onMessage((messageData) => {
      // Only handle messages from the other user (not from current user)
      if (messageData.sender?.username === user?.username) {
        return; // Skip messages from current user to prevent duplication
      }

      // Update chat data for received messages only
      queryClient.setQueryData(["chat", sender.username], (oldData) => {
        const exists = oldData?.some(msg => msg.message_id === messageData.message_id);
        if (exists) {
          return oldData;
        }

        const newMessage = {
          message_id: messageData.message_id,
          content: messageData.message || messageData.content || '',
          media: messageData.media || null,
          created_at: messageData.created_at,
          sender: messageData.sender,
          receiver: messageData.receiver,
          seen: false,
          seen_at: null
        };

        const updatedData = [...(oldData || []), newMessage];
        
        // Handle auto-scroll for new messages from other user
        setTimeout(() => {
          if (isAtBottom) {
            // User is at bottom, auto-scroll to show new message
            scrollToBottom();
          } else {
            // User has scrolled up, show new message indicator
            setShowNewMessageIndicator(true);
            setUnreadCount(prev => prev + 1);
          }
        }, 100);

        return updatedData;
      });

      // Also update inbox data
      queryClient.setQueryData(["inbox"], (oldData) => {
        if (!oldData || !Array.isArray(oldData)) {
          // If no inbox data exists, create new conversation
          return [{
            sender: messageData.sender,
            receiver: messageData.receiver,
            content: messageData.message,
            created_at: messageData.created_at,
            message_id: messageData.message_id,
            latest_from_user: messageData.sender?.username === user?.username,
            seen: false
          }];
        }

        // Look for existing conversation
        const existingIndex = oldData.findIndex((m) => {
          const isRelevantConversation =
            (m.sender.username === messageData.sender?.username && m.receiver?.username === messageData.receiver?.username) ||
            (m.sender.username === messageData.receiver?.username && m.receiver?.username === messageData.sender?.username) ||
            (m.sender.username === messageData.sender?.username || m.sender.username === messageData.receiver?.username);
          return isRelevantConversation;
        });

        if (existingIndex !== -1) {
          // Update existing conversation
          const updated = [...oldData];
          updated[existingIndex] = {
            ...updated[existingIndex],
            content: messageData.message,
            created_at: messageData.created_at,
            message_id: messageData.message_id,
            latest_from_user: messageData.sender?.username === user?.username,
            seen: false
          };
          return updated;
        } else {
          // Add new conversation
          return [...oldData, {
            sender: messageData.sender,
            receiver: messageData.receiver,
            content: messageData.message,
            created_at: messageData.created_at,
            message_id: messageData.message_id,
            latest_from_user: messageData.sender?.username === user?.username,
            seen: false
          }];
        }
      });
    });

    return unsubscribe;
  }, [connected, onMessage, queryClient, sender?.username, user?.username, isAtBottom]);

  // Listen for typing events
  useEffect(() => {
    if (!connected || !sender?.username) return;

    const handleTyping = (data) => {
      if (data.sender === sender.username) {
        setIsTyping(true);
        // Clear typing indicator after 3 seconds
        setTimeout(() => setIsTyping(false), 3000);
      }
    };

    const handleStopTyping = (data) => {
      if (data.sender === sender.username) {
        setIsTyping(false);
      }
    };

    onTyping(handleTyping);
    onStopTyping(handleStopTyping);

    return () => {
      // Cleanup will be handled by the hook
    };
  }, [connected, onTyping, onStopTyping, sender?.username]);

  // Listen for message edits and deletes
  useEffect(() => {
    if (!connected || !sender?.username) return;

    const handleMessageEdited = (data) => {
      // Update the message in the chat data
      queryClient.setQueryData(["chat", sender.username], (oldData) => {
        if (!Array.isArray(oldData)) return oldData;
        return oldData.map(msg =>
          msg.message_id === data.message_id
            ? { ...msg, content: data.content, edited_at: data.edited_at }
            : msg
        );
      });
    };

    const handleMessageDeleted = (data) => {
      // Remove the message from the chat data
      queryClient.setQueryData(["chat", sender.username], (oldData) => {
        if (!Array.isArray(oldData)) return oldData;
        return oldData.filter(msg => msg.message_id !== data.message_id);
      });
    };

    const unsubscribeEdit = onMessageEdit(handleMessageEdited);
    const unsubscribeDelete = onMessageDelete(handleMessageDeleted);

    return () => {
      unsubscribeEdit();
      unsubscribeDelete();
    };
  }, [connected, onMessageEdit, onMessageDelete, queryClient, sender?.username]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    myRef.current?.scrollIntoView({ behavior: "smooth" });
    if (data && Array.isArray(data)) {
      queryClient.setQueryData(["chat", sender?.username], (oldData) => {
        // Allow messages with content OR media (don't filter out media-only messages)
        return Array.isArray(oldData) ? oldData.filter((msg) =>
          (msg.content && (msg.content.trim() || '').length > 0) || msg.media
        ) : [];
      });
    }
  }, [data, queryClient, sender?.username]);

  // Safety check for sender object (now after hooks)
  if (!sender || !sender.username) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="text-gray-500 dark:text-gray-400 mb-4">
            <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            {t('messages.selectChat')}
          </h3>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            {t('messages.selectChatDescription')}
          </p>
        </div>
      </div>
    );
  }

  // useEffect(() => {
  //   if (data && data.length > 0) {
  //     setHasExistingMessages(true);
  //   }
  // }, [data]);

  // File handling functions
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {

      // Check file size (25MB = 26214400 bytes)
      if (file.size > 26214400) {
        toast.error(t('messages.fileTooLarge'));
        return;
      }

      setSelectedFile(file);

      // Create preview for images
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          setFilePreview(e.target.result);
        };
        reader.readAsDataURL(file);
      } else {
        setFilePreview(null);
      }
    }
  };

  const removeFile = () => {
    setSelectedFile(null);
    setFilePreview(null);
  };

  // Handle message editing
  const handleEditMessage = (message) => {
    setEditingMessage(message);
  };

  // Handle message deletion
  const handleDeleteMessage = async (message) => {
    const confirmed = await confirm(t('messages.confirmDelete'));
    if (confirmed) {
      deleteMessageMutation.mutate(message.message_id);
    }
  };

  // Save edited message
  const handleSaveEdit = async (messageId, content) => {
    if (!content.trim()) {
      toast.error(t('messages.emptyMessage'));
      return;
    }
    try {
      await editMessageMutation.mutateAsync({ messageId, content: content.trim() });
      setEditingMessage(null);
    } catch {
      // console.error('Failed to save edit:', error);
    }
  };

  const handleInputChange = (e) => {
    setMessage(e.target.value);

    // Send typing indicator
    if (connected && e.target.value && e.target.value.length > 0) {
      // Clear existing timeout
      if (typingTimeout) {
        clearTimeout(typingTimeout);
      }

      // Send typing indicator
      sendTyping();

      // Set timeout to stop typing indicator
      const timeout = setTimeout(() => {
        sendStopTyping();
      }, 1000);

      setTypingTimeout(timeout);
    } else if (connected && (!e.target.value || e.target.value.length === 0)) {
      // Stop typing indicator if message is empty
      if (typingTimeout) {
        clearTimeout(typingTimeout);
        setTypingTimeout(null);
      }
      sendStopTyping();
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    // Prevent sending if already sending
    if (isSending) {
      return;
    }

    // Validate that either message or file is present
    if ((!message || message.trim().length === 0) && !selectedFile) {
      toast.error(t('messages.messageValidation'));
      return;
    }

    // Stop typing indicator when sending message
    if (connected) {
      sendStopTyping();
    }

    mutate({ message, sender, file: selectedFile });
  };

  // Handle Enter key press
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };



  // Smart scrolling functions
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleScroll = () => {
    if (!messagesContainerRef.current) return;
    
    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
    const isBottom = scrollTop + clientHeight >= scrollHeight - 10; // 10px threshold
    
    setIsAtBottom(isBottom);
    
    // If user scrolls to bottom, hide new message indicator and reset unread count
    if (isBottom) {
      setShowNewMessageIndicator(false);
      setUnreadCount(0);
    }
  };

  const handleNewMessageIndicatorClick = () => {
    scrollToBottom();
    setShowNewMessageIndicator(false);
    setUnreadCount(0);
  };

  // Media detection functions (same as Post component)
  function isImage(url) {
    return /(jpg|jpeg|png|webp|avif|gif|svg|image)/.test(url);
  }

  function isValidYouTubeUrl(url) {
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
  }

  function getYouTubeVideoId(url) {
    if (!url) return null;

    const youtuBeMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
    if (youtuBeMatch) return youtuBeMatch[1];

    const youtubeMatch = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
    if (youtubeMatch) return youtubeMatch[1];

    const embedMatch = url.match(/embed\/([a-zA-Z0-9_-]{11})/);
    if (embedMatch) return embedMatch[1];

    return null;
  }

  function cleanYouTubeUrl(url) {
    if (!url || !isValidYouTubeUrl(url)) return url;

    const videoId = getYouTubeVideoId(url);
    if (!videoId) return url;

    return `https://www.youtube.com/watch?v=${videoId}`;
  }

  function getYouTubeThumbnail(url) {
    const videoId = getYouTubeVideoId(url);
    if (!videoId) return null;

    return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
  }

  function isValidVideoUrl(url) {
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
  }

  // Media popup handlers (same as Post component)
  const onMediaClick = useCallback((mediaType, mediaUrl) => {
    if (mediaUrl) {
      setShowModal(true);
      if (mediaType === "video") {
        if (isValidVideoUrl(mediaUrl)) {
          const cleanUrl = cleanYouTubeUrl(mediaUrl);

          if (isValidYouTubeUrl(mediaUrl)) {
            const videoId = getYouTubeVideoId(mediaUrl);
            setModalData(
              <div className="relative w-full h-full flex items-center justify-center">
                <div
                  className="relative cursor-pointer w-full h-full flex items-center justify-center"
                  onClick={() => {
                    setModalData(
                      <div className="w-full h-full">
                        <ReactPlayer
                          url={cleanUrl}
                          width="100%"
                          height="100%"
                          controls={true}
                          playing={true}
                          style={{ borderRadius: '8px' }}
                        />
                      </div>
                    );
                  }}
                >
                  <img
                    src={getYouTubeThumbnail(mediaUrl)}
                    alt="Video thumbnail"
                    className="max-w-full max-h-full object-contain rounded-lg"
                    onError={(e) => {
                      const videoId = getYouTubeVideoId(mediaUrl);
                      if (videoId) {
                        e.target.src = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
                      }
                    }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-20 h-20 bg-theme-dark-bg bg-opacity-70 rounded-md flex items-center justify-center">
                      <Svg type="play" className="w-10 h-10 text-theme-dark-text ml-1" />
                    </div>
                  </div>
                </div>
              </div>
            );
          } else {
            setModalData(
              <div className="w-full h-full">
                <ReactPlayer
                  url={cleanUrl}
                  width="100%"
                  height="100%"
                  controls={true}
                  playing={true}
                  style={{ borderRadius: '8px' }}
                />
              </div>
            );
          }
        } else {
          setModalData(
            <div className="flex items-center justify-center w-full h-96 bg-theme-dark-bg text-theme-dark-text rounded-lg">
              <div className="text-center p-6">
                <Svg type="video" className="w-16 h-16 mx-auto mb-4 text-theme-text-muted" />
                <p className="text-lg mb-2">Invalid Video URL</p>
                <p className="text-sm text-theme-text-muted">
                  The video URL is not supported or invalid
                </p>
                <p className="text-xs text-theme-text-secondary mt-2 break-all">
                  {mediaUrl}
                </p>
              </div>
            </div>
          );
        }
      } else {
        setModalData(
          <div className="w-full h-full flex items-center justify-center">
            <img 
              className="max-w-full max-h-full object-contain rounded-lg shadow-lg" 
              src={mediaUrl.replace("additional_args", "c_auto,g_auto")} 
              alt="Message image" 
              loading="lazy"
            />
          </div>
        );
      }
    }
  }, []);

  // Auto-scroll only on initial load
  useEffect(() => {
    if (data && Array.isArray(data) && data.length > 0) {
      // Only scroll to bottom on initial load, not when switching chats
      if (!messagesContainerRef.current) {
        setTimeout(() => {
          scrollToBottom();
        }, 100);
      }
    }
  }, [sender?.username]); // Changed dependency to sender username instead of data length

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-full bg-theme-less-white dark:bg-theme-dark-card">
        <LoadingSpinner size="w-8 h-8" />
      </div>
    );
  }

  if (error) {
    // Check if it's a deleted user error
    if (error.response?.status === 404 && error.response?.data?.error) {
      return (
        <div className="flex flex-col justify-center items-center h-full p-4 text-center bg-theme-less-white dark:bg-theme-dark-card">
          <div className="text-theme-error mb-4">
            <Svg type="alert" className="w-12 h-12 mx-auto mb-2" />
            <h3 className="text-lg font-semibold text-theme-text-primary dark:text-theme-dark-text">{t('messages.cannotChatWithDeletedUser')}</h3>
            <p className="text-sm text-theme-text-secondary dark:text-theme-dark-text mt-1">{t('messages.userAccountDeleted')}</p>
          </div>
          <button
            onClick={() => setCurChat(null)}
            className="px-4 py-2 bg-theme-blue text-white rounded-md hover:bg-theme-blue-dark transition-colors"
          >
            {t('common.back')}
          </button>
        </div>
      );
    }
    
    return (
      <div className="flex flex-col justify-center items-center h-full p-4 text-center bg-theme-less-white dark:bg-theme-dark-card">
        <div className="text-theme-error mb-4">
          <Svg type="alert" className="w-12 h-12 mx-auto mb-2" />
          <h3 className="text-lg font-semibold text-theme-text-primary dark:text-theme-dark-text">{t('messages.errorLoadingChat')}</h3>
          <p className="text-sm text-theme-text-secondary dark:text-theme-dark-text mt-1">{t('messages.tryRefreshingPage')}</p>
        </div>
        <button
          onClick={() => setCurChat(null)}
          className="px-4 py-2 bg-theme-blue text-white rounded-md hover:bg-theme-blue-dark transition-colors"
        >
          {t('common.back')}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0 bg-theme-less-white dark:bg-theme-dark-card flex-1">
      {/* Chat Header */}
      <div className="flex items-center justify-between p-3 md:p-4 border-b border-theme-border-light dark:border-theme-dark-border bg-theme-less-white dark:bg-theme-dark-card shadow-sm flex-shrink-0 min-h-[56px] md:min-h-[64px]">
        <div className="flex items-center space-x-2 md:space-x-3 min-w-0">
          <button
            onClick={() => setCurChat(null)}
            className="md:hidden p-1.5 hover:bg-theme-bg-hover dark:hover:bg-theme-dark-bg rounded-md text-theme-text-secondary flex-shrink-0"
          >
            <Svg type="arrow-left" className="w-4 h-4 md:w-5 md:h-5" />
          </button>
          <div className="flex items-center space-x-1 md:space-x-2 min-w-0">
            <h2 className="font-semibold text-theme-text-primary dark:text-theme-dark-text text-sm md:text-base truncate">{sender.username}</h2>
          </div>
        </div>
        <div className="flex items-center space-x-1 md:space-x-2 flex-shrink-0">
          <button
            onClick={() => setShowUserInfo(!showUserInfo)}
            className="hidden lg:flex p-1.5 md:p-2 rounded-md text-theme-text-secondary"
            title={showUserInfo ? t('messages.hideUserInfo') : t('messages.showUserInfo')}
          >
            <Svg type="user" className="w-4 h-4 md:w-5 md:h-5" />
          </button>
        </div>
      </div>

        {/* Messages Area */}
        <div className="flex-1 flex flex-col min-h-0 bg-theme-light-gray2 dark:bg-theme-dark-bg dark:text-theme-dark-text relative">
          <div 
            ref={messagesContainerRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto p-2 md:p-4 space-y-3 md:space-y-4 min-h-0"
          >
          {data && Array.isArray(data) && data.length > 0 ? (
            data.map((msg) => (
              <div
                key={msg.message_id}
                className="flex items-start space-x-2 md:space-x-3 group relative"
                // onMouseEnter={() => setHoveredMessageId(msg.message_id)}
                // onMouseLeave={() => setHoveredMessageId(null)}
              >
                <img
                  src={msg.sender.avatar || defaultAvatar}
                  alt={msg.sender.username}
                  className="w-8 h-8 md:w-10 md:h-10 rounded-md object-cover flex-shrink-0"
                  onError={(e) => {
                    e.target.src = defaultAvatar;
                  }}
                />
                <div className="flex-1 min-w-0 max-w-full overflow-hidden">
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="font-medium text-theme-text-primary dark:text-theme-dark-text text-sm md:text-base">{msg.sender.username}</span>
                    <span className="text-xs text-theme-text-secondary dark:text-theme-dark-text-secondary">
                      {new Date(msg.created_at).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true
                      })}
                    </span>
                  </div>
                  {msg.content && (
                    <div className="text-theme-text-primary dark:text-theme-dark-text text-sm md:text-base leading-relaxed mb-2">
                      <div className="break-words overflow-wrap-anywhere word-break-break-word whitespace-pre-wrap max-w-full">
                        {msg.content}
                        {msg.edited_at && (
                          <span className="text-xs text-theme-text-secondary ml-2 inline-block">
                            (edited)
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Media Display */}
                  {msg.media && (
                    <div className="mt-2">
                      {(() => {
                        if (isImage(msg.media)) {
                          return (
                            <img
                              src={msg.media}
                              alt="Shared image"
                              className="max-w-xs max-h-64 rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                              onClick={() => onMediaClick('image', msg.media)}
                              onLoad={() => { }}
                              onError={(e) => {
                                e.target.style.display = 'none';
                              }}
                            />
                          );
                        } else if (isValidVideoUrl(msg.media)) {
                          if (isValidYouTubeUrl(msg.media)) {
                            return (
                              <div 
                                className="relative max-w-xs max-h-64 rounded-lg cursor-pointer overflow-hidden"
                                onClick={() => onMediaClick('video', msg.media)}
                              >
                                <img
                                  src={getYouTubeThumbnail(msg.media)}
                                  alt="Video thumbnail"
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    const videoId = getYouTubeVideoId(msg.media);
                                    if (videoId) {
                                      e.target.src = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
                                    }
                                  }}
                                />
                                <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30 hover:bg-opacity-50 transition-all duration-200">
                                  <Svg type="play" className="w-12 h-12 text-white" />
                                </div>
                              </div>
                            );
                          } else {
                            return (
                              <div 
                                className="relative max-w-xs max-h-64 rounded-lg cursor-pointer overflow-hidden"
                                onClick={() => onMediaClick('video', msg.media)}
                              >
                                <video
                                  src={msg.media}
                                  className="w-full h-full object-cover"
                                  preload="metadata"
                                  onLoadedMetadata={() => { }}
                                  onError={() => {
                                    // Handle video error silently
                                  }}
                                />
                                <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30 hover:bg-opacity-50 transition-all duration-200">
                                  <Svg type="play" className="w-12 h-12 text-white" />
                                </div>
                              </div>
                            );
                          }
                        } else {
                          return (
                            <a
                              href={msg.media}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center space-x-2 px-3 py-2 bg-theme-blue-light text-theme-blue-dark rounded-lg hover:bg-theme-blue-lighter transition-colors"
                            >
                              <Svg type="file" className="w-4 h-4" />
                              <span className="text-sm">View File</span>
                            </a>
                          );
                        }
                      })()}
                    </div>
                  )}
                </div>

                {/* Message Actions */}
                {user && msg.sender.username === user.username && (
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex space-x-1 ml-2">
                    <button
                      onClick={() => handleEditMessage(msg)}
                      className="p-1 text-theme-text-secondary hover:text-theme-blue transition-colors"
                      title={t('messages.editMessage')}
                    >
                      <Svg type="edit" className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteMessage(msg)}
                      className="p-1 text-theme-text-secondary hover:text-theme-error hover:bg-theme-error-light rounded transition-colors"
                      title={t('messages.deleteMessage')}
                    >
                      <Svg type="delete" className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="text-center text-theme-text-secondary py-8 dark:bg-theme-dark-bg dark:text-theme-dark-text">
              <div className="text-center">
                <Svg type="message" className="w-16 h-16 mx-auto mb-4 text-theme-text-secondary dark:text-theme-dark-text" />
                <p className="dark:text-theme-dark-text">{newChat ? t('messages.startYourConversation') : t('messages.noMessages')}</p>
              </div>
            </div>
          )}
          
          

          {/* Scroll anchor for auto-scrolling */}
          <div ref={messagesEndRef} />
        </div>

        {isTyping && (
            <div className="flex items-start space-x-3 p-2 md:p-4">
              <img
                src={sender.avatar || defaultAvatar}
                alt={sender.username}
                className="w-10 h-10 rounded-md object-cover flex-shrink-0"
                onError={(e) => {
                  e.target.src = defaultAvatar;
                }}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2 mb-1">
                  <span className="font-medium text-theme-text-primary">{sender.username}</span>
                </div>
                <div className="text-theme-text-secondary text-sm italic">
                  {t('messages.isTyping')}
                </div>
              </div>
            </div>
          )}

          <div ref={myRef} />
        </div>
        {/* Media Modal */}
        <AnimatePresence>
          {modalShow && modalData && (
            <Modal setShowModal={setShowModal} showModal={modalShow}>
              {modalData}
            </Modal>
          )}
        </AnimatePresence>

        {/* New Message Indicator - Floating Panel */}
        {showNewMessageIndicator && (
          <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 z-10">
            <button
              onClick={handleNewMessageIndicatorClick}
              className="bg-theme-blue text-white px-4 py-2 rounded-full shadow-lg hover:bg-theme-blue-dark transition-colors flex items-center space-x-2 text-sm font-medium"
            >
              <span>{unreadCount > 1 ? `${unreadCount} new messages` : 'New message'}</span>
              <Svg type="down-arrow" className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Message Input */}
        <form onSubmit={handleSubmit} className="p-3 md:p-4 border-t border-theme-border-light dark:border-theme-dark-border bg-theme-less-white dark:bg-theme-dark-card flex-shrink-0">
          {/* Check if user is deleted */}
          {error?.response?.status === 404 && error?.response?.data?.error ? (
            <div className="text-center py-4">
              <div className="text-theme-error mb-2">
                <Svg type="alert" className="w-8 h-8 mx-auto mb-2" />
              </div>
              <p className="text-sm text-theme-text-secondary dark:text-theme-dark-text">
                {t('messages.cannotChatWithDeletedUser')}
              </p>
            </div>
          ) : (
            <>
              {/* File Preview */}
              {selectedFile && (
                <div className="mb-3 p-3 bg-theme-light-gray2 dark:bg-theme-dark-bg rounded-lg border border-theme-border-light dark:border-theme-dark-border">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      {filePreview ? (
                        <img src={filePreview} alt="Preview" className="w-12 h-12 object-cover rounded" />
                      ) : (
                        <div className="w-12 h-12 bg-theme-bg-tertiary dark:bg-theme-dark-card rounded flex items-center justify-center">
                          <Svg type="file" className="w-6 h-6 text-theme-text-secondary" />
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-medium text-theme-text-primary">{selectedFile.name}</p>
                        <p className="text-xs text-theme-text-secondary">
                          {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={removeFile}
                      className="text-theme-error p-1"
                    >
                      <Svg type="close" className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              <div className="flex items-end space-x-2 md:space-x-3">
                <input
                  ref={myRef}
                  type="text"
                  className="flex-1 bg-transparent dark:bg-theme-dark-card border-none outline-none px-2 py-2 text-sm md:text-base text-theme-text-primary dark:text-theme-dark-text"
                  placeholder={t('messages.typeMessage')}
                  value={message}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  disabled={isSending}
                />

                {/* File Upload Button - Fixed height */}
                <label className="w-10 h-10 md:w-12 md:h-12 bg-[rgba(0,0,0,0.01)] text-theme-text-primary rounded-lg cursor-pointer transition-colors flex-shrink-0 flex items-center justify-center">
                  <Svg type="add" className="w-7 h-7 md:w-9 md:h-9" />
                  <input
                    type="file"
                    onChange={handleFileSelect}
                    className="hidden"
                    accept="image/*,video/*,.pdf,.doc,.docx,.txt,.zip,.rar"
                  />
                </label>

                <button
                  type="submit"
                  disabled={(!message.trim() && !selectedFile) || isSending}
                  className="w-10 h-10 md:w-12 md:h-12 bg-theme-blue text-white rounded-lg hover:bg-theme-blue-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0 flex items-center justify-center"
                >
                  {isSending ? (
                    <div className="w-4 h-4 md:w-5 md:h-5 animate-spin">
                      <svg className="w-full h-full" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                      </svg>
                    </div>
                  ) : (
                    <Svg type="send" className="w-4 h-4 md:w-5 md:h-5" />
                  )}
                </button>
              </div>
            </>
          )}
        </form>

        {/* Edit Message Modal */}
        {editingMessage && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-theme-dark-card rounded-lg p-6 w-full max-w-md mx-4 border border-theme-border-light dark:border-theme-dark-border">
              <h3 className="text-lg font-medium text-theme-text-primary dark:text-theme-dark-text mb-4">{t('messages.editMessage')}</h3>
              <textarea
                value={editingMessage.content}
                onChange={(e) => setEditingMessage({ ...editingMessage, content: e.target.value })}
                className="w-full p-3 border border-theme-border-light dark:border-theme-dark-border rounded-lg resize-none focus:outline-none focus:border-theme-blue bg-theme-less-white dark:bg-theme-dark-bg text-theme-text-primary dark:text-theme-dark-text"
                rows={4}
                placeholder={t('messages.editPlaceholder')}
              />
              <div className="flex justify-end space-x-2 mt-4">
                <button
                  onClick={() => setEditingMessage(null)}
                  className="px-4 py-2 text-theme-text-secondary hover:text-theme-text-primary transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={() => handleSaveEdit(editingMessage.message_id, editingMessage.content)}
                  disabled={editMessageMutation.isPending}
                  className="px-4 py-2 bg-theme-blue text-white rounded-lg hover:bg-theme-blue-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {editMessageMutation.isPending ? t('common.saving') : t('common.save')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

Chat.propTypes = {
  sender: PropTypes.object.isRequired,
  setCurChat: PropTypes.func.isRequired,
  newChat: PropTypes.bool,
  showUserInfo: PropTypes.bool.isRequired,
  setShowUserInfo: PropTypes.func.isRequired,
  editingMessage: PropTypes.object,
  setEditingMessage: PropTypes.func.isRequired,
};

function UserInfoPanel({ user }) {
  const { t } = useTranslation();
  const { data: userProfile, isLoading } = useQuery({
    queryKey: ["userProfile", user.username],
    queryFn: async () => {
      return await axios.get(`/api/user/${user.username}`).then((res) => res.data);
    },
    enabled: !!user?.username,
  });

  const displayUser = userProfile || user;

  return (
    <div className="hidden lg:flex flex-col w-80 bg-theme-less-white dark:bg-theme-dark-card border-l border-theme-border-light dark:border-theme-dark-border flex-shrink-0 h-full overflow-hidden min-w-0 dark:text-theme-dark-text">
      <div className="p-4 xl:p-6 border-b border-theme-border-light dark:border-theme-dark-border flex-shrink-0">
        <div className="text-center">
          <img
            src={displayUser.avatar || defaultAvatar}
            alt={displayUser.username}
            className="w-16 h-16 xl:w-20 xl:h-20 rounded-md object-cover mx-auto mb-3 xl:mb-4"
            onError={(e) => {
              e.target.src = defaultAvatar;
            }}
          />
          <h3 className="text-lg xl:text-xl font-semibold text-theme-text-primary dark:text-theme-dark-text-secondary mb-1 truncate">{displayUser.username}</h3>
        </div>
      </div>

      <div className="p-3 xl:p-4 flex-1 overflow-y-auto min-h-0">
        <div className="space-y-3 xl:space-y-4">
          <div>
            <h4 className="text-xs xl:text-sm font-medium text-theme-text-secondary dark:text-theme-dark-text-secondary uppercase tracking-wide mb-2">{t('messages.aboutMe')}</h4>
            {isLoading ? (
              <div className="flex justify-center py-2">
                <LoadingSpinner size="w-4 h-4" />
              </div>
            ) : (
              <p className="text-theme-text-primary dark:text-theme-dark-text-secondary text-xs xl:text-sm leading-relaxed">
                {displayUser.bio && typeof displayUser.bio === 'string'
                  ? displayUser.bio
                  : t('messages.noBioYet')}
              </p>
            )}
          </div>

          <div>
            <h4 className="text-xs xl:text-sm font-medium text-theme-text-secondary dark:text-theme-dark-text-secondary uppercase tracking-wide mb-2">{t('messages.memberSince')}</h4>
            {isLoading ? (
              <div className="flex justify-center py-2">
                <LoadingSpinner size="w-4 h-4" />
              </div>
            ) : (
              <p className="text-theme-text-primary dark:text-theme-dark-text-secondary text-xs xl:text-sm">
                {displayUser.registrationDate
                  ? new Date(displayUser.registrationDate).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    })
                  : displayUser.registration_date
                    ? new Date(displayUser.registration_date).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })
                    : displayUser.created_at
                      ? new Date(displayUser.created_at).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })
                      : "Unknown"
                }
              </p>
            )}
          </div>

          <MutualSubthreads username={displayUser.username} />
        </div>
      </div>

      {/* Message Edit Modal - Temporarily disabled for debugging */}
      {/* {user && (
        <MessageEditModal
          message={editingMessage}
          isOpen={!!editingMessage}
          onClose={() => setEditingMessage(null)}
          onSave={handleSaveEdit}
        />
      )} */}
    </div>
  );
}

UserInfoPanel.propTypes = {
  user: PropTypes.object.isRequired,
};

function MutualSubthreads({ username }) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [showAll, setShowAll] = useState(false);
  const { data: mutualSubthreads, isLoading } = useQuery({
    queryKey: ["mutualSubthreads", username],
    queryFn: async () => {
      return await axios.get(`/api/mutual-subthreads/${username}`).then((res) => res.data);
    },
    enabled: !!username,
  });

  if (isLoading) {
    return (
      <div>
        <h4 className="text-xs xl:text-sm font-medium text-theme-text-secondary dark:text-theme-dark-text-secondary uppercase tracking-wide mb-2">
          {t('messages.mutualSubthreads')}
        </h4>
        <div className="flex justify-center py-2">
          <LoadingSpinner size="w-4 h-4" />
        </div>
      </div>
    );
  }

  const displaySubthreads = showAll ? mutualSubthreads : mutualSubthreads?.slice(0, 3);
  const hasMore = mutualSubthreads && Array.isArray(mutualSubthreads) && mutualSubthreads.length > 3;
  const needsScroll = mutualSubthreads && Array.isArray(mutualSubthreads) && mutualSubthreads.length > 5;

  return (
    <div>
      <h4 className="text-xs xl:text-sm font-medium text-theme-text-secondary dark:text-theme-dark-text-secondary uppercase tracking-wide mb-2">
        {t('messages.mutualSubthreads')}
      </h4>
      {mutualSubthreads && Array.isArray(mutualSubthreads) && mutualSubthreads.length > 0 ? (
        <div className={`space-y-2 ${needsScroll && showAll ? 'max-h-48 overflow-y-auto' : ''}`}>
          {(displaySubthreads || []).map((subthread) => (
            <div
              key={subthread.id}
              onClick={() => navigate(`/t/${subthread.name.replace(/^t\//, "")}`)}
              className="flex items-center space-x-2 p-2 rounded-lg hover:bg-theme-bg-tertiary dark:hover:bg-theme-dark-bg cursor-pointer transition-colors"
            >
              {subthread.logo ? (
                <img
                  src={subthread.logo}
                  alt={subthread.name.replace(/^t\//, "")}
                  className="w-6 h-6 rounded object-cover"
                  onError={(e) => {
                    // Fallback to colored circle if logo fails to load
                    e.target.style.display = 'none';
                    e.target.nextSibling.style.display = 'flex';
                  }}
                />
              ) : null}
              <div className={`w-6 h-6 bg-theme-blue rounded flex items-center justify-center ${subthread.logo ? 'hidden' : ''}`}>
                <span className="text-white text-xs font-medium">
                  {subthread.name.replace(/^t\//, "").charAt(0).toUpperCase()}
                </span>
              </div>
              <span className="text-xs text-theme-text-primary dark:text-theme-dark-text-secondary truncate">
                r/{subthread.name.replace(/^t\//, "")}
              </span>
            </div>
          ))}
          
          {/* Show More/Less Button */}
          {hasMore && (
            <button
              onClick={() => setShowAll(!showAll)}
              className="w-full text-xs font-bold text-theme-blue hover:text-theme-blue-dark transition-colors py-1 px-2 rounded hover:bg-theme-blue-light dark:hover:bg-theme-dark-bg"
            >
              {showAll ? t('messages.showLess') : t('messages.showMore')}
            </button>
          )}
        </div>
      ) : (
        <p className="text-xs text-theme-text-secondary dark:text-theme-dark-text-secondary">
          {t('messages.noMutualSubthreads')}
        </p>
      )}
    </div>
  );
}

MutualSubthreads.propTypes = {
  username: PropTypes.string.isRequired,
};