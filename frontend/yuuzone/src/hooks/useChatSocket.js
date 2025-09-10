import { useEffect, useState, useCallback } from "react";
import AuthConsumer from "../components/AuthContext";
import { useTranslation } from "react-i18next";

/**
 * Custom hook for managing chat-specific Socket.IO connections
 * Uses the existing socket from AuthContext and handles chat room management
 */
export default function useChatSocket(currentUser, chatPartner) {
  const { socket } = AuthConsumer();
  const { t } = useTranslation();
  const [connected, setConnected] = useState(false);
  const [chatRoom, setChatRoom] = useState(null);

  // Track socket connection status
  useEffect(() => {
    if (!socket) return;

    const handleConnect = () => {
      setConnected(true);
    };

    const handleDisconnect = () => {
      setConnected(false);
    };

    const handleJoinSuccess = (data) => {
      if (data.room && data.room.startsWith('chat_')) {
        // Room joined successfully - no action needed
      }
    };

    // Set initial connection state
    setConnected(socket.connected);

    // Listen for connection events
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('join_success', handleJoinSuccess);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('join_success', handleJoinSuccess);
    };
  }, [socket]);

  // Don't return early - let the hook initialize and wait for parameters
  // This allows the hook to work even if parameters are initially undefined

  // Generate consistent room name (alphabetical order)
  const generateRoomName = useCallback((user1, user2) => {
    if (!user1 || !user2) {
      return null;
    }
    const sortedUsers = [user1, user2].sort();
    const roomName = `chat_${sortedUsers[0]}_${sortedUsers[1]}`;
    return roomName;
  }, []);

  // Monitor socket connection status
  useEffect(() => {
    if (!socket) return;

    const handleConnect = () => {
      setConnected(true);
    };

    const handleDisconnect = () => {
      setConnected(false);
    };

    const handleConnectError = (error) => {
      setConnected(false);
    };

    // Check if already connected
    if (socket.connected) {
      setConnected(true);
    }

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleConnectError);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("connect_error", handleConnectError);
    };
  }, [socket, t]);

  // Join/leave chat rooms when chat partner changes
  useEffect(() => {
    // Wait for all required data to be available
    if (!socket || !currentUser || !chatPartner) {
      return;
    }

    // Wait for socket to be connected
    if (!connected) {
      return;
    }

    const roomName = generateRoomName(currentUser, chatPartner);
    if (!roomName) {
      return;
    }

    // Leave previous room if exists and different
    if (chatRoom && chatRoom !== roomName) {
      socket.emit("leave", { room: chatRoom });
    }

    // Only join if not already in this room
    if (chatRoom !== roomName) {
      // Force join the room regardless of previous state

      // Emit the join event with the room name
      socket.emit("join", { room: roomName });

      // Also join user-specific rooms for notifications
      if (currentUser) {
        const userRoom = `user_${currentUser}`;
        socket.emit("join", { room: userRoom });
      }

      setChatRoom(roomName);
    }

    return () => {
      if (roomName && chatRoom === roomName) {
        socket.emit("leave", { room: roomName });
        setChatRoom(null);
      }
    };
  }, [socket, connected, currentUser, chatPartner, generateRoomName, chatRoom, t]);

  // Message event handlers
  const onMessage = useCallback((callback) => {
    if (!socket) {
      return () => {};
    }

    const handleMessage = (data) => {
      callback(data);
    };

    // Remove any existing listeners first to prevent duplicates
    socket.off("new_message", handleMessage);
    socket.on("new_message", handleMessage);

    return () => {
      socket.off("new_message", handleMessage);
    };
  }, [socket]);

  const onTyping = useCallback((callback) => {
    if (!socket) return () => {};

    const handleTyping = (data) => {
      callback(data);
    };

    socket.on("user_typing", handleTyping);

    return () => {
      socket.off("user_typing", handleTyping);
    };
  }, [socket]);

  const onStopTyping = useCallback((callback) => {
    if (!socket) return () => {};

    const handleStopTyping = (data) => {
      callback(data);
    };

    socket.on("user_stop_typing", handleStopTyping);

    return () => {
      socket.off("user_stop_typing", handleStopTyping);
    };
  }, [socket]);

  // Message edit event handler
  const onMessageEdit = useCallback((callback) => {
    if (!socket) return () => {};

    const handleMessageEdit = (data) => {
      callback(data);
    };

    socket.on("message_edited", handleMessageEdit);

    return () => {
      socket.off("message_edited", handleMessageEdit);
    };
  }, [socket]);

  // Message delete event handler
  const onMessageDelete = useCallback((callback) => {
    if (!socket) return () => {};

    const handleMessageDelete = (data) => {
      callback(data);
    };

    socket.on("message_deleted", handleMessageDelete);

    return () => {
      socket.off("message_deleted", handleMessageDelete);
    };
  }, [socket]);

  // Send message via socket
  const sendMessage = useCallback((messageData) => {
    if (!socket || !chatRoom) return;

    socket.emit("new_message", {
      room: chatRoom,
      ...messageData
    });
  }, [socket, chatRoom]);

  // Send typing indicator
  const sendTyping = useCallback(() => {
    if (!socket || !chatRoom || !currentUser) return;

    socket.emit("typing", {
      room: chatRoom,
      user: currentUser
    });
  }, [socket, chatRoom, currentUser]);

  // Send stop typing indicator
  const sendStopTyping = useCallback(() => {
    if (!socket || !chatRoom || !currentUser) return;

    socket.emit("stop_typing", {
      room: chatRoom,
      user: currentUser
    });
  }, [socket, chatRoom, currentUser]);

  return {
    connected,
    chatRoom,
    onMessage,
    onTyping,
    onStopTyping,
    onMessageEdit,
    onMessageDelete,
    sendMessage,
    sendTyping,
    sendStopTyping
  };
}
