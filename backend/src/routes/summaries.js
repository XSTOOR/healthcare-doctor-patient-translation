const express = require('express');
const router = express.Router();
const Summary = require('../models/Summary');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const { authenticateToken } = require('../middleware/auth');
const { generateMedicalSummary } = require('../services/summaryService');

// Get summary for a conversation
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

    const summary = await Summary.findByConversationId(req.params.conversationId);
    res.json({ summary });
  } catch (error) {
    next(error);
  }
});

// Generate AI summary for a conversation
router.post('/:conversationId/generate', authenticateToken, async (req, res, next) => {
  try {
    const conversation = await Conversation.findById(req.params.conversationId);

    if (!conversation) {
      return res.status(404).json({ error: { message: 'Conversation not found' } });
    }

    // Only doctors can generate summaries
    if (conversation.doctor_id !== req.user.id) {
      return res.status(403).json({ error: { message: 'Only doctors can generate summaries' } });
    }

    // Get all messages
    const messages = await Message.findByConversationId(req.params.conversationId);

    if (messages.length === 0) {
      return res.status(400).json({ error: { message: 'No messages to summarize' } });
    }

    // Generate AI summary
    const summaryData = await generateMedicalSummary(
      messages,
      conversation.doctor_language,
      conversation.patient_language
    );

    // Save summary
    const summaryId = await Summary.create({
      conversationId: req.params.conversationId,
      content: summaryData.content,
      symptoms: summaryData.symptoms,
      diagnosis: summaryData.diagnosis,
      medications: summaryData.medications,
      followUpActions: summaryData.followUpActions,
      generatedBy: req.user.id
    });

    const summary = await Summary.findById(summaryId);

    res.status(201).json({
      message: 'Summary generated successfully',
      summary
    });
  } catch (error) {
    next(error);
  }
});

// Get all summaries for user
router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const summaries = await Summary.getAllSummaries(req.user.id, req.user.role);
    res.json({ summaries });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
