const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const { translateText } = require('../services/translationService');

const onlineUsers = new Map();
const userSockets = new Map();
const conversationRooms = new Map();

const setupWebSocket = (io) => {
  // Authentication middleware for Socket.IO
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];

      if (!token) {
        return next(new Error('Authentication token required'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
      const user = await User.findById(decoded.userId);

      if (!user) {
        return next(new Error('User not found'));
      }

      socket.userId = user.id;
      socket.userRole = user.role;
      socket.userEmail = user.email;
      next();
    } catch (error) {
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.userId} (${socket.userRole})`);

    // Store user socket mapping
    userSockets.set(socket.userId, socket.id);
    onlineUsers.set(socket.userId, {
      id: socket.userId,
      role: socket.userRole,
      email: socket.userEmail,
      socketId: socket.id
    });

    // Join user's personal room
    socket.join(`user-${socket.userId}`);

    // Broadcast online status
    io.emit('user-online', {
      userId: socket.userId,
      role: socket.userRole
    });

    // Join conversation room
    socket.on('join-conversation', async ({ conversationId }) => {
      try {
        const conversation = await Conversation.findById(conversationId);

        if (!conversation) {
          socket.emit('error', { message: 'Conversation not found' });
          return;
        }

        // Verify user is part of conversation
        if (conversation.doctor_id !== socket.userId && conversation.patient_id !== socket.userId) {
          socket.emit('error', { message: 'Access denied' });
          return;
        }

        // Check if user is already in a conversation room
        const currentConversationId = conversationRooms.get(socket.userId);
        if (currentConversationId) {
          // Leave the current conversation room first
          socket.leave(`conversation-${currentConversationId}`);
          socket.to(`conversation-${currentConversationId}`).emit('user-left', {
            userId: socket.userId,
            role: socket.userRole
          });
        }

        // Join the new conversation room
        socket.join(`conversation-${conversationId}`);
        conversationRooms.set(socket.userId, conversationId);

        // Get recent messages
        const messages = await Message.getRecentMessages(conversationId, 50);

        socket.emit('conversation-joined', {
          conversationId,
          messages,
          doctorLanguage: conversation.doctor_language,
          patientLanguage: conversation.patient_language
        });

        // Notify other participant
        socket.to(`conversation-${conversationId}`).emit('user-joined', {
          userId: socket.userId,
          role: socket.userRole
        });
      } catch (error) {
        console.error('Error joining conversation:', error);
        socket.emit('error', { message: 'Failed to join conversation' });
      }
    });

    // Leave conversation room
    socket.on('leave-conversation', () => {
      const conversationId = conversationRooms.get(socket.userId);
      if (conversationId) {
        socket.leave(`conversation-${conversationId}`);
        conversationRooms.delete(socket.userId);

        socket.to(`conversation-${conversationId}`).emit('user-left', {
          userId: socket.userId,
          role: socket.userRole
        });
      }
    });

    // Handle new message
    socket.on('send-message', async (data) => {
      try {
        const { conversationId, originalText, audioData, messageType } = data;

        const conversation = await Conversation.findById(conversationId);

        if (!conversation) {
          socket.emit('error', { message: 'Conversation not found' });
          return;
        }

        // Verify user is part of conversation
        if (conversation.doctor_id !== socket.userId && conversation.patient_id !== socket.userId) {
          socket.emit('error', { message: 'Access denied' });
          return;
        }

        // Determine target language
        const targetLanguage = socket.userRole === 'doctor'
          ? conversation.patient_language
          : conversation.doctor_language;

        // Translate message
        const translatedText = await translateText(originalText, targetLanguage);

        // Save message
        const messageId = await Message.create({
          conversationId,
          senderId: socket.userId,
          senderRole: socket.userRole,
          originalText,
          translatedText,
          audioUrl: audioData?.url,
          audioDuration: audioData?.duration,
          messageType: messageType || 'text'
        });

        // Get saved message
        const savedMessage = await Message.findById(messageId);

        // Broadcast to conversation room
        io.to(`conversation-${conversationId}`).emit('new-message', {
          id: savedMessage.id,
          conversationId: savedMessage.conversation_id,
          senderId: savedMessage.sender_id,
          senderRole: savedMessage.sender_role,
          originalText: savedMessage.original_text,
          translatedText: savedMessage.translated_text,
          audioUrl: savedMessage.audio_url,
          audioDuration: savedMessage.audio_duration,
          messageType: savedMessage.message_type,
          createdAt: savedMessage.created_at
        });

      } catch (error) {
        console.error('Error sending message:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // Handle typing indicator
    socket.on('typing', ({ conversationId }) => {
      socket.to(`conversation-${conversationId}`).emit('user-typing', {
        userId: socket.userId,
        role: socket.userRole
      });
    });

    // Handle stop typing indicator
    socket.on('stop-typing', ({ conversationId }) => {
      socket.to(`conversation-${conversationId}`).emit('user-stop-typing', {
        userId: socket.userId
      });
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.userId}`);

      const conversationId = conversationRooms.get(socket.userId);
      if (conversationId) {
        socket.to(`conversation-${conversationId}`).emit('user-left', {
          userId: socket.userId,
          role: socket.userRole
        });
      }

      userSockets.delete(socket.userId);
      onlineUsers.delete(socket.userId);
      conversationRooms.delete(socket.userId);

      io.emit('user-offline', {
        userId: socket.userId,
        role: socket.userRole
      });
    });

    // Handle errors
    socket.on('error', (error) => {
      console.error('Socket error:', error);
    });
  });

  return io;
};

module.exports = setupWebSocket;
