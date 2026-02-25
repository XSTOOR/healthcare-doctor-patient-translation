const express = require('express');
const router = express.Router();
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { validateConversation } = require('../middleware/validation');

// Get all conversations for current user
router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const conversations = await Conversation.findByUserId(req.user.id, req.user.role);
    res.json({ conversations });
  } catch (error) {
    next(error);
  }
});

// Create new conversation
router.post('/', authenticateToken, authorizeRoles('doctor'), validateConversation, async (req, res, next) => {
  try {
    const { patientId, patientLanguage, doctorLanguage, title, action } = req.body;

    // Check if active conversation exists
    const existing = await Conversation.getActiveConversation(req.user.id, patientId);
    if (existing) {
      // If action is 'reuse', return the existing conversation
      if (action === 'reuse') {
        return res.status(200).json({
          message: 'Reusing existing conversation',
          conversation: existing,
          reused: true
        });
      }

      // If action is 'end', end the existing conversation and create a new one
      if (action === 'end_and_create') {
        await Conversation.updateStatus(existing.id, 'ended');
      } else {
        // Default behavior: return error with existing conversation details
        return res.status(409).json({
          error: {
            message: 'Active conversation already exists',
            existingConversation: existing,
            canReuse: true,
            canEnd: true
          }
        });
      }
    }

    const conversationId = await Conversation.create({
      doctorId: req.user.id,
      patientId,
      doctorLanguage: doctorLanguage || 'en',
      patientLanguage,
      title: title || `Consultation - ${new Date().toLocaleDateString()}`
    });

    const conversation = await Conversation.findById(conversationId);

    res.status(201).json({
      message: 'Conversation created successfully',
      conversation,
      reused: false
    });
  } catch (error) {
    next(error);
  }
});

// Get single conversation with messages
router.get('/:id', authenticateToken, async (req, res, next) => {
  try {
    const conversation = await Conversation.findById(req.params.id);

    if (!conversation) {
      return res.status(404).json({ error: { message: 'Conversation not found' } });
    }

    // Verify user is part of conversation
    if (conversation.doctor_id !== req.user.id && conversation.patient_id !== req.user.id) {
      return res.status(403).json({ error: { message: 'Access denied' } });
    }

    const messages = await Message.findByConversationId(req.params.id);

    res.json({
      conversation,
      messages
    });
  } catch (error) {
    next(error);
  }
});

// Update conversation status
router.patch('/:id/status', authenticateToken, async (req, res, next) => {
  try {
    const { status } = req.body;

    if (!['active', 'ended', 'archived'].includes(status)) {
      return res.status(400).json({ error: { message: 'Invalid status' } });
    }

    const conversation = await Conversation.findById(req.params.id);

    if (!conversation) {
      return res.status(404).json({ error: { message: 'Conversation not found' } });
    }

    // Verify user is part of conversation
    if (conversation.doctor_id !== req.user.id && conversation.patient_id !== req.user.id) {
      return res.status(403).json({ error: { message: 'Access denied' } });
    }

    await Conversation.updateStatus(req.params.id, status);

    const updated = await Conversation.findById(req.params.id);

    res.json({
      message: 'Conversation status updated',
      conversation: updated
    });
  } catch (error) {
    next(error);
  }
});

// Search conversations
router.get('/search/:term', authenticateToken, async (req, res, next) => {
  try {
    const { term } = req.params;
    const conversations = await Conversation.search(req.user.id, req.user.role, term);
    res.json({ conversations });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
