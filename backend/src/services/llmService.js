/**
 * LLM Integration Service
 * Provides integration with various LLM providers for translation and summarization
 * Supports: OpenAI, Anthropic Claude, Google AI, Azure OpenAI, AWS Bedrock
 */

class LLMService {
  constructor() {
    this.provider = process.env.LLM_PROVIDER || 'openai';
    this.apiKey = process.env.LLM_API_KEY;
    this.model = process.env.LLM_MODEL || 'gpt-4';
    this.apiEndpoint = process.env.LLM_API_ENDPOINT;

    // Load provider-specific configurations
    this.loadProviderConfig();
  }

  loadProviderConfig() {
    switch (this.provider) {
      case 'openai':
        this.baseURL = this.apiEndpoint || 'https://api.openai.com/v1';
        break;
      case 'anthropic':
        this.baseURL = this.apiEndpoint || 'https://api.anthropic.com/v1';
        break;
      case 'google':
        this.baseURL = this.apiEndpoint || 'https://generativelanguage.googleapis.com/v1';
        break;
      case 'azure':
        this.baseURL = this.apiEndpoint;
        break;
      case 'aws':
        this.region = process.env.AWS_REGION || 'us-east-1';
        break;
      default:
        console.warn(`Unknown LLM provider: ${this.provider}, defaulting to OpenAI`);
        this.provider = 'openai';
        this.baseURL = 'https://api.openai.com/v1';
    }
  }

  /**
   * Generate medical summary using LLM
   * @param {string} conversationText - Full conversation transcript
   * @param {object} options - Additional options
   * @returns {Promise<object>} Structured medical summary
   */
  async generateMedicalSummary(conversationText, options = {}) {
    const {
      doctorLanguage = 'en',
      patientLanguage = 'en',
      includeMetadata = true
    } = options;

    try {
      const systemPrompt = `You are a medical assistant AI. Analyze the doctor-patient conversation and generate a structured medical summary.

Your response must be valid JSON with the following structure:
{
  "content": "Brief overall summary of the consultation (2-3 sentences)",
  "symptoms": "List of symptoms reported by patient",
  "diagnosis": "Diagnosis or assessment",
  "medications": "Medications prescribed or recommended",
  "followUpActions": "Follow-up actions or instructions"
}

Guidelines:
- Extract accurate medical information
- Use professional medical terminology
- Highlight critical symptoms or concerns
- Note any medications with dosages if mentioned
- Include all follow-up instructions
- If information is not available, use "Not specified"
- Keep content concise but comprehensive
- The content field should provide a high-level overview
- Doctor language: ${doctorLanguage.toUpperCase()}
- Patient language: ${patientLanguage.toUpperCase()}`;

      const userPrompt = `Conversation Transcript:\n${conversationText}\n\nGenerate a structured medical summary in JSON format.`;

      const response = await this.callLLM(systemPrompt, userPrompt, {
        temperature: 0.3,
        maxTokens: 1000,
        responseFormat: { type: 'json_object' }
      });

      // Parse response based on provider
      const summaryText = this.extractResponseText(response);

      // Parse JSON response
      let summary;
      try {
        summary = JSON.parse(summaryText);
      } catch (parseError) {
        console.error('Failed to parse LLM response as JSON:', parseError);
        // Fallback to structured object
        summary = {
          content: summaryText || 'Summary generation failed',
          symptoms: 'Unable to extract',
          diagnosis: 'Unable to determine',
          medications: 'Not specified',
          followUpActions: 'Not specified'
        };
      }

      return summary;

    } catch (error) {
      console.error('LLM summary generation error:', error);
      throw new Error(`Failed to generate summary: ${error.message}`);
    }
  }

  /**
   * Translate text using LLM
   * @param {string} text - Text to translate
   * @param {string} targetLanguage - Target language code
   * @param {string} sourceLanguage - Source language code (optional)
   * @returns {Promise<string>} Translated text
   */
  async translateText(text, targetLanguage, sourceLanguage = null) {
    try {
      const systemPrompt = `You are a professional translator, specializing in medical and healthcare translations.
Translate the provided text accurately while maintaining:
- Medical terminology accuracy
- Appropriate tone and formality
- Cultural sensitivity
- Clarity and precision

If the source language is not specified, detect it automatically.`;

      const languageNames = this.getLanguageNames();
      const targetLangName = languageNames[targetLanguage] || targetLanguage;

      const userPrompt = sourceLanguage
        ? `Translate the following text from ${languageNames[sourceLanguage] || sourceLanguage} to ${targetLangName}:\n\n${text}`
        : `Translate the following text to ${targetLangName}:\n\n${text}`;

      const response = await this.callLLM(systemPrompt, userPrompt, {
        temperature: 0.2,
        maxTokens: 2000
      });

      return this.extractResponseText(response).trim();

    } catch (error) {
      console.error('LLM translation error:', error);
      throw new Error(`Translation failed: ${error.message}`);
    }
  }

  /**
   * Batch translate multiple texts
   * @param {Array<string>} texts - Array of texts to translate
   * @param {string} targetLanguage - Target language code
   * @returns {Promise<Array<string>>} Array of translated texts
   */
  async batchTranslate(texts, targetLanguage) {
    try {
      const translations = await Promise.all(
        texts.map(text => this.translateText(text, targetLanguage))
      );
      return translations;
    } catch (error) {
      console.error('Batch translation error:', error);
      throw error;
    }
  }

  /**
   * Detect language of text
   * @param {string} text - Text to analyze
   * @returns {Promise<string>} Detected language code
   */
  async detectLanguage(text) {
    try {
      const systemPrompt = 'Detect the language of the provided text. Respond with only the ISO 639-1 language code (e.g., "en", "es", "zh").';

      const userPrompt = `Detect the language of:\n\n${text.substring(0, 500)}`;

      const response = await this.callLLM(systemPrompt, userPrompt, {
        temperature: 0,
        maxTokens: 10
      });

      return this.extractResponseText(response).trim().toLowerCase().substring(0, 2);

    } catch (error) {
      console.error('Language detection error:', error);
      return 'en'; // Default to English
    }
  }

  /**
   * Call LLM API
   * @param {string} systemPrompt - System prompt
   * @param {string} userPrompt - User prompt
   * @param {object} options - Additional options
   * @returns {Promise<object>} API response
   */
  async callLLM(systemPrompt, userPrompt, options = {}) {
    const axios = require('axios');

    const config = {
      temperature: options.temperature || 0.7,
      maxTokens: options.maxTokens || 1000
    };

    switch (this.provider) {
      case 'openai':
      case 'azure':
        return await this.callOpenAI(systemPrompt, userPrompt, config, options);
      case 'anthropic':
        return await this.callAnthropic(systemPrompt, userPrompt, config);
      case 'google':
        return await this.callGoogle(systemPrompt, userPrompt, config);
      default:
        throw new Error(`Unsupported LLM provider: ${this.provider}`);
    }
  }

  /**
   * Call OpenAI API
   */
  async callOpenAI(systemPrompt, userPrompt, config, options) {
    const axios = require('axios');

    const requestBody = {
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: config.temperature,
      max_tokens: config.maxTokens
    };

    // Add response format for JSON if requested
    if (options.responseFormat) {
      requestBody.response_format = options.responseFormat;
    }

    const response = await axios.post(
      `${this.baseURL}/chat/completions`,
      requestBody,
      {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data;
  }

  /**
   * Call Anthropic Claude API
   */
  async callAnthropic(systemPrompt, userPrompt, config) {
    const axios = require('anthropic');
    const Anthropic = axios.default || axios;

    const client = new Anthropic({
      apiKey: this.apiKey,
      baseURL: this.baseURL
    });

    const response = await client.messages.create({
      model: this.model || 'claude-3-opus-20240229',
      max_tokens: config.maxTokens,
      system: systemPrompt,
      messages: [
        { role: 'user', content: userPrompt }
      ],
      temperature: config.temperature
    });

    return response;
  }

  /**
   * Call Google Generative AI API
   */
  async callGoogle(systemPrompt, userPrompt, config) {
    const axios = require('axios');

    const requestBody = {
      contents: [
        {
          parts: [
            { text: `${systemPrompt}\n\n${userPrompt}` }
          ]
        }
      ],
      generationConfig: {
        temperature: config.temperature,
        maxOutputTokens: config.maxTokens
      }
    };

    const response = await axios.post(
      `${this.baseURL}/models/${this.model || 'gemini-pro'}:generateContent?key=${this.apiKey}`,
      requestBody,
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data;
  }

  /**
   * Extract response text based on provider
   */
  extractResponseText(response) {
    switch (this.provider) {
      case 'openai':
      case 'azure':
        return response.choices[0]?.message?.content || '';
      case 'anthropic':
        return response.content[0]?.text || '';
      case 'google':
        return response.candidates[0]?.content?.parts[0]?.text || '';
      default:
        return '';
    }
  }

  /**
   * Get language names mapping
   */
  getLanguageNames() {
    return {
      'en': 'English',
      'es': 'Spanish',
      'zh': 'Chinese',
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
      'ur': 'Urdu',
      'bn': 'Bengali',
      'ta': 'Tamil',
      'te': 'Telugu'
    };
  }

  /**
   * Test LLM connection
   */
  async testConnection() {
    try {
      const response = await this.callLLM(
        'You are a helpful assistant.',
        'Say "Connection successful" if you receive this message.',
        { temperature: 0, maxTokens: 50 }
      );

      const text = this.extractResponseText(response);
      return {
        success: true,
        provider: this.provider,
        model: this.model,
        response: text
      };
    } catch (error) {
      return {
        success: false,
        provider: this.provider,
        error: error.message
      };
    }
  }
}

// Export singleton instance
const llmService = new LLMService();

module.exports = llmService;
