/**
 * Simple MyMemory Translation Service
 *
 * A minimal, clean implementation for translating text using MyMemory API.
 *
 * API: https://api.mymemory.translated.net/get
 * Docs: https://mymemory.translated.net/doc/spec.php
 *
 * Usage:
 *   const mymemory = require('./mymemory');
 *   const result = await mymemory.translate('Hello', 'es');
 *   console.log(result.translatedText); // "Hola"
 */

const axios = require('axios');

// ============================================================================
// CONFIGURATION
// ============================================================================

const API_BASE = 'https://api.mymemory.translated.net/get';

// Optional: Add your email for higher rate limits (200 req/min vs 50 req/min)
// Get your email registered at: https://mymemory.translated.net/doc/spec.php
const EMAIL = process.env.MYMEMORY_EMAIL || null;

// ============================================================================
// MAIN FUNCTIONS
// ============================================================================

/**
 * Translate text from one language to another.
 *
 * @param {string} text - The text to translate
 * @param {string} targetLang - Target language code (e.g., 'es', 'fr', 'de')
 * @param {string} sourceLang - Source language code (optional, defaults to auto-detect)
 * @returns {Promise<object>} Translation result
 *
 * @example
 *   // Translate English to Spanish
 *   const result = await translate('Hello world', 'es', 'en');
 *   // => { translatedText: 'Hola mundo', sourceLang: 'en', targetLang: 'es', ... }
 *
 * @example
 *   // Auto-detect source language
 *   const result = await translate('Hello world', 'es');
 *   // => { translatedText: 'Hola mundo', sourceLang: 'en', targetLang: 'es', ... }
 */
async function translate(text, targetLang, sourceLang = null) {
  // Validate inputs
  if (!text || typeof text !== 'string') {
    throw new Error('Text must be a non-empty string');
  }
  if (!targetLang || typeof targetLang !== 'string') {
    throw new Error('Target language must be a non-empty string');
  }

  const trimmedText = text.trim();
  if (!trimmedText) {
    return {
      translatedText: '',
      originalText: text,
      sourceLang: sourceLang || 'unknown',
      targetLang: targetLang,
      success: true
    };
  }

  // Same language? Return as-is
  if (sourceLang === targetLang) {
    return {
      translatedText: trimmedText,
      originalText: trimmedText,
      sourceLang: sourceLang,
      targetLang: targetLang,
      success: true
    };
  }

  // Build language pair
  const langPair = sourceLang
    ? `${sourceLang}|${targetLang}`
    : `autodetect|${targetLang}`;

  // Build API URL
  let url = `${API_BASE}?q=${encodeURIComponent(trimmedText)}&langpair=${encodeURIComponent(langPair)}`;

  // Add email for higher rate limits if provided
  if (EMAIL) {
    url += `&de=${encodeURIComponent(EMAIL)}`;
  }

  try {
    // Make API request
    const response = await axios.get(url, {
      timeout: 10000, // 10 second timeout
      headers: {
        'Accept': 'application/json'
      }
    });

    const data = response.data;

    // Check for API errors
    if (data.responseStatus !== 200) {
      throw new Error(
        data.responseDetails || 'Translation API error'
      );
    }

    // Extract translated text
    const translatedText = data.responseData?.translatedText;

    if (!translatedText) {
      throw new Error('No translation received');
    }

    // Return success result
    return {
      translatedText: translatedText,
      originalText: trimmedText,
      sourceLang: data.responseData?.detectedLanguage || sourceLang || 'unknown',
      targetLang: targetLang,
      confidence: data.responseData?.confidence || null,
      success: true
    };

  } catch (error) {
    // Handle different error types
    if (error.response) {
      // API returned an error
      throw new Error(
        `MyMemory API error (${error.response.status}): ${error.response.data?.responseDetails || 'Unknown error'}`
      );
    }
    if (error.code === 'ECONNABORTED') {
      throw new Error('Request timeout - please try again');
    }
    // Re-throw other errors
    throw error;
  }
}

/**
 * Get list of supported languages.
 *
 * @returns {Array} List of {code, name} objects
 */
function getLanguages() {
  return [
    { code: 'af', name: 'Afrikaans' },
    { code: 'ar', name: 'Arabic' },
    { code: 'bg', name: 'Bulgarian' },
    { code: 'bn', name: 'Bengali' },
    { code: 'ca', name: 'Catalan' },
    { code: 'cs', name: 'Czech' },
    { code: 'da', name: 'Danish' },
    { code: 'de', name: 'German' },
    { code: 'el', name: 'Greek' },
    { code: 'en', name: 'English' },
    { code: 'es', name: 'Spanish' },
    { code: 'et', name: 'Estonian' },
    { code: 'fa', name: 'Persian' },
    { code: 'fi', name: 'Finnish' },
    { code: 'fr', name: 'French' },
    { code: 'he', name: 'Hebrew' },
    { code: 'hi', name: 'Hindi' },
    { code: 'hr', name: 'Croatian' },
    { code: 'hu', name: 'Hungarian' },
    { code: 'id', name: 'Indonesian' },
    { code: 'it', name: 'Italian' },
    { code: 'ja', name: 'Japanese' },
    { code: 'ko', name: 'Korean' },
    { code: 'lt', name: 'Lithuanian' },
    { code: 'lv', name: 'Latvian' },
    { code: 'ms', name: 'Malay' },
    { code: 'nl', name: 'Dutch' },
    { code: 'no', name: 'Norwegian' },
    { code: 'pl', name: 'Polish' },
    { code: 'pt', name: 'Portuguese' },
    { code: 'ro', name: 'Romanian' },
    { code: 'ru', name: 'Russian' },
    { code: 'sk', name: 'Slovak' },
    { code: 'sl', name: 'Slovenian' },
    { code: 'sv', name: 'Swedish' },
    { code: 'ta', name: 'Tamil' },
    { code: 'te', name: 'Telugu' },
    { code: 'th', name: 'Thai' },
    { code: 'tr', name: 'Turkish' },
    { code: 'uk', name: 'Ukrainian' },
    { code: 'ur', name: 'Urdu' },
    { code: 'vi', name: 'Vietnamese' },
    { code: 'zh', name: 'Chinese (Simplified)' },
    { code: 'zh-TW', name: 'Chinese (Traditional)' }
  ];
}

/**
 * Test the API connection.
 *
 * @returns {Promise<object>} Test result
 */
async function test() {
  try {
    const result = await translate('Hello, how are you?', 'es', 'en');
    return {
      success: true,
      message: 'Connection successful',
      example: result
    };
  } catch (error) {
    return {
      success: false,
      message: error.message
    };
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  translate,
  getLanguages,
  test
};
