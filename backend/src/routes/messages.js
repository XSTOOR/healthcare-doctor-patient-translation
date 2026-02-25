const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const { authenticateToken } = require('../middleware/auth');

// Get messages for a conversation
router.get('/:conversationId', authenticateToken, async (req, res, next) => {
  try {
    const conversation = await Conversation.findById(req.params.conversationId);

    if (!conversation) {
      return res.status(404).json({ error: { message: 'Conversation not found' } });
    }

    // Verify user is part of conversation
    if (conversation.doctor_id !== req.user.id && conversation.patient_id !== req.user.id) {
      return res.status(403).json({ error: { message: 'Access denied' } });
    }

    const messages = await Message.findByConversationId(req.params.conversationId);
    res.json({ messages });
  } catch (error) {
    next(error);
  }
});

// Send a message to a conversation
router.post('/:conversationId', authenticateToken, async (req, res, next) => {
  try {
    const conversation = await Conversation.findById(req.params.conversationId);

    if (!conversation) {
      return res.status(404).json({ error: { message: 'Conversation not found' } });
    }

    // Verify user is part of conversation
    if (conversation.doctor_id !== req.user.id && conversation.patient_id !== req.user.id) {
      return res.status(403).json({ error: { message: 'Access denied' } });
    }

    const { text, senderRole } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ error: { message: 'Message text is required' } });
    }

    // Create message
    const messageId = await Message.create({
      conversationId: req.params.conversationId,
      senderId: req.user.id,
      senderRole: senderRole || req.user.role,
      originalText: text,
      translatedText: text, // Will be updated by translation service if needed
      messageType: 'text'
    });

    // Fetch the created message with user info
    const messages = await Message.findByConversationId(req.params.conversationId);
    const message = messages.find(m => m.id === messageId);

    // Emit socket event for real-time update (if socket.io is available)
    if (req.io) {
      req.io.to(`conversation_${req.params.conversationId}`).emit('newMessage', {
        conversationId: req.params.conversationId,
        message: message
      });
    }

    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      data: message
    });
  } catch (error) {
    next(error);
  }
});

// Search within conversation
router.get('/:conversationId/search/:term', authenticateToken, async (req, res, next) => {
  try {
    const conversation = await Conversation.findById(req.params.conversationId);

    if (!conversation) {
      return res.status(404).json({ error: { message: 'Conversation not found' } });
    }

    // Verify user is part of conversation
    if (conversation.doctor_id !== req.user.id && conversation.patient_id !== req.user.id) {
      return res.status(403).json({ error: { message: 'Access denied' } });
    }

    const messages = await Message.searchInConversation(req.params.conversationId, req.params.term);
    res.json({ messages });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
