const express = require('express');
const router = express.Router();
const translationService = require('../services/translationService');
const { authenticateToken } = require('../middleware/auth');

/**
 * @route   POST /api/translation/translate
 * @desc    Translate text to target language
 * @access  Private (Doctor/Patient)
 */
router.post('/translate', authenticateToken, async (req, res, next) => {
  try {
    const { text, targetLanguage, sourceLanguage } = req.body;

    // Validation
    if (!text || typeof text !== 'string') {
      return res.status(400).json({
        error: {
          message: 'Text is required and must be a string',
          code: 'INVALID_TEXT'
        }
      });
    }

    if (text.length > 2000) {
      return res.status(400).json({
        error: {
          message: 'Text exceeds maximum length of 2000 characters',
          code: 'TEXT_TOO_LONG'
        }
      });
    }

    if (!targetLanguage || typeof targetLanguage !== 'string') {
      return res.status(400).json({
        error: {
          message: 'Target language is required',
          code: 'INVALID_TARGET_LANGUAGE'
        }
      });
    }

    // Check if target language is supported
    const supportedLanguages = translationService.getSupportedLanguages();
    const isSupported = supportedLanguages.some(lang => lang.code === targetLanguage);

    if (!isSupported) {
      return res.status(400).json({
        error: {
          message: `Target language '${targetLanguage}' is not supported`,
          code: 'UNSUPPORTED_LANGUAGE',
          supportedLanguages: supportedLanguages.map(lang => lang.code)
        }
      });
    }

    // Perform translation
    const translatedText = await translationService.translateText(text, targetLanguage);

    // Detect source language if not provided
    const detectedLanguage = sourceLanguage || await translationService.detectLanguage(text);

    res.json({
      success: true,
      data: {
        originalText: text,
        translatedText,
        sourceLanguage: detectedLanguage,
        targetLanguage,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Translation error:', error);
    next({
      status: 500,
      message: 'Translation service error',
      code: 'TRANSLATION_FAILED'
    });
  }
});

/**
 * @route   POST /api/translation/translate-batch
 * @desc    Translate multiple texts at once
 * @access  Private (Doctor/Patient)
 */
router.post('/translate-batch', authenticateToken, async (req, res, next) => {
  try {
    const { texts, targetLanguage } = req.body;

    // Validation
    if (!Array.isArray(texts) || texts.length === 0) {
      return res.status(400).json({
        error: {
          message: 'Texts must be a non-empty array',
          code: 'INVALID_TEXTS_ARRAY'
        }
      });
    }

    if (texts.length > 50) {
      return res.status(400).json({
        error: {
          message: 'Maximum 50 texts per batch request',
          code: 'BATCH_TOO_LARGE'
        }
      });
    }

    if (!targetLanguage) {
      return res.status(400).json({
        error: {
          message: 'Target language is required',
          code: 'INVALID_TARGET_LANGUAGE'
        }
      });
    }

    // Translate all texts
    const translations = await Promise.all(
      texts.map(async (text) => {
        const translatedText = await translationService.translateText(text, targetLanguage);
        return {
          originalText: text,
          translatedText,
          targetLanguage
        };
      })
    );

    res.json({
      success: true,
      data: {
        translations,
        count: translations.length,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Batch translation error:', error);
    next({
      status: 500,
      message: 'Batch translation service error',
      code: 'BATCH_TRANSLATION_FAILED'
    });
  }
});

/**
 * @route   POST /api/translation/doctor-to-patient
 * @desc    Translate doctor's message to patient's language
 * @access  Private (Doctor only)
 */
router.post('/doctor-to-patient', authenticateToken, async (req, res, next) => {
  try {
    const { text, patientLanguage, doctorLanguage } = req.body;

    // Role check - only doctors can use this endpoint
    if (req.user.role !== 'doctor') {
      return res.status(403).json({
        error: {
          message: 'Only doctors can use this endpoint',
          code: 'FORBIDDEN'
        }
      });
    }

    // Validation
    if (!text || typeof text !== 'string') {
      return res.status(400).json({
        error: {
          message: 'Text is required',
          code: 'INVALID_TEXT'
        }
      });
    }

    if (!patientLanguage) {
      return res.status(400).json({
        error: {
          message: 'Patient language is required',
          code: 'INVALID_PATIENT_LANGUAGE'
        }
      });
    }

    // Translate to patient's language
    const translatedText = await translationService.translateText(text, patientLanguage);

    res.json({
      success: true,
      data: {
        originalText: text,
        translatedText,
        sourceLanguage: doctorLanguage || 'en',
        targetLanguage: patientLanguage,
        direction: 'doctor-to-patient',
        senderRole: 'doctor',
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Doctor to patient translation error:', error);
    next({
      status: 500,
      message: 'Translation service error',
      code: 'TRANSLATION_FAILED'
    });
  }
});

/**
 * @route   POST /api/translation/patient-to-doctor
 * @desc    Translate patient's message to doctor's language
 * @access  Private (Patient only)
 */
router.post('/patient-to-doctor', authenticateToken, async (req, res, next) => {
  try {
    const { text, doctorLanguage, patientLanguage } = req.body;

    // Role check - only patients can use this endpoint
    if (req.user.role !== 'patient') {
      return res.status(403).json({
        error: {
          message: 'Only patients can use this endpoint',
          code: 'FORBIDDEN'
        }
      });
    }

    // Validation
    if (!text || typeof text !== 'string') {
      return res.status(400).json({
        error: {
          message: 'Text is required',
          code: 'INVALID_TEXT'
        }
      });
    }

    if (!doctorLanguage) {
      return res.status(400).json({
        error: {
          message: 'Doctor language is required',
          code: 'INVALID_DOCTOR_LANGUAGE'
        }
      });
    }

    // Translate to doctor's language
    const translatedText = await translationService.translateText(text, doctorLanguage);

    res.json({
      success: true,
      data: {
        originalText: text,
        translatedText,
        sourceLanguage: patientLanguage || await translationService.detectLanguage(text),
        targetLanguage: doctorLanguage,
        direction: 'patient-to-doctor',
        senderRole: 'patient',
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Patient to doctor translation error:', error);
    next({
      status: 500,
      message: 'Translation service error',
      code: 'TRANSLATION_FAILED'
    });
  }
});

/**
 * @route   GET /api/translation/languages
 * @desc    Get list of supported languages
 * @access  Public
 */
router.get('/languages', (req, res) => {
  try {
    const languages = translationService.getSupportedLanguages();

    res.json({
      success: true,
      data: {
        languages,
        count: languages.length
      }
    });

  } catch (error) {
    console.error('Languages fetch error:', error);
    res.status(500).json({
      error: {
        message: 'Failed to fetch supported languages',
        code: 'LANGUAGES_FETCH_FAILED'
      }
    });
  }
});

/**
 * @route   POST /api/translation/detect-language
 * @desc    Detect the language of provided text
 * @access  Private
 */
router.post('/detect-language', authenticateToken, async (req, res, next) => {
  try {
    const { text } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({
        error: {
          message: 'Text is required for language detection',
          code: 'INVALID_TEXT'
        }
      });
    }

    const detectedLanguage = await translationService.detectLanguage(text);
    const supportedLanguages = translationService.getSupportedLanguages();
    const languageInfo = supportedLanguages.find(lang => lang.code === detectedLanguage);

    res.json({
      success: true,
      data: {
        text,
        detectedLanguage,
        languageName: languageInfo ? languageInfo.name : 'Unknown',
        confidence: 0.95, // Mock confidence value
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Language detection error:', error);
    next({
      status: 500,
      message: 'Language detection service error',
      code: 'DETECTION_FAILED'
    });
  }
});

/**
 * @route   GET /api/translation/health
 * @desc    Check translation service health and API connectivity
 * @access  Public
 */
router.get('/health', async (req, res) => {
  try {
    const testResult = await translationService.testConnection();

    res.json({
      success: true,
      data: {
        status: testResult.success ? 'healthy' : 'unhealthy',
        apiConfigured: !!process.env.TRANSLATION_API_KEY,
        api: testResult.api || 'None',
        latency: testResult.latency,
        meetsLatencyRequirement: testResult.meetsLatencyRequirement,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Translation health check error:', error);
    res.status(500).json({
      error: {
        message: 'Health check failed',
        code: 'HEALTH_CHECK_FAILED'
      }
    });
  }
});

module.exports = router;
