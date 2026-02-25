const express = require('express');
const router = express.Router();
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const Summary = require('../models/Summary');
const { authenticateToken } = require('../middleware/auth');

/**
 * @route   GET /api/conversation-log/:conversationId
 * @desc    Get complete conversation log with all messages
 * @access  Private
 */
router.get('/:conversationId', authenticateToken, async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const { includeDeleted, includeMetadata } = req.query;

    // Verify conversation exists and user has access
    const conversation = await Conversation.findById(conversationId);

    if (!conversation) {
      return res.status(404).json({
        error: {
          message: 'Conversation not found',
          code: 'CONVERSATION_NOT_FOUND'
        }
      });
    }

    if (conversation.doctor_id !== req.user.id && conversation.patient_id !== req.user.id) {
      return res.status(403).json({
        error: {
          message: 'Access denied',
          code: 'FORBIDDEN'
        }
      });
    }

    // Get all messages
    const messages = await Message.findByConversationId(conversationId, includeDeleted === 'true');

    // Get summary if exists
    const summary = await Summary.findByConversationId(conversationId);

    // Parse metadata
    let metadata = {};
    if (includeMetadata === 'true' && summary?.metadata) {
      try {
        metadata = JSON.parse(summary.metadata);
      } catch (e) {
        console.warn('Failed to parse summary metadata');
      }
    }

    res.json({
      success: true,
      data: {
        conversation: {
          id: conversation.id,
          doctorId: conversation.doctor_id,
          patientId: conversation.patient_id,
          doctorLanguage: conversation.doctor_language,
          patientLanguage: conversation.patient_language,
          title: conversation.title,
          status: conversation.status,
          createdAt: conversation.created_at,
          updatedAt: conversation.updated_at
        },
        messages: messages.map(msg => ({
          id: msg.id,
          senderId: msg.sender_id,
          senderRole: msg.sender_role,
          originalText: msg.original_text,
          translatedText: msg.translated_text,
          audioUrl: msg.audio_url,
          audioDuration: msg.audio_duration,
          messageType: msg.message_type || 'text',
          createdAt: msg.created_at,
          isDeleted: msg.is_deleted || false
        })),
        summary: summary ? {
          id: summary.id,
          content: summary.content,
          symptoms: summary.symptoms,
          diagnosis: summary.diagnosis,
          medications: summary.medications,
          followUpActions: summary.follow_up_actions,
          createdAt: summary.created_at,
          metadata
        } : null,
        statistics: {
          totalMessages: messages.length,
          textMessages: messages.filter(m => !m.audio_url).length,
          audioMessages: messages.filter(m => m.audio_url).length,
          doctorMessages: messages.filter(m => m.sender_role === 'doctor').length,
          patientMessages: messages.filter(m => m.sender_role === 'patient').length,
          hasSummary: !!summary
        }
      }
    });

  } catch (error) {
    console.error('Conversation log fetch error:', error);
    next({
      status: 500,
      message: 'Failed to fetch conversation log',
      code: 'LOG_FETCH_FAILED'
    });
  }
});

/**
 * @route   GET /api/conversation-log/user/history
 * @desc    Get conversation history for current user
 * @access  Private
 */
router.get('/user/history', authenticateToken, async (req, res, next) => {
  try {
    const {
      limit = 20,
      offset = 0,
      status,
      sortBy = 'created_at',
      sortOrder = 'DESC'
    } = req.query;

    // Get conversations for user
    const conversations = await Conversation.findByUserId(
      req.user.id,
      req.user.role,
      status,
      parseInt(limit),
      parseInt(offset),
      sortBy,
      sortOrder
    );

    // Enrich with message counts and summary info
    const enrichedConversations = await Promise.all(
      conversations.map(async (conv) => {
        const messages = await Message.findByConversationId(conv.id);
        const summary = await Summary.findByConversationId(conv.id);

        return {
          id: conv.id,
          doctorId: conv.doctor_id,
          patientId: conv.patient_id,
          doctorLanguage: conv.doctor_language,
          patientLanguage: conv.patient_language,
          title: conv.title,
          status: conv.status,
          createdAt: conv.created_at,
          updatedAt: conv.updated_at,
          messageCount: messages.length,
          lastMessageAt: messages.length > 0 ? messages[messages.length - 1].created_at : null,
          hasSummary: !!summary
        };
      })
    );

    res.json({
      success: true,
      data: {
        conversations: enrichedConversations,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          total: enrichedConversations.length
        }
      }
    });

  } catch (error) {
    console.error('Conversation history fetch error:', error);
    next({
      status: 500,
      message: 'Failed to fetch conversation history',
      code: 'HISTORY_FETCH_FAILED'
    });
  }
});

/**
 * @route   POST /api/conversation-log/search
 * @desc    Search conversations and messages
 * @access  Private
 */
router.post('/search', authenticateToken, async (req, res, next) => {
  try {
    const {
      query,
      searchIn = ['all'], // 'all', 'messages', 'summaries', 'titles'
      limit = 20,
      offset = 0,
      dateFrom,
      dateTo,
      status
    } = req.body;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        error: {
          message: 'Search query is required',
          code: 'INVALID_QUERY'
        }
      });
    }

    if (query.length < 2) {
      return res.status(400).json({
        error: {
          message: 'Search query must be at least 2 characters',
          code: 'QUERY_TOO_SHORT'
        }
      });
    }

    const results = {
      conversations: [],
      messages: [],
      summaries: []
    };

    // Search in conversations (titles)
    if (searchIn.includes('all') || searchIn.includes('titles')) {
      const conversations = await Conversation.search(
        req.user.id,
        req.user.role,
        query,
        status,
        dateFrom,
        dateTo,
        parseInt(limit),
        parseInt(offset)
      );
      results.conversations = conversations;
    }

    // Search in messages
    if (searchIn.includes('all') || searchIn.includes('messages')) {
      const messages = await Message.search(
        req.user.id,
        query,
        dateFrom,
        dateTo,
        parseInt(limit),
        parseInt(offset)
      );

      // Enrich with conversation info
      results.messages = await Promise.all(
        messages.map(async (msg) => {
          const conv = await Conversation.findById(msg.conversation_id);
          return {
            ...msg,
            conversationTitle: conv ? conv.title : 'Unknown',
            conversationStatus: conv ? conv.status : 'unknown'
          };
        })
      );
    }

    // Search in summaries
    if (searchIn.includes('all') || searchIn.includes('summaries')) {
      const summaries = await Summary.search(
        req.user.id,
        query,
        dateFrom,
        dateTo,
        parseInt(limit),
        parseInt(offset)
      );

      // Enrich with conversation info
      results.summaries = await Promise.all(
        summaries.map(async (summary) => {
          const conv = await Conversation.findById(summary.conversation_id);
          return {
            ...summary,
            conversationTitle: conv ? conv.title : 'Unknown',
            conversationStatus: conv ? conv.status : 'unknown'
          };
        })
      );
    }

    const totalResults = results.conversations.length +
                        results.messages.length +
                        results.summaries.length;

    res.json({
      success: true,
      data: {
        query,
        results,
        summary: {
          totalResults,
          conversationCount: results.conversations.length,
          messageCount: results.messages.length,
          summaryCount: results.summaries.length
        },
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset)
        }
      }
    });

  } catch (error) {
    console.error('Conversation search error:', error);
    next({
      status: 500,
      message: 'Search failed',
      code: 'SEARCH_FAILED'
    });
  }
});

/**
 * @route   GET /api/conversation-log/export/:conversationId
 * @desc    Export conversation log (JSON format)
 * @access  Private
 */
router.get('/export/:conversationId', authenticateToken, async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const { format = 'json' } = req.query;

    // Verify conversation and access
    const conversation = await Conversation.findById(conversationId);

    if (!conversation) {
      return res.status(404).json({
        error: {
          message: 'Conversation not found',
          code: 'CONVERSATION_NOT_FOUND'
        }
      });
    }

    if (conversation.doctor_id !== req.user.id && conversation.patient_id !== req.user.id) {
      return res.status(403).json({
        error: {
          message: 'Access denied',
          code: 'FORBIDDEN'
        }
      });
    }

    // Get full conversation data
    const messages = await Message.findByConversationId(conversationId);
    const summary = await Summary.findByConversationId(conversationId);

    const exportData = {
      exportDate: new Date().toISOString(),
      exportedBy: req.user.id,
      conversation: {
        id: conversation.id,
        doctorId: conversation.doctor_id,
        patientId: conversation.patient_id,
        doctorLanguage: conversation.doctor_language,
        patientLanguage: conversation.patient_language,
        title: conversation.title,
        status: conversation.status,
        createdAt: conversation.created_at,
        updatedAt: conversation.updated_at
      },
      messages: messages.map(msg => ({
        timestamp: msg.created_at,
        sender: {
          id: msg.sender_id,
          role: msg.sender_role
        },
        content: {
          original: msg.original_text,
          translated: msg.translated_text
        },
        audio: msg.audio_url ? {
          url: msg.audio_url,
          duration: msg.audio_duration
        } : null
      })),
      summary: summary ? {
        symptoms: summary.symptoms,
        diagnosis: summary.diagnosis,
        medications: summary.medications,
        followUpActions: summary.follow_up_actions,
        content: summary.content,
        generatedAt: summary.created_at
      } : null,
      statistics: {
        totalMessages: messages.length,
        messageByRole: {
          doctor: messages.filter(m => m.sender_role === 'doctor').length,
          patient: messages.filter(m => m.sender_role === 'patient').length
        },
        audioMessages: messages.filter(m => m.audio_url).length,
        textMessages: messages.filter(m => !m.audio_url).length
      }
    };

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=conversation-${conversationId}-${Date.now()}.json`
      );
      res.json(exportData);
    } else {
      res.status(400).json({
        error: {
          message: 'Unsupported export format',
          code: 'INVALID_FORMAT'
        }
      });
    }

  } catch (error) {
    console.error('Conversation export error:', error);
    next({
      status: 500,
      message: 'Failed to export conversation',
      code: 'EXPORT_FAILED'
    });
  }
});

/**
 * @route   GET /api/conversation-log/analytics
 * @desc    Get conversation analytics for current user
 * @access  Private
 */
router.get('/analytics', authenticateToken, async (req, res, next) => {
  try {
    const { period = '30d' } = req.query; // 7d, 30d, 90d, all

    // Calculate date range
    const now = new Date();
    let fromDate = null;

    if (period !== 'all') {
      const days = parseInt(period.replace('d', ''));
      fromDate = new Date(now);
      fromDate.setDate(fromDate.getDate() - days);
    }

    // Get all user conversations
    const conversations = await Conversation.findByUserId(
      req.user.id,
      req.user.role,
      null,
      1000,
      0
    );

    // Filter by date range
    const filteredConversations = fromDate
      ? conversations.filter(c => new Date(c.created_at) >= fromDate)
      : conversations;

    // Get messages for all conversations
    const allMessages = await Promise.all(
      filteredConversations.map(async (conv) => {
        return await Message.findByConversationId(conv.id);
      })
    );

    const flatMessages = allMessages.flat();

    // Calculate analytics
    const analytics = {
      period,
      dateRange: {
        from: fromDate ? fromDate.toISOString() : null,
        to: now.toISOString()
      },
      overview: {
        totalConversations: filteredConversations.length,
        totalMessages: flatMessages.length,
        activeConversations: filteredConversations.filter(c => c.status === 'active').length,
        endedConversations: filteredConversations.filter(c => c.status === 'ended').length
      },
      messagesByRole: {
        doctor: flatMessages.filter(m => m.sender_role === 'doctor').length,
        patient: flatMessages.filter(m => m.sender_role === 'patient').length
      },
      messageTypeStats: {
        textMessages: flatMessages.filter(m => !m.audio_url).length,
        audioMessages: flatMessages.filter(m => m.audio_url).length
      },
      languageStats: {},
      dailyActivity: []
    };

    // Language stats
    filteredConversations.forEach(conv => {
      const langPair = `${conv.doctor_language}-${conv.patient_language}`;
      analytics.languageStats[langPair] = (analytics.languageStats[langPair] || 0) + 1;
    });

    // Daily activity (last 30 days)
    for (let i = 29; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      const dayMessages = flatMessages.filter(m =>
        m.created_at.startsWith(dateStr)
      );

      analytics.dailyActivity.push({
        date: dateStr,
        messageCount: dayMessages.length,
        conversationCount: filteredConversations.filter(c =>
          c.created_at.startsWith(dateStr)
        ).length
      });
    }

    res.json({
      success: true,
      data: analytics
    });

  } catch (error) {
    console.error('Analytics fetch error:', error);
    next({
      status: 500,
      message: 'Failed to fetch analytics',
      code: 'ANALYTICS_FETCH_FAILED'
    });
  }
});

module.exports = router;
