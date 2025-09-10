import { useCallback } from 'react';
import AuthConsumer from '../components/AuthContext.jsx';

export default function useSocket(roomName) {
  const { socket } = AuthConsumer();
  
  const emit = useCallback((event, data) => {
    if (socket && socket.connected) {
      socket.emit(event, data);
    }
  }, [socket]);

  return { 
    socket, 
    connected: socket?.connected || false, 
    emit 
  };
}
