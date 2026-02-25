const express = require('express');
const router = express.Router();
const translationService = require('../services/translationService');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const { authenticateToken } = require('../middleware/auth');

/**
 * @route   POST /api/realtime/message
 * @desc    Send and translate message in real-time
 * @access  Private
 */
router.post('/message', authenticateToken, async (req, res, next) => {
  try {
    const {
      conversationId,
      text,
      audioUrl,
      audioDuration,
      messageType = 'text'
    } = req.body;

    // Validation
    if (!conversationId) {
      return res.status(400).json({
        error: {
          message: 'Conversation ID is required',
          code: 'INVALID_CONVERSATION'
        }
      });
    }

    if (!text && !audioUrl) {
      return res.status(400).json({
        error: {
          message: 'Either text or audio URL is required',
          code: 'NO_CONTENT'
        }
      });
    }

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

    // Determine target language based on sender role
    let targetLanguage;
    if (req.user.role === 'doctor') {
      targetLanguage = conversation.patient_language;
    } else {
      targetLanguage = conversation.doctor_language;
    }

    // Translate text if provided
    let translatedText = '';
    if (text) {
      translatedText = await translationService.translateText(text, targetLanguage);
    }

    // Save message to database
    const messageId = await Message.create({
      conversationId,
      senderId: req.user.id,
      senderRole: req.user.role,
      originalText: text || '',
      translatedText,
      audioUrl,
      audioDuration,
      messageType,
      targetLanguage
    });

    const savedMessage = await Message.findById(messageId);

    // Emit real-time event via Socket.IO
    const io = req.app.get('io');
    if (io) {
      io.to(`conversation:${conversationId}`).emit('newMessage', {
        messageId: savedMessage.id,
        conversationId,
        sender: {
          id: req.user.id,
          role: req.user.role
        },
        content: {
          original: text || '',
          translated: translatedText
        },
        audio: audioUrl ? {
          url: audioUrl,
          duration: audioDuration
        } : null,
        messageType,
        timestamp: savedMessage.created_at
      });
    }

    res.json({
      success: true,
      message: 'Message sent successfully',
      data: {
        message: savedMessage,
        translation: {
          originalText: text || '',
          translatedText,
          sourceLanguage: req.user.role === 'doctor' ? conversation.doctor_language : conversation.patient_language,
          targetLanguage
        }
      }
    });

  } catch (error) {
    console.error('Real-time message error:', error);
    next({
      status: 500,
      message: 'Failed to send message',
      code: 'MESSAGE_SEND_FAILED'
    });
  }
});

/**
 * @route   POST /api/realtime/translate-message
 * @desc    Translate a message with role-based routing
 * @access  Private
 */
router.post('/translate-message', authenticateToken, async (req, res, next) => {
  try {
    const { text, messageId, targetLanguage } = req.body;

    // Validation
    if (!text && !messageId) {
      return res.status(400).json({
        error: {
          message: 'Either text or message ID is required',
          code: 'INVALID_INPUT'
        }
      });
    }

    let sourceText = text;
    let sourceLanguage = null;
    let conversation = null;

    // If messageId provided, fetch message and conversation details
    if (messageId) {
      const message = await Message.findById(messageId);

      if (!message) {
        return res.status(404).json({
          error: {
            message: 'Message not found',
            code: 'MESSAGE_NOT_FOUND'
          }
        });
      }

      sourceText = message.original_text;
      sourceLanguage = req.user.role === 'doctor' ? 'en' : null; // Default assumption

      conversation = await Conversation.findById(message.conversation_id);

      if (!conversation) {
        return res.status(404).json({
          error: {
            message: 'Conversation not found',
            code: 'CONVERSATION_NOT_FOUND'
          }
        });
      }

      // Auto-determine target language if not provided
      if (!targetLanguage) {
        if (req.user.role === 'doctor') {
          // Doctor viewing patient message - translate to doctor's language
          targetLanguage = conversation.doctor_language;
        } else {
          // Patient viewing doctor message - translate to patient's language
          targetLanguage = conversation.patient_language;
        }
      }
    }

    // Perform translation
    const translatedText = await translationService.translateText(sourceText, targetLanguage);

    res.json({
      success: true,
      data: {
        originalText: sourceText,
        translatedText,
        sourceLanguage: sourceLanguage || 'auto',
        targetLanguage,
        direction: req.user.role === 'doctor' ? 'patient-to-doctor' : 'doctor-to-patient',
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Message translation error:', error);
    next({
      status: 500,
      message: 'Translation failed',
      code: 'TRANSLATION_FAILED'
    });
  }
});

/**
 * @route   POST /api/realtime/batch-translate
 * @desc    Translate multiple messages at once
 * @access  Private
 */
router.post('/batch-translate', authenticateToken, async (req, res, next) => {
  try {
    const { messageIds, targetLanguage } = req.body;

    // Validation
    if (!Array.isArray(messageIds) || messageIds.length === 0) {
      return res.status(400).json({
        error: {
          message: 'Message IDs must be a non-empty array',
          code: 'INVALID_MESSAGE_IDS'
        }
      });
    }

    if (messageIds.length > 50) {
      return res.status(400).json({
        error: {
          message: 'Maximum 50 messages per batch request',
          code: 'BATCH_TOO_LARGE'
        }
      });
    }

    // Determine target language from conversation if not provided
    let finalTargetLanguage = targetLanguage;

    if (!finalTargetLanguage && messageIds.length > 0) {
      const firstMessage = await Message.findById(messageIds[0]);
      if (firstMessage) {
        const conversation = await Conversation.findById(firstMessage.conversation_id);
        if (conversation) {
          finalTargetLanguage = req.user.role === 'doctor'
            ? conversation.doctor_language
            : conversation.patient_language;
        }
      }
    }

    if (!finalTargetLanguage) {
      return res.status(400).json({
        error: {
          message: 'Could not determine target language',
          code: 'NO_TARGET_LANGUAGE'
        }
      });
    }

    // Translate all messages
    const translations = await Promise.all(
      messageIds.map(async (msgId) => {
        const message = await Message.findById(msgId);

        if (!message) {
          return {
            messageId: msgId,
            error: 'Message not found'
          };
        }

        const translatedText = await translationService.translateText(
          message.original_text,
          finalTargetLanguage
        );

        return {
          messageId: msgId,
          originalText: message.original_text,
          translatedText,
          sourceLanguage: 'auto',
          targetLanguage: finalTargetLanguage
        };
      })
    );

    res.json({
      success: true,
      data: {
        translations,
        count: translations.length,
        targetLanguage: finalTargetLanguage,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Batch translation error:', error);
    next({
      status: 500,
      message: 'Batch translation failed',
      code: 'BATCH_TRANSLATION_FAILED'
    });
  }
});

/**
 * @route   GET /api/realtime/conversation/:conversationId/typing
 * @desc    Handle typing indicators
 * @access  Private
 */
router.post('/conversation/:conversationId/typing', authenticateToken, async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const { isTyping } = req.body;

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

    // Emit typing indicator via Socket.IO
    const io = req.app.get('io');
    if (io) {
      io.to(`conversation:${conversationId}`).emit('typingIndicator', {
        conversationId,
        userId: req.user.id,
        userRole: req.user.role,
        isTyping: !!isTyping,
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      success: true,
      message: 'Typing indicator sent'
    });

  } catch (error) {
    console.error('Typing indicator error:', error);
    next({
      status: 500,
      message: 'Failed to send typing indicator',
      code: 'TYPING_FAILED'
    });
  }
});

/**
 * @route   POST /api/realtime/conversation/:conversationId/read-receipt
 * @desc    Mark messages as read
 * @access  Private
 */
router.post('/conversation/:conversationId/read-receipt', authenticateToken, async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const { messageId } = req.body;

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

    // Update read receipt in database
    if (messageId) {
      await Message.markAsRead(messageId, req.user.id);
    } else {
      await Message.markConversationAsRead(conversationId, req.user.id);
    }

    // Emit read receipt via Socket.IO
    const io = req.app.get('io');
    if (io) {
      io.to(`conversation:${conversationId}`).emit('readReceipt', {
        conversationId,
        messageId,
        userId: req.user.id,
        userRole: req.user.role,
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      success: true,
      message: 'Read receipt sent'
    });

  } catch (error) {
    console.error('Read receipt error:', error);
    next({
      status: 500,
      message: 'Failed to send read receipt',
      code: 'READ_RECEIPT_FAILED'
    });
  }
});

/**
 * @route   GET /api/realtime/conversation/:conversationId/unread-count
 * @desc    Get unread message count
 * @access  Private
 */
router.get('/conversation/:conversationId/unread-count', authenticateToken, async (req, res, next) => {
  try {
    const { conversationId } = req.params;

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

    const unreadCount = await Message.getUnreadCount(conversationId, req.user.id);

    res.json({
      success: true,
      data: {
        conversationId,
        unreadCount,
        userId: req.user.id
      }
    });

  } catch (error) {
    console.error('Unread count fetch error:', error);
    next({
      status: 500,
      message: 'Failed to fetch unread count',
      code: 'UNREAD_COUNT_FAILED'
    });
  }
});

module.exports = router;
