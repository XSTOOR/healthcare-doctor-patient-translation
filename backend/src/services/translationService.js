// Translation Service
// This service provides translation capabilities using multiple APIs
// Supports: MyMemory (free), RapidAPI (Google Translate, Microsoft, DeepL)
// Primary: MyMemory API (free tier, no key required)
// Fallback: RapidAPI options if configured

const axios = require('axios');

// Import MyMemory service
const myMemoryService = require('./myMemoryService');

// Get API key from environment (for RapidAPI fallbacks)
const TRANSLATION_API_KEY = process.env.TRANSLATION_API_KEY;

// Get preferred translation provider from environment
const TRANSLATION_PROVIDER = process.env.TRANSLATION_PROVIDER || 'mymemory'; // Options: 'mymemory', 'rapidapi'

// Supported languages for healthcare
const SUPPORTED_LANGUAGES = {
  'en': 'English',
  'es': 'Spanish',
  'zh': 'Chinese (Simplified)',
  'zh-TW': 'Chinese (Traditional)',
  'ar': 'Arabic',
  'fr': 'French',
  'de': 'German',
  'pt': 'Portuguese',
  'ru': 'Russian',
  'hi': 'Hindi',
  'vi': 'Vietnamese',
  'ko': 'Korean',
  'ja': 'Japanese',
  'it': 'Italian',
  'nl': 'Dutch',
  'pl': 'Polish',
  'tr': 'Turkish',
  'fa': 'Persian',
  'uk': 'Ukrainian',
  'th': 'Thai',
  'id': 'Indonesian',
  'bn': 'Bengali',
  'ta': 'Tamil',
  'te': 'Telugu',
  'mr': 'Marathi',
  'ur': 'Urdu',
  'el': 'Greek',
  'he': 'Hebrew',
  'ro': 'Romanian',
  'hu': 'Hungarian',
  'cs': 'Czech',
  'sv': 'Swedish',
  'da': 'Danish',
  'fi': 'Finnish',
  'no': 'Norwegian'
};

// Get list of supported languages from MyMemory
function getMyMemoryLanguages() {
  return myMemoryService.getSupportedLanguages();
}

// List of RapidAPI translation endpoints to try (fallback options)
const TRANSLATION_APIS = [
  {
    name: 'Google Translate',
    host: 'google-translate1.p.rapidapi.com',
    path: '/language/translate/v2',
    format: (key, text, target, source) => ({
      url: `https://google-translate1.p.rapidapi.com/language/translate/v2?key=${key}&q=${encodeURIComponent(text)}&target=${target}${source ? `&source=${source}` : ''}&format=text`,
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        'X-RapidAPI-Key': key,
        'X-RapidAPI-Host': 'google-translate1.p.rapidapi.com'
      },
      extractFn: (data) => data?.data?.translations?.[0]?.translatedText
    })
  },
  {
    name: 'Microsoft Translator',
    host: 'microsoft-translator-text.p.rapidapi.com',
    path: '/translate',
    format: (key, text, target, source) => ({
      url: `https://microsoft-translator-text.p.rapidapi.com/translate?to=${target}&api-version=3.0`,
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'X-RapidAPI-Key': key,
        'X-RapidAPI-Host': 'microsoft-translator-text.p.rapidapi.com'
      },
      data: [{ Text: text }],
      extractFn: (data) => data?.[0]?.translations?.[0]?.text
    })
  },
  {
    name: 'DeepL Translator',
    host: 'deep-translator1.p.rapidapi.com',
    path: '/language/translate',
    format: (key, text, target, source) => ({
      url: `https://deep-translator1.p.rapidapi.com/language/translate/v2`,
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'X-RapidAPI-Key': key,
        'X-RapidAPI-Host': 'deep-translator1.p.rapidapi.com'
      },
      params: {
        q: text,
        source: source || 'auto',
        target: target,
        format: 'text'
      },
      extractFn: (data) => data?.data?.translations?.[0]?.translatedText
    })
  },
  {
    name: 'Translation API',
    host: 'translation-api1.p.rapidapi.com',
    path: '/v1/translator',
    format: (key, text, target, source) => ({
      url: `https://translation-api1.p.rapidapi.com/v1/translator`,
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'X-RapidAPI-Key': key,
        'X-RapidAPI-Host': 'translation-api1.p.rapidapi.com'
      },
      data: {
        text: text,
        from: source || 'en',
        to: target
      },
      extractFn: (data) => data?.translation_text || data?.translated_text
    })
  }
];

// Track working API index
let workingApiIndex = 0;

/**
 * Translate text using available translation APIs
 * @param {string} text - Text to translate
 * @param {string} targetLanguage - Target language code
 * @param {string} sourceLanguage - Source language code (optional, auto-detected if not provided)
 * @returns {Promise<string>} Translated text
 */
async function translateText(text, targetLanguage, sourceLanguage = null) {
  const startTime = Date.now();

  try {
    // Validate inputs
    if (!text || typeof text !== 'string') {
      throw new Error('Invalid text input');
    }

    if (!targetLanguage) {
      throw new Error('Target language is required');
    }

    // If source language same as target, return as is
    if (sourceLanguage === targetLanguage) {
      console.log('Source and target language are the same, returning original text');
      return text;
    }

    // Trim whitespace
    const trimmedText = text.trim();
    if (!trimmedText) {
      return text;
    }

    // Use MyMemory as primary provider (or if explicitly selected)
    if (TRANSLATION_PROVIDER === 'mymemory' || !TRANSLATION_API_KEY || TRANSLATION_API_KEY === 'your_translation_api_key_here') {
      try {
        console.log('Using MyMemory API for translation');
        const result = await myMemoryService.translateText(trimmedText, targetLanguage, sourceLanguage || 'auto');
        const latency = Date.now() - startTime;

        console.log(`Translation via MyMemory completed in ${latency}ms`);

        if (latency > 2000) {
          console.warn(`Translation latency exceeded 2 seconds: ${latency}ms`);
        }

        return result.translatedText;
      } catch (mymemoryError) {
        console.warn('MyMemory translation failed:', mymemoryError.message);

        // If RapidAPI key is available, try falling back
        if (TRANSLATION_API_KEY && TRANSLATION_API_KEY !== 'your_translation_api_key_here') {
          console.log('Falling back to RapidAPI endpoints...');
        } else {
          // No fallback available, use mock
          console.warn('No fallback API available, using mock translation');
          return mockTranslate(trimmedText, targetLanguage);
        }
      }
    }

    // Use RapidAPI endpoints (fallback or if selected)
    if (TRANSLATION_API_KEY && TRANSLATION_API_KEY !== 'your_translation_api_key_here') {
      // Try each API until one works
      const apisToTry = workingApiIndex === 0
        ? TRANSLATION_APIS
        : [TRANSLATION_APIS[workingApiIndex], ...TRANSLATION_APIS.filter((_, i) => i !== workingApiIndex)];

      for (let i = 0; i < apisToTry.length; i++) {
        const api = apisToTry[i];
        const apiIndex = TRANSLATION_APIS.indexOf(api);

        try {
          const translatedText = await translateWithAPI(trimmedText, targetLanguage, sourceLanguage, api);
          const latency = Date.now() - startTime;

          // Update working API index
          workingApiIndex = apiIndex;

          // Log latency for monitoring
          console.log(`Translation via ${api.name} completed in ${latency}ms`);

          if (latency > 2000) {
            console.warn(`Translation latency exceeded 2 seconds: ${latency}ms`);
          }

          return translatedText;
        } catch (apiError) {
          console.warn(`${api.name} failed: ${apiError.message}`);
          // Continue to next API
          continue;
        }
      }
    }

    // All APIs failed, use mock
    console.warn('All translation APIs failed, using mock translation');
    return mockTranslate(trimmedText, targetLanguage);

  } catch (error) {
    console.error('Translation service error:', error);
    // Return original text if translation fails completely
    return text;
  }
}

/**
 * Translate using a specific RapidAPI endpoint
 * @param {string} text - Text to translate
 * @param {string} targetLanguage - Target language code
 * @param {string} sourceLanguage - Source language code (optional)
 * @param {object} apiConfig - API configuration object
 * @returns {Promise<string>} Translated text
 */
async function translateWithAPI(text, targetLanguage, sourceLanguage, apiConfig) {
  const config = apiConfig.format(TRANSLATION_API_KEY, text, targetLanguage, sourceLanguage);

  const response = await axios({
    ...config,
    timeout: 5000 // 5 second timeout
  });

  const translatedText = apiConfig.extractFn(response.data);

  if (!translatedText) {
    throw new Error('Empty translation result');
  }

  return translatedText;
}

/**
 * Mock translation for fallback
 * @param {string} text - Text to translate
 * @param {string} targetLanguage - Target language code
 * @returns {string} Mock translated text
 */
function mockTranslate(text, targetLanguage) {
  const languageName = SUPPORTED_LANGUAGES[targetLanguage] || targetLanguage;
  console.warn(`Using mock translation to ${languageName}`);
  return `[${languageName}] ${text}`;
}

/**
 * Get list of supported languages
 * @returns {Array} List of supported languages
 */
function getSupportedLanguages() {
  return Object.entries(SUPPORTED_LANGUAGES).map(([code, name]) => ({
    code,
    name
  }));
}

/**
 * Detect language of text
 * @param {string} text - Text to analyze
 * @returns {Promise<string>} Detected language code
 */
async function detectLanguage(text) {
  try {
    if (!text || typeof text !== 'string') {
      return 'en';
    }

    // Try MyMemory first (preferred provider)
    if (TRANSLATION_PROVIDER === 'mymemory' || !TRANSLATION_API_KEY || TRANSLATION_API_KEY === 'your_translation_api_key_here') {
      try {
        const result = await myMemoryService.detectLanguage(text);
        return result.language;
      } catch (mymemoryError) {
        console.warn('MyMemory language detection failed:', mymemoryError.message);
        // Fall through to RapidAPI if available
      }
    }

    // Check if API key is configured for RapidAPI
    if (TRANSLATION_API_KEY && TRANSLATION_API_KEY !== 'your_translation_api_key_here') {
      // Try using Google Translate detection endpoint
      try {
        const encodedText = encodeURIComponent(text.substring(0, 200));
        const url = `https://google-translate1.p.rapidapi.com/language/translate/v2/detect?key=${TRANSLATION_API_KEY}&q=${encodedText}`;

        const response = await axios.post(url, null, {
          headers: {
            'content-type': 'application/x-www-form-urlencoded',
            'X-RapidAPI-Key': TRANSLATION_API_KEY,
            'X-RapidAPI-Host': 'google-translate1.p.rapidapi.com'
          },
          timeout: 3000
        });

        if (response.data && response.data.data && response.data.data.detections) {
          const detections = response.data.data.detections[0];
          if (detections && detections.length > 0) {
            return detections[0].language;
          }
        }
      } catch (detectError) {
        console.warn('Language detection API failed:', detectError.message);
      }
    }

    // Fallback to English
    return 'en';

  } catch (error) {
    console.warn('Language detection failed, defaulting to English:', error.message);
    return 'en';
  }
}

/**
 * Batch translate multiple texts
 * @param {Array<string>} texts - Array of texts to translate
 * @param {string} targetLanguage - Target language code
 * @returns {Promise<Array<string>>} Array of translated texts
 */
async function batchTranslate(texts, targetLanguage) {
  try {
    if (!Array.isArray(texts) || texts.length === 0) {
      return [];
    }

    // Process translations in parallel with concurrency limit
    const concurrencyLimit = 5;
    const results = [];

    for (let i = 0; i < texts.length; i += concurrencyLimit) {
      const batch = texts.slice(i, i + concurrencyLimit);
      const translations = await Promise.all(
        batch.map(text => translateText(text, targetLanguage))
      );
      results.push(...translations);

      // Small delay between batches
      if (i + concurrencyLimit < texts.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return results;

  } catch (error) {
    console.error('Batch translation error:', error);
    throw error;
  }
}

/**
 * Test the translation API connection
 * @returns {Promise<Object>} Test results
 */
async function testConnection() {
  const startTime = Date.now();

  try {
    const testText = 'Hello, how are you?';
    const targetLang = 'es';

    // Test based on configured provider
    if (TRANSLATION_PROVIDER === 'mymemory' || !TRANSLATION_API_KEY || TRANSLATION_API_KEY === 'your_translation_api_key_here') {
      const result = await myMemoryService.testConnection();
      return {
        ...result,
        provider: 'MyMemory'
      };
    }

    // Test RapidAPI
    if (TRANSLATION_API_KEY && TRANSLATION_API_KEY !== 'your_translation_api_key_here') {
      const translatedText = await translateText(testText, targetLang, 'en');
      const latency = Date.now() - startTime;

      return {
        success: true,
        originalText: testText,
        translatedText,
        targetLanguage: targetLang,
        latency: `${latency}ms`,
        meetsLatencyRequirement: latency < 2000,
        api: TRANSLATION_APIS[workingApiIndex]?.name || 'Unknown',
        provider: 'RapidAPI'
      };
    }

    // No API configured
    return {
      success: false,
      error: 'No translation API configured',
      latency: 0,
      provider: 'None'
    };

  } catch (error) {
    return {
      success: false,
      error: error.message,
      latency: `${Date.now() - startTime}ms`,
      provider: TRANSLATION_PROVIDER
    };
  }
}

module.exports = {
  translateText,
  getSupportedLanguages,
  detectLanguage,
  batchTranslate,
  testConnection,
  SUPPORTED_LANGUAGES,
  TRANSLATION_APIS,
  myMemoryService // Export MyMemory service for direct access if needed
};
