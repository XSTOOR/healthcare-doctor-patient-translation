import { io } from 'socket.io-client';

let socket = null;

export const initSocket = () => {
  const token = localStorage.getItem('token');

  if (!token) {
    console.error('No auth token found');
    return null;
  }

  const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || '';

  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 5
  });

  socket.on('connect', () => {
    console.log('Connected to server');
  });

  socket.on('connect_error', (error) => {
    console.error('Connection error:', error);
  });

  socket.on('disconnect', (reason) => {
    console.log('Disconnected:', reason);
  });

  socket.on('error', (error) => {
    console.error('Socket error:', error);
  });

  return socket;
};

export const getSocket = () => {
  if (!socket) {
    return initSocket();
  }
  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

export const joinConversation = (conversationId) => {
  const socketInstance = getSocket();
  if (socketInstance) {
    socketInstance.emit('join-conversation', { conversationId });
  }
};

export const leaveConversation = () => {
  const socketInstance = getSocket();
  if (socketInstance) {
    socketInstance.emit('leave-conversation');
  }
};

export const sendMessage = (data) => {
  const socketInstance = getSocket();
  if (socketInstance) {
    socketInstance.emit('send-message', data);
  }
};

export const sendTyping = (conversationId) => {
  const socketInstance = getSocket();
  if (socketInstance) {
    socketInstance.emit('typing', { conversationId });
  }
};

export const sendStopTyping = (conversationId) => {
  const socketInstance = getSocket();
  if (socketInstance) {
    socketInstance.emit('stop-typing', { conversationId });
  }
};

export default initSocket;
