const express = require('express');
const router = express.Router();
const summaryService = require('../services/summaryService');
const Summary = require('../models/Summary');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

/**
 * @route   POST /api/ai-summary/generate
 * @desc    Generate AI-powered medical summary for a conversation
 * @access  Private (Doctor only)
 */
router.post('/generate', authenticateToken, authorizeRoles('doctor'), async (req, res, next) => {
  try {
    const { conversationId } = req.body;

    // Validation
    if (!conversationId) {
      return res.status(400).json({
        error: {
          message: 'Conversation ID is required',
          code: 'INVALID_CONVERSATION_ID'
        }
      });
    }

    // Verify conversation exists and user is the doctor
    const conversation = await Conversation.findById(conversationId);

    if (!conversation) {
      return res.status(404).json({
        error: {
          message: 'Conversation not found',
          code: 'CONVERSATION_NOT_FOUND'
        }
      });
    }

    if (conversation.doctor_id !== req.user.id) {
      return res.status(403).json({
        error: {
          message: 'You are not authorized to generate summary for this conversation',
          code: 'FORBIDDEN'
        }
      });
    }

    // Get all messages for the conversation
    const messages = await Message.findByConversationId(conversationId);

    if (messages.length === 0) {
      return res.status(400).json({
        error: {
          message: 'Cannot generate summary for conversation with no messages',
          code: 'NO_MESSAGES'
        }
      });
    }

    // Check if summary already exists
    const existingSummary = await Summary.findByConversationId(conversationId);
    if (existingSummary) {
      return res.status(409).json({
        error: {
          message: 'Summary already exists for this conversation',
          code: 'SUMMARY_EXISTS',
          existingSummary
        }
      });
    }

    // Generate AI summary
    const summaryData = await summaryService.generateMedicalSummary(
      messages,
      conversation.doctor_language,
      conversation.patient_language
    );

    // Save summary to database
    const summaryId = await Summary.create({
      conversationId,
      content: summaryData.content,
      symptoms: summaryData.symptoms,
      diagnosis: summaryData.diagnosis,
      medications: summaryData.medications,
      followUpActions: summaryData.followUpActions,
      metadata: JSON.stringify({
        messageCount: messages.length,
        generatedBy: req.user.id,
        generatedAt: new Date().toISOString(),
        doctorLanguage: conversation.doctor_language,
        patientLanguage: conversation.patient_language
      })
    });

    const savedSummary = await Summary.findById(summaryId);

    res.status(201).json({
      success: true,
      message: 'Medical summary generated successfully',
      data: savedSummary
    });

  } catch (error) {
    console.error('AI summary generation error:', error);
    next({
      status: 500,
      message: 'Failed to generate medical summary',
      code: 'SUMMARY_GENERATION_FAILED'
    });
  }
});

/**
 * @route   POST /api/ai-summary/regenerate
 * @desc    Regenerate AI-powered medical summary (overwrite existing)
 * @access  Private (Doctor only)
 */
router.post('/regenerate', authenticateToken, authorizeRoles('doctor'), async (req, res, next) => {
  try {
    const { conversationId } = req.body;

    // Validation
    if (!conversationId) {
      return res.status(400).json({
        error: {
          message: 'Conversation ID is required',
          code: 'INVALID_CONVERSATION_ID'
        }
      });
    }

    // Verify conversation exists and user is the doctor
    const conversation = await Conversation.findById(conversationId);

    if (!conversation) {
      return res.status(404).json({
        error: {
          message: 'Conversation not found',
          code: 'CONVERSATION_NOT_FOUND'
        }
      });
    }

    if (conversation.doctor_id !== req.user.id) {
      return res.status(403).json({
        error: {
          message: 'You are not authorized to regenerate summary for this conversation',
          code: 'FORBIDDEN'
        }
      });
    }

    // Get all messages for the conversation
    const messages = await Message.findByConversationId(conversationId);

    if (messages.length === 0) {
      return res.status(400).json({
        error: {
          message: 'Cannot generate summary for conversation with no messages',
          code: 'NO_MESSAGES'
        }
      });
    }

    // Generate new AI summary
    const summaryData = await summaryService.generateMedicalSummary(
      messages,
      conversation.doctor_language,
      conversation.patient_language
    );

    // Check if summary exists and update or create new
    const existingSummary = await Summary.findByConversationId(conversationId);

    let summaryId;
    if (existingSummary) {
      // Update existing summary
      summaryId = await Summary.update(existingSummary.id, {
        content: summaryData.content,
        symptoms: summaryData.symptoms,
        diagnosis: summaryData.diagnosis,
        medications: summaryData.medications,
        followUpActions: summaryData.followUpActions,
        metadata: JSON.stringify({
          messageCount: messages.length,
          generatedBy: req.user.id,
          generatedAt: new Date().toISOString(),
          doctorLanguage: conversation.doctor_language,
          patientLanguage: conversation.patient_language,
          regenerated: true
        })
      });
    } else {
      // Create new summary
      summaryId = await Summary.create({
        conversationId,
        content: summaryData.content,
        symptoms: summaryData.symptoms,
        diagnosis: summaryData.diagnosis,
        medications: summaryData.medications,
        followUpActions: summaryData.followUpActions,
        metadata: JSON.stringify({
          messageCount: messages.length,
          generatedBy: req.user.id,
          generatedAt: new Date().toISOString(),
          doctorLanguage: conversation.doctor_language,
          patientLanguage: conversation.patient_language
        })
      });
    }

    const savedSummary = await Summary.findById(summaryId);

    res.json({
      success: true,
      message: 'Medical summary regenerated successfully',
      data: savedSummary
    });

  } catch (error) {
    console.error('AI summary regeneration error:', error);
    next({
      status: 500,
      message: 'Failed to regenerate medical summary',
      code: 'SUMMARY_REGENERATION_FAILED'
    });
  }
});

/**
 * @route   GET /api/ai-summary/:conversationId
 * @desc    Get AI summary for a conversation
 * @access  Private
 */
router.get('/:conversationId', authenticateToken, async (req, res, next) => {
  try {
    const { conversationId } = req.params;

    // Verify conversation exists and user is part of it
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
          message: 'You are not authorized to view summary for this conversation',
          code: 'FORBIDDEN'
        }
      });
    }

    const summary = await Summary.findByConversationId(conversationId);

    if (!summary) {
      return res.status(404).json({
        error: {
          message: 'No summary found for this conversation',
          code: 'SUMMARY_NOT_FOUND'
        }
      });
    }

    res.json({
      success: true,
      data: summary
    });

  } catch (error) {
    console.error('Fetch summary error:', error);
    next({
      status: 500,
      message: 'Failed to fetch summary',
      code: 'SUMMARY_FETCH_FAILED'
    });
  }
});

/**
 * @route   GET /api/ai-summary/:conversationId/structured
 * @desc    Get structured AI summary with specific sections
 * @access  Private
 */
router.get('/:conversationId/structured', authenticateToken, async (req, res, next) => {
  try {
    const { conversationId } = req.params;

    // Verify conversation exists
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

    const summary = await Summary.findByConversationId(conversationId);

    if (!summary) {
      return res.status(404).json({
        error: {
          message: 'No summary found for this conversation',
          code: 'SUMMARY_NOT_FOUND'
        }
      });
    }

    // Parse metadata if available
    let metadata = {};
    if (summary.metadata) {
      try {
        metadata = JSON.parse(summary.metadata);
      } catch (e) {
        console.warn('Failed to parse summary metadata');
      }
    }

    // Return structured summary
    res.json({
      success: true,
      data: {
        conversationId,
        generatedAt: summary.created_at,
        generatedBy: metadata.generatedBy,
        sections: {
          symptoms: {
            title: 'Symptoms',
            content: summary.symptoms || 'No symptoms recorded'
          },
          diagnosis: {
            title: 'Diagnosis',
            content: summary.diagnosis || 'Diagnosis pending'
          },
          medications: {
            title: 'Medications & Treatments',
            content: summary.medications || 'No medications prescribed'
          },
          followUpActions: {
            title: 'Follow-up Actions',
            content: summary.followUpActions || 'No specific follow-up required'
          },
          summary: {
            title: 'Consultation Summary',
            content: summary.content || 'Summary not available'
          }
        },
        metadata: {
          messageCount: metadata.messageCount,
          doctorLanguage: metadata.doctorLanguage,
          patientLanguage: metadata.patientLanguage,
          regenerated: metadata.regenerated || false
        }
      }
    });

  } catch (error) {
    console.error('Fetch structured summary error:', error);
    next({
      status: 500,
      message: 'Failed to fetch structured summary',
      code: 'STRUCTURED_SUMMARY_FETCH_FAILED'
    });
  }
});

/**
 * @route   POST /api/ai-summary/batch
 * @desc    Generate summaries for multiple conversations
 * @access  Private (Doctor only)
 */
router.post('/batch', authenticateToken, authorizeRoles('doctor'), async (req, res, next) => {
  try {
    const { conversationIds } = req.body;

    // Validation
    if (!Array.isArray(conversationIds) || conversationIds.length === 0) {
      return res.status(400).json({
        error: {
          message: 'Conversation IDs must be a non-empty array',
          code: 'INVALID_CONVERSATION_IDS'
        }
      });
    }

    if (conversationIds.length > 10) {
      return res.status(400).json({
        error: {
          message: 'Maximum 10 conversations per batch request',
          code: 'BATCH_TOO_LARGE'
        }
      });
    }

    const results = [];
    const errors = [];

    for (const conversationId of conversationIds) {
      try {
        // Verify conversation and permissions
        const conversation = await Conversation.findById(conversationId);

        if (!conversation) {
          errors.push({
            conversationId,
            error: 'Conversation not found'
          });
          continue;
        }

        if (conversation.doctor_id !== req.user.id) {
          errors.push({
            conversationId,
            error: 'Access denied'
          });
          continue;
        }

        // Check if summary already exists
        const existingSummary = await Summary.findByConversationId(conversationId);
        if (existingSummary) {
          results.push({
            conversationId,
            status: 'exists',
            summary: existingSummary
          });
          continue;
        }

        // Get messages and generate summary
        const messages = await Message.findByConversationId(conversationId);

        if (messages.length === 0) {
          errors.push({
            conversationId,
            error: 'No messages in conversation'
          });
          continue;
        }

        const summaryData = await summaryService.generateMedicalSummary(
          messages,
          conversation.doctor_language,
          conversation.patient_language
        );

        const summaryId = await Summary.create({
          conversationId,
          content: summaryData.content,
          symptoms: summaryData.symptoms,
          diagnosis: summaryData.diagnosis,
          medications: summaryData.medications,
          followUpActions: summaryData.followUpActions,
          metadata: JSON.stringify({
            messageCount: messages.length,
            generatedBy: req.user.id,
            generatedAt: new Date().toISOString()
          })
        });

        const savedSummary = await Summary.findById(summaryId);

        results.push({
          conversationId,
          status: 'created',
          summary: savedSummary
        });

      } catch (error) {
        console.error(`Error generating summary for conversation ${conversationId}:`, error);
        errors.push({
          conversationId,
          error: error.message
        });
      }
    }

    res.json({
      success: true,
      data: {
        results,
        errors,
        summary: {
          total: conversationIds.length,
          successful: results.length,
          failed: errors.length
        }
      }
    });

  } catch (error) {
    console.error('Batch summary generation error:', error);
    next({
      status: 500,
      message: 'Batch summary generation failed',
      code: 'BATCH_SUMMARY_FAILED'
    });
  }
});

module.exports = router;
