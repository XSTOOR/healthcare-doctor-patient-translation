/**
 * MyMemory Translation Service
 *
 * This service integrates with the MyMemory Translation API
 * MyMemory is a free translation API that supports multiple languages
 *
 * API Documentation: https://mymemory.translated.net/doc/spec.php
 *
 * Features:
 * - Free tier with unlimited requests (rate limited)
 * - Supports language detection
 * - Supports batch translation
 * - No API key required for basic usage (with rate limits)
 * - Optional email for higher rate limits
 */

const axios = require('axios');

// MyMemory API Configuration
const MYMEMORY_API_BASE = 'https://api.mymemory.translated.net/get';
const MYMEMORY_API_EMAIL = process.env.MYMEMORY_API_EMAIL || null;

// Rate limiting configuration
const RATE_LIMIT = {
  requestsPerMinute: MYMEMORY_API_EMAIL ? 200 : 50, // Free tier limits
  concurrentRequests: 5
};

// Request tracking for rate limiting
let requestTimestamps = [];

/**
 * Check if we're within rate limits
 * @returns {Promise<void>} Throws if rate limit exceeded
 */
async function checkRateLimit() {
  const now = Date.now();
  const oneMinuteAgo = now - 60000;

  // Remove old timestamps
  requestTimestamps = requestTimestamps.filter(t => t > oneMinuteAgo);

  // Check if we've exceeded the limit
  if (requestTimestamps.length >= RATE_LIMIT.requestsPerMinute) {
    const waitTime = Math.ceil((requestTimestamps[0] - oneMinuteAgo) / 1000);
    throw new Error(
      `Rate limit exceeded. Please wait ${waitTime} seconds before making more requests. ` +
      `Register your email at https://mymemory.translated.net/doc/spec.php for higher limits.`
    );
  }

  // Add current request timestamp
  requestTimestamps.push(now);
}

/**
 * Translate text using MyMemory API
 * @param {string} text - Text to translate
 * @param {string} targetLanguage - Target language code (e.g., 'es', 'fr', 'de')
 * @param {string} sourceLanguage - Source language code (optional, 'auto' for detection)
 * @returns {Promise<Object>} Translation result with text, confidence, and metadata
 */
async function translateText(text, targetLanguage, sourceLanguage = 'auto') {
  const startTime = Date.now();

  try {
    // Input validation
    if (!text || typeof text !== 'string') {
      throw new Error('Invalid text input: must be a non-empty string');
    }

    if (!targetLanguage || typeof targetLanguage !== 'string') {
      throw new Error('Invalid target language: must be a non-empty string');
    }

    // Trim and validate text
    const trimmedText = text.trim();
    if (!trimmedText) {
      return {
        translatedText: '',
        originalText: text,
        sourceLanguage: sourceLanguage,
        targetLanguage: targetLanguage,
        confidence: 1.0,
        matches: 0,
        latency: Date.now() - startTime,
        provider: 'MyMemory'
      };
    }

    // If source and target are the same, return original
    if (sourceLanguage === targetLanguage) {
      return {
        translatedText: trimmedText,
        originalText: trimmedText,
        sourceLanguage: sourceLanguage,
        targetLanguage: targetLanguage,
        confidence: 1.0,
        matches: 1,
        latency: Date.now() - startTime,
        provider: 'MyMemory (no translation needed)'
      };
    }

    // Check rate limits
    await checkRateLimit();

    // Build API URL
    // Note: MyMemory doesn't support 'auto' - we need to detect first or use a default
    // For auto-detection, we'll omit the source language and let MyMemory detect it
    let langPair;
    if (sourceLanguage === 'auto' || !sourceLanguage) {
      // MyMemory auto-detects when source is not specified or uses 'autodetect'
      langPair = `autodetect|${targetLanguage}`;
    } else {
      langPair = `${sourceLanguage}|${targetLanguage}`;
    }

    let apiUrl = `${MYMEMORY_API_BASE}?q=${encodeURIComponent(trimmedText)}&langpair=${encodeURIComponent(langPair)}`;

    // Add email for higher rate limits if provided
    if (MYMEMORY_API_EMAIL) {
      apiUrl += `&de=${encodeURIComponent(MYMEMORY_API_EMAIL)}`;
    }

    // Make API request
    const response = await axios.get(apiUrl, {
      timeout: 10000, // 10 second timeout
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'HealthcareTranslationApp/1.0'
      }
    });

    // Parse response
    const responseData = response.data;

    // Check for API errors
    if (responseData.responseStatus !== 200) {
      throw new Error(
        `MyMemory API error: ${responseData.responseDetails || 'Unknown error'}`
      );
    }

    // Extract translation data
    const translationData = responseData.responseData;
    const translatedText = translationData?.translatedText;

    if (!translatedText) {
      throw new Error('Empty translation received from MyMemory API');
    }

    // Check for quality warnings
    const matches = responseData.matches || [];
    const qualityMatch = matches.find(m => m.translation === translatedText);
    const confidence = qualityMatch?.quality || (translationData?.confidence || 0);

    const latency = Date.now() - startTime;

    // Log translation details
    console.log(`MyMemory translation completed in ${latency}ms`);

    if (latency > 3000) {
      console.warn(`MyMemory translation latency exceeded 3 seconds: ${latency}ms`);
    }

    // Check if this is a machine translation fallback
    if (translatedText === trimmedText && sourceLanguage !== targetLanguage) {
      console.warn('MyMemory returned original text - possible translation failure');
    }

    return {
      translatedText,
      originalText: trimmedText,
      sourceLanguage: translationData?.detectedLanguage || sourceLanguage,
      targetLanguage,
      confidence,
      matches: matches.length,
      latency,
      provider: 'MyMemory'
    };

  } catch (error) {
    // Handle specific error types
    if (error.code === 'ECONNABORTED') {
      throw new Error('Translation request timed out. Please try again.');
    }

    if (error.response) {
      // API returned an error response
      const status = error.response.status;
      if (status === 429) {
        throw new Error(
          'Rate limit exceeded. Please wait before making more requests.'
        );
      }
      throw new Error(
        `MyMemory API error (${status}): ${error.response.data?.responseDetails || 'Unknown error'}`
      );
    }

    if (error.message.includes('Rate limit exceeded')) {
      throw error; // Re-throw rate limit errors as-is
    }

    // Generic error
    console.error('MyMemory translation error:', error.message);
    throw new Error(`Translation failed: ${error.message}`);
  }
}

/**
 * Detect language of text using MyMemory API
 * @param {string} text - Text to analyze
 * @returns {Promise<Object>} Detection result with language code and confidence
 */
async function detectLanguage(text) {
  try {
    if (!text || typeof text !== 'string') {
      throw new Error('Invalid text input for language detection');
    }

    const trimmedText = text.trim();
    if (trimmedText.length < 3) {
      return {
        language: 'en',
        confidence: 0.5,
        method: 'default'
      };
    }

    // Check rate limits
    await checkRateLimit();

    // Use translation to auto-detect (translate to English)
    const result = await translateText(trimmedText, 'en', 'auto');

    return {
      language: result.sourceLanguage || 'en',
      confidence: result.confidence,
      method: 'MyMemory'
    };

  } catch (error) {
    console.warn('Language detection failed, defaulting to English:', error.message);
    return {
      language: 'en',
      confidence: 0.5,
      method: 'fallback'
    };
  }
}

/**
 * Batch translate multiple texts
 * @param {Array<string>} texts - Array of texts to translate
 * @param {string} targetLanguage - Target language code
 * @param {string} sourceLanguage - Source language code (optional)
 * @returns {Promise<Array<Object>>} Array of translation results
 */
async function batchTranslate(texts, targetLanguage, sourceLanguage = 'auto') {
  try {
    if (!Array.isArray(texts) || texts.length === 0) {
      return [];
    }

    // Process with concurrency limit
    const results = [];
    const concurrencyLimit = RATE_LIMIT.concurrentRequests;

    for (let i = 0; i < texts.length; i += concurrencyLimit) {
      const batch = texts.slice(i, i + concurrencyLimit);

      const translations = await Promise.allSettled(
        batch.map(text => translateText(text, targetLanguage, sourceLanguage))
      );

      // Map results to include status
      translations.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push({ success: true, ...result.value });
        } else {
          results.push({
            success: false,
            error: result.reason.message,
            originalText: batch[index],
            targetLanguage,
            provider: 'MyMemory'
          });
        }
      });

      // Small delay between batches to respect rate limits
      if (i + concurrencyLimit < texts.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    return results;

  } catch (error) {
    console.error('MyMemory batch translation error:', error);
    throw error;
  }
}

/**
 * Get supported language pairs
 * @returns {Array<Object>} Array of supported language pairs
 */
function getSupportedLanguages() {
  // MyMemory supports a wide range of languages
  // Common languages supported:
  return [
    { code: 'af', name: 'Afrikaans' },
    { code: 'ar', name: 'Arabic' },
    { code: 'bn', name: 'Bengali' },
    { code: 'bg', name: 'Bulgarian' },
    { code: 'ca', name: 'Catalan' },
    { code: 'zh', name: 'Chinese (Simplified)' },
    { code: 'zh-TW', name: 'Chinese (Traditional)' },
    { code: 'hr', name: 'Croatian' },
    { code: 'cs', name: 'Czech' },
    { code: 'da', name: 'Danish' },
    { code: 'nl', name: 'Dutch' },
    { code: 'en', name: 'English' },
    { code: 'et', name: 'Estonian' },
    { code: 'fi', name: 'Finnish' },
    { code: 'fr', name: 'French' },
    { code: 'de', name: 'German' },
    { code: 'el', name: 'Greek' },
    { code: 'hi', name: 'Hindi' },
    { code: 'hu', name: 'Hungarian' },
    { code: 'id', name: 'Indonesian' },
    { code: 'it', name: 'Italian' },
    { code: 'ja', name: 'Japanese' },
    { code: 'ko', name: 'Korean' },
    { code: 'lv', name: 'Latvian' },
    { code: 'lt', name: 'Lithuanian' },
    { code: 'ms', name: 'Malay' },
    { code: 'no', name: 'Norwegian' },
    { code: 'pl', name: 'Polish' },
    { code: 'pt', name: 'Portuguese' },
    { code: 'ro', name: 'Romanian' },
    { code: 'ru', name: 'Russian' },
    { code: 'sk', name: 'Slovak' },
    { code: 'sl', name: 'Slovenian' },
    { code: 'es', name: 'Spanish' },
    { code: 'sv', name: 'Swedish' },
    { code: 'ta', name: 'Tamil' },
    { code: 'te', name: 'Telugu' },
    { code: 'th', name: 'Thai' },
    { code: 'tr', name: 'Turkish' },
    { code: 'uk', name: 'Ukrainian' },
    { code: 'ur', name: 'Urdu' },
    { code: 'vi', name: 'Vietnamese' }
  ];
}

/**
 * Test the MyMemory API connection
 * @returns {Promise<Object>} Test results
 */
async function testConnection() {
  const startTime = Date.now();

  try {
    const testText = 'Hello, how are you?';
    const targetLang = 'es';

    const result = await translateText(testText, targetLang, 'en');

    return {
      success: true,
      originalText: testText,
      translatedText: result.translatedText,
      targetLanguage: targetLang,
      latency: result.latency,
      meetsLatencyRequirement: result.latency < 3000,
      confidence: result.confidence,
      provider: 'MyMemory',
      emailRegistered: !!MYMEMORY_API_EMAIL,
      message: MYMEMORY_API_EMAIL
        ? 'Using registered email for higher rate limits'
        : 'No email registered - using default rate limits (50/minute). Register at https://mymemory.translated.net/doc/spec.php for higher limits.'
    };

  } catch (error) {
    return {
      success: false,
      error: error.message,
      latency: Date.now() - startTime,
      provider: 'MyMemory'
    };
  }
}

/**
 * Get current rate limit status
 * @returns {Object} Rate limit information
 */
function getRateLimitStatus() {
  const now = Date.now();
  const oneMinuteAgo = now - 60000;
  const recentRequests = requestTimestamps.filter(t => t > oneMinuteAgo);

  return {
    used: recentRequests.length,
    limit: RATE_LIMIT.requestsPerMinute,
    remaining: Math.max(0, RATE_LIMIT.requestsPerMinute - recentRequests.length),
    resetIn: Math.max(0, Math.ceil((requestTimestamps[0] - oneMinuteAgo) / 1000)) || 0,
    emailRegistered: !!MYMEMORY_API_EMAIL
  };
}

module.exports = {
  translateText,
  detectLanguage,
  batchTranslate,
  getSupportedLanguages,
  testConnection,
  getRateLimitStatus,
  MYMEMORY_API_BASE,
  RATE_LIMIT
};
