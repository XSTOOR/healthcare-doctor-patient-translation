const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');
const { authenticateToken } = require('../middleware/auth');
const Message = require('../models/Message');

// Configure multer for audio file storage
const storage = multer.diskStorage({
  destination: async function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../../audio');
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: function (req, file, cb) {
    const uniqueName = `${uuidv4()}-${Date.now()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

// File filter for audio files
const audioFileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    'audio/mpeg',       // MP3
    'audio/mp3',
    'audio/wav',        // WAV
    'audio/wave',
    'audio/x-wav',
    'audio/ogg',        // OGG
    'audio/aac',        // AAC
    'audio/m4a',        // M4A
    'audio/x-m4a'
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only audio files are allowed.'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: audioFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

/**
 * @route   POST /api/audio/upload
 * @desc    Upload and store audio file
 * @access  Private
 */
router.post('/upload', authenticateToken, upload.single('audio'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: {
          message: 'No audio file provided',
          code: 'NO_FILE'
        }
      });
    }

    const { conversationId, duration } = req.body;

    // Generate audio URL
    const audioUrl = `/audio/${req.file.filename}`;

    // If conversationId provided, save message reference
    let messageId = null;
    if (conversationId) {
      const Message = require('../models/Message');
      messageId = await Message.create({
        conversationId,
        senderId: req.user.id,
        senderRole: req.user.role,
        originalText: '',
        translatedText: '',
        audioUrl,
        audioDuration: duration || null,
        messageType: 'audio'
      });
    }

    res.json({
      success: true,
      message: 'Audio uploaded successfully',
      data: {
        audioUrl,
        filename: req.file.filename,
        originalName: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype,
        conversationId,
        messageId,
        uploadedBy: req.user.id,
        uploadedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Audio upload error:', error);
    next({
      status: 500,
      message: 'Failed to upload audio file',
      code: 'AUDIO_UPLOAD_FAILED'
    });
  }
});

/**
 * @route   POST /api/audio/upload-multiple
 * @desc    Upload multiple audio files
 * @access  Private
 */
router.post('/upload-multiple', authenticateToken, upload.array('audios', 5), async (req, res, next) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        error: {
          message: 'No audio files provided',
          code: 'NO_FILES'
        }
      });
    }

    const { conversationId } = req.body;

    const audioFiles = req.files.map(file => ({
      audioUrl: `/audio/${file.filename}`,
      filename: file.filename,
      originalName: file.originalname,
      size: file.size,
      mimetype: file.mimetype
    }));

    res.json({
      success: true,
      message: `${req.files.length} audio file(s) uploaded successfully`,
      data: {
        files: audioFiles,
        count: req.files.length,
        conversationId,
        uploadedBy: req.user.id,
        uploadedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Multiple audio upload error:', error);
    next({
      status: 500,
      message: 'Failed to upload audio files',
      code: 'MULTI_AUDIO_UPLOAD_FAILED'
    });
  }
});

/**
 * @route   GET /api/audio/:filename
 * @desc    Get audio file metadata
 * @access  Private
 */
router.get('/:filename', authenticateToken, async (req, res, next) => {
  try {
    const { filename } = req.params;
    const audioPath = path.join(__dirname, '../../audio', filename);

    // Check if file exists
    try {
      await fs.access(audioPath);
    } catch (error) {
      return res.status(404).json({
        error: {
          message: 'Audio file not found',
          code: 'FILE_NOT_FOUND'
        }
      });
    }

    const stats = await fs.stat(audioPath);

    res.json({
      success: true,
      data: {
        filename,
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
        audioUrl: `/audio/${filename}`
      }
    });

  } catch (error) {
    console.error('Audio metadata fetch error:', error);
    next({
      status: 500,
      message: 'Failed to fetch audio metadata',
      code: 'METADATA_FETCH_FAILED'
    });
  }
});

/**
 * @route   DELETE /api/audio/:filename
 * @desc    Delete audio file
 * @access  Private
 */
router.delete('/:filename', authenticateToken, async (req, res, next) => {
  try {
    const { filename } = req.params;
    const audioPath = path.join(__dirname, '../../audio', filename);

    // Check if file exists
    try {
      await fs.access(audioPath);
    } catch (error) {
      return res.status(404).json({
        error: {
          message: 'Audio file not found',
          code: 'FILE_NOT_FOUND'
        }
      });
    }

    // Delete file
    await fs.unlink(audioPath);

    // Update messages that reference this audio
    await Message.updateAudioUrl(filename, null);

    res.json({
      success: true,
      message: 'Audio file deleted successfully',
      data: {
        filename,
        deletedAt: new Date().toISOString(),
        deletedBy: req.user.id
      }
    });

  } catch (error) {
    console.error('Audio deletion error:', error);
    next({
      status: 500,
      message: 'Failed to delete audio file',
      code: 'AUDIO_DELETION_FAILED'
    });
  }
});

/**
 * @route   GET /api/audio/conversation/:conversationId
 * @desc    Get all audio files for a conversation
 * @access  Private
 */
router.get('/conversation/:conversationId', authenticateToken, async (req, res, next) => {
  try {
    const { conversationId } = req.params;

    // Verify user has access to conversation
    const Conversation = require('../models/Conversation');
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

    // Get messages with audio
    const messages = await Message.findByConversationId(conversationId);
    const audioMessages = messages.filter(msg => msg.audio_url);

    // Get file info for each audio
    const audioFiles = [];
    for (const msg of audioMessages) {
      const filename = path.basename(msg.audio_url);
      const audioPath = path.join(__dirname, '../../audio', filename);

      try {
        const stats = await fs.stat(audioPath);
        audioFiles.push({
          messageId: msg.id,
          audioUrl: msg.audio_url,
          filename,
          size: stats.size,
          duration: msg.audio_duration,
          senderRole: msg.sender_role,
          senderId: msg.sender_id,
          createdAt: msg.created_at
        });
      } catch (error) {
        // File doesn't exist, skip
        console.warn(`Audio file not found: ${filename}`);
      }
    }

    res.json({
      success: true,
      data: {
        conversationId,
        audioFiles,
        count: audioFiles.length
      }
    });

  } catch (error) {
    console.error('Conversation audio fetch error:', error);
    next({
      status: 500,
      message: 'Failed to fetch audio files',
      code: 'AUDIO_FETCH_FAILED'
    });
  }
});

/**
 * @route   POST /api/audio/process
 * @desc    Process audio file (transcribe and store)
 * @access  Private
 */
router.post('/process', authenticateToken, upload.single('audio'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: {
          message: 'No audio file provided',
          code: 'NO_FILE'
        }
      });
    }

    const { conversationId, targetLanguage } = req.body;

    // Transcribe audio
    const transcriptionService = require('../services/transcriptionService');
    const transcription = await transcriptionService.transcribeAudio(req.file.path);

    // Generate audio URL
    const audioUrl = `/audio/${req.file.filename}`;

    // Save transcribed message
    let messageId = null;
    let translatedText = null;

    if (conversationId) {
      const translationService = require('../services/translationService');

      // Translate if target language provided
      if (targetLanguage) {
        translatedText = await translationService.translateText(transcription.text, targetLanguage);
      }

      messageId = await Message.create({
        conversationId,
        senderId: req.user.id,
        senderRole: req.user.role,
        originalText: transcription.text,
        translatedText: translatedText || '',
        audioUrl,
        audioDuration: transcription.duration,
        messageType: 'audio',
        transcriptionConfidence: transcription.confidence
      });
    }

    res.json({
      success: true,
      message: 'Audio processed successfully',
      data: {
        audioUrl,
        filename: req.file.filename,
        transcription: {
          text: transcription.text,
          confidence: transcription.confidence,
          language: transcription.language
        },
        translation: translatedText ? {
          text: translatedText,
          targetLanguage
        } : null,
        messageId,
        conversationId,
        processedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Audio processing error:', error);
    next({
      status: 500,
      message: 'Failed to process audio file',
      code: 'AUDIO_PROCESSING_FAILED'
    });
  }
});

/**
 * @route   GET /api/audio/storage/stats
 * @desc    Get audio storage statistics
 * @access  Private (Doctor/Admin)
 */
router.get('/storage/stats', authenticateToken, async (req, res, next) => {
  try {
    if (req.user.role !== 'doctor' && req.user.role !== 'admin') {
      return res.status(403).json({
        error: {
          message: 'Access denied',
          code: 'FORBIDDEN'
        }
      });
    }

    const audioDir = path.join(__dirname, '../../audio');

    let stats = {
      totalFiles: 0,
      totalSize: 0,
      files: []
    };

    try {
      const files = await fs.readdir(audioDir);

      for (const file of files) {
        const filePath = path.join(audioDir, file);
        const fileStats = await fs.stat(filePath);

        stats.totalFiles++;
        stats.totalSize += fileStats.size;
        stats.files.push({
          filename: file,
          size: fileStats.size,
          created: fileStats.birthtime
        });
      }

    } catch (error) {
      // Directory doesn't exist or is empty
      console.warn('Audio directory not found or empty');
    }

    res.json({
      success: true,
      data: {
        ...stats,
        totalSizeMB: (stats.totalSize / (1024 * 1024)).toFixed(2),
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Storage stats error:', error);
    next({
      status: 500,
      message: 'Failed to fetch storage statistics',
      code: 'STATS_FETCH_FAILED'
    });
  }
});

module.exports = router;
