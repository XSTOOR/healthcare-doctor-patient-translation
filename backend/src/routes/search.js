const express = require('express');
const router = express.Router();
const Conversation = require('../models/Conversation');
const { authenticateToken } = require('../middleware/auth');

// Global search across conversations
router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const { q } = req.query;

    if (!q) {
      return res.status(400).json({ error: { message: 'Search query is required' } });
    }

    const conversations = await Conversation.search(req.user.id, req.user.role, q);
    res.json({ conversations, query: q });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
