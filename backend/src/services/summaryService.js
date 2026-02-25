// Medical Summary Service
// This service uses FREE AI APIs to generate medical summaries from conversation transcripts
// Primary: Hugging Face Inference API (FREE tier available)
// Models: facebook/bart-large-cnn, google/flan-t5-large, or medical-specific models
// Fallback: Rule-based extraction with medical disclaimer

const axios = require('axios');

// ⚠️ MEDICAL DISCLAIMER
const MEDICAL_DISCLAIMER = '⚠️ MEDICAL DISCLAIMER: This AI-generated summary is for assistance only and should NOT replace professional medical judgment. Always verify with a qualified healthcare provider.';

// Hugging Face Inference API configuration
const HUGGINGFACE_API_URL = process.env.HUGGINGFACE_API_URL || 'https://api-inference.huggingface.co/models';
const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY || ''; // Get free token at hf.co
const USE_HUGGINGFACE = process.env.USE_HUGGINGFACE !== 'false';

// Model selection - choose from free models
const SUMMARY_MODELS = {
  // General summarization models (FREE)
  bart: 'facebook/bart-large-cnn',          // Good for general summarization
  t5: 'google/flan-t5-large',                // Good instruction-following
  led: 'allenai/led-base-16384',             // Long documents
  pegasus: 'google/pegasus-xsum',           // Abstractive summarization

  // Medical-specific models (MAY REQUIRE PRO - Check availability)
  clinical: 'medicalai/ClinicalBERT',        // Clinical notes
  bio: 'microsoft/BiomedNLP-PubMedBERT'      // Biomedical text
};

const DEFAULT_MODEL = SUMMARY_MODELS.bart; // BART works well for free tier

/**
 * Generate medical summary from conversation messages using Hugging Face (FREE API)
 * @param {Array} messages - Array of message objects
 * @param {string} doctorLanguage - Doctor's language code
 * @param {string} patientLanguage - Patient's language code
 * @returns {Promise<Object>} Summary object with structured medical information
 */
async function generateMedicalSummary(messages, doctorLanguage, patientLanguage) {
  try {
    // Combine all message texts
    const conversationText = messages
      .map(msg => `${msg.sender_role}: ${msg.original_text}`)
      .join('\n');

    if (!conversationText || conversationText.length < 50) {
      throw new Error('Conversation too short for meaningful summary');
    }

    // Use Hugging Face if enabled and API key is provided
    if (USE_HUGGINGFACE && HUGGINGFACE_API_KEY) {
      try {
        const summary = await generateWithHuggingFace(conversationText, doctorLanguage, patientLanguage);
        return summary;
      } catch (hfError) {
        console.warn('Hugging Face API failed, falling back to rule-based extraction:', hfError.message);
        return generateRuleBasedSummary(conversationText, doctorLanguage, patientLanguage);
      }
    }

    // Fallback to rule-based extraction
    return generateRuleBasedSummary(conversationText, doctorLanguage, patientLanguage);

  } catch (error) {
    console.error('Summary generation error:', error);
    return {
      content: 'Summary generation failed. Please try again.',
      symptoms: 'Unable to extract',
      diagnosis: 'Unable to determine',
      medications: 'Not specified',
      followUpActions: 'Not specified',
      disclaimer: MEDICAL_DISCLAIMER
    };
  }
}

/**
 * Generate summary using Hugging Face Inference API (FREE)
 * @param {string} conversationText - Full conversation transcript
 * @param {string} doctorLanguage - Doctor's language code
 * @param {string} patientLanguage - Patient's language code
 * @returns {Promise<Object>} Structured medical summary
 */
async function generateWithHuggingFace(conversationText, doctorLanguage, patientLanguage) {
  try {
    // Create prompt for medical summary
    const prompt = createMedicalSummaryPrompt(conversationText, doctorLanguage, patientLanguage);

    // Call Hugging Face Inference API
    const model = DEFAULT_MODEL;
    const apiUrl = `${HUGGINGFACE_API_URL}/${model}`;

    const requestData = {
      inputs: prompt,
      parameters: {
        max_length: 500,
        min_length: 100,
        temperature: 0.7,
        do_sample: true
      },
      options: {
        wait_for_model: true
      }
    };

    const config = {
      headers: {
        'Authorization': `Bearer ${HUGGINGFACE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000 // 30 second timeout
    };

    const response = await axios.post(apiUrl, requestData, config);

    if (response.data && response.data.length > 0) {
      const generatedText = response.data[0].generated_text;

      // Parse the generated text into structured summary
      return parseHuggingFaceResponse(generatedText, conversationText, doctorLanguage, patientLanguage);
    }

    throw new Error('Invalid response from Hugging Face');

  } catch (error) {
    if (error.response) {
      console.error('Hugging Face API error:', error.response.status, error.response.data);

      // Check if model is loading
      if (error.response.status === 503 && error.response.data.error && error.response.data.error.includes('loading')) {
        throw new Error('Model is loading, please try again in a few moments');
      }

      // Check rate limit
      if (error.response.status === 429) {
        throw new Error('Rate limit exceeded, please wait before trying again');
      }

      throw new Error(`Hugging Face API error: ${error.response.status}`);
    } else if (error.request) {
      throw new Error('Hugging Face service unavailable');
    } else {
      throw error;
    }
  }
}

/**
 * Create prompt for medical summary generation
 * @param {string} conversationText - Conversation transcript
 * @param {string} doctorLanguage - Doctor's language
 * @param {string} patientLanguage - Patient's language
 * @returns {string} Formatted prompt
 */
function createMedicalSummaryPrompt(conversationText, doctorLanguage, patientLanguage) {
  return `Analyze the following doctor-patient conversation and generate a structured medical summary.

Conversation:
${conversationText}

Please provide a summary in the following format:
Symptoms: [list symptoms reported]
Diagnosis: [diagnosis or assessment]
Medications: [medications prescribed or recommended]
Follow-up: [follow-up actions or instructions]
Summary: [brief 2-3 sentence overall summary]

Remember this is for healthcare assistance.

Generate summary now:`;
}

/**
 * Parse Hugging Face response into structured summary
 * @param {string} generatedText - Generated text from model
 * @param {string} conversationText - Original conversation
 * @param {string} doctorLanguage - Doctor's language
 * @param {string} patientLanguage - Patient's language
 * @returns {Object} Structured summary
 */
function parseHuggingFaceResponse(generatedText, conversationText, doctorLanguage, patientLanguage) {
  try {
    // Try to parse structured response
    const sections = {
      symptoms: extractSection(generatedText, ['Symptoms:', 'symptoms:', 'Symptom', 'symptom']),
      diagnosis: extractSection(generatedText, ['Diagnosis:', 'diagnosis:', 'Diagnosis', 'diagnosis']),
      medications: extractSection(generatedText, ['Medications:', 'medications:', 'Medication', 'medication', 'Medicines', 'medicines']),
      followUpActions: extractSection(generatedText, ['Follow-up:', 'follow-up:', 'Follow up:', 'Follow-up actions:', 'Follow up actions:', 'Followup:']),
      content: extractSection(generatedText, ['Summary:', 'summary:', 'Overall:', 'Overall summary:'])
    };

    // Clean up the extracted sections
    Object.keys(sections).forEach(key => {
      sections[key] = cleanSectionText(sections[key]);
    });

    // If AI didn't provide good sections, use rule-based fallback
    if (!sections.symptoms && !sections.diagnosis) {
      return generateRuleBasedSummary(conversationText, doctorLanguage, patientLanguage);
    }

    // Add metadata
    return {
      content: sections.content || generateContentSummary(sections),
      symptoms: sections.symptoms || extractSymptoms(conversationText),
      diagnosis: sections.diagnosis || extractDiagnosis(conversationText),
      medications: sections.medications || extractMedications(conversationText),
      followUpActions: sections.followUpActions || extractFollowUp(conversationText),
      disclaimer: MEDICAL_DISCLAIMER,
      metadata: JSON.stringify({
        aiGenerated: true,
        modelUsed: DEFAULT_MODEL,
        doctorLanguage,
        patientLanguage,
        timestamp: new Date().toISOString()
      })
    };

  } catch (error) {
    console.error('Error parsing Hugging Face response:', error);
    // Fallback to rule-based
    return generateRuleBasedSummary(conversationText, doctorLanguage, patientLanguage);
  }
}

/**
 * Extract a section from generated text
 * @param {string} text - Generated text
 * @param {Array<string>} markers - Section markers
 * @returns {string} Extracted section
 */
function extractSection(text, markers) {
  for (const marker of markers) {
    const index = text.indexOf(marker);
    if (index !== -1) {
      let section = text.substring(index + marker.length).trim();

      // Find the next section marker or end of text
      const nextMarkerIndex = section.search(/(Symptoms:|Diagnosis:|Medications:|Follow-up:|Summary:)/i);
      if (nextMarkerIndex !== -1) {
        section = section.substring(0, nextMarkerIndex).trim();
      }

      return section;
    }
  }
  return '';
}

/**
 * Clean section text
 * @param {string} text - Section text
 * @returns {string} Cleaned text
 */
function cleanSectionText(text) {
  if (!text) return '';

  return text
    .replace(/^\n+/, '') // Remove leading newlines
    .replace(/\n+$/, '') // Remove trailing newlines
    .replace(/\n{3,}/g, '\n\n') // Limit consecutive newlines
    .trim();
}

/**
 * Generate content summary from sections
 * @param {Object} sections - Extracted sections
 * @returns {string} Content summary
 */
function generateContentSummary(sections) {
  const parts = [];

  if (sections.symptoms) {
    parts.push(`Patient reported: ${sections.symptoms}`);
  }

  if (sections.diagnosis) {
    parts.push(`Assessment: ${sections.diagnosis}`);
  }

  if (sections.medications) {
    parts.push(`Treatment: ${sections.medications}`);
  }

  if (sections.followUpActions) {
    parts.push(`Next steps: ${sections.followUpActions}`);
  }

  return parts.join('. ') + '.';
}

/**
 * Rule-based summary generation (fallback)
 * @param {string} conversationText - Conversation transcript
 * @param {string} doctorLanguage - Doctor's language
 * @param {string} patientLanguage - Patient's language
 * @returns {Object} Structured summary
 */
function generateRuleBasedSummary(conversationText, doctorLanguage, patientLanguage) {
  const messageCount = conversationText.split('\n').length;

  return {
    content: `Medical consultation between doctor and patient. Communication language: ${patientLanguage.toUpperCase()} → ${doctorLanguage.toUpperCase()}. Total exchanges: ${messageCount}. Please review conversation details for specific information.`,
    symptoms: extractSymptoms(conversationText),
    diagnosis: extractDiagnosis(conversationText),
    medications: extractMedications(conversationText),
    followUpActions: extractFollowUp(conversationText),
    disclaimer: MEDICAL_DISCLAIMER,
    metadata: JSON.stringify({
      aiGenerated: false,
      method: 'rule-based',
      doctorLanguage,
      patientLanguage,
      timestamp: new Date().toISOString()
    })
  };
}

/**
 * Extract symptoms from conversation text (rule-based)
 */
function extractSymptoms(text) {
  const symptomKeywords = {
    'pain': 'Pain reported',
    'headache': 'Headache',
    'fever': 'Fever/temperature',
    'cough': 'Coughing',
    'fatigue': 'Fatigue/tiredness',
    'nausea': 'Nausea',
    'dizziness': 'Dizziness',
    'shortness of breath': 'Breathing difficulty',
    'chest pain': 'Chest discomfort',
    'stomach': 'Stomach issues',
    'sore throat': 'Sore throat',
    'congestion': 'Nasal congestion',
    'vomiting': 'Vomiting'
  };

  const foundSymptoms = [];
  const lowerText = text.toLowerCase();

  for (const [keyword, description] of Object.entries(symptomKeywords)) {
    if (lowerText.includes(keyword)) {
      foundSymptoms.push(description);
    }
  }

  return foundSymptoms.length > 0 ? foundSymptoms.join(', ') : 'Symptoms not explicitly detailed';
}

/**
 * Extract diagnosis from conversation text (rule-based)
 */
function extractDiagnosis(text) {
  const diagnosisKeywords = {
    'flu': 'Influenza',
    'cold': 'Common cold',
    'infection': 'Infection',
    'virus': 'Viral infection',
    'bacteria': 'Bacterial infection',
    'injury': 'Injury/Trauma',
    'chronic': 'Chronic condition',
    'routine': 'Routine checkup',
    'followup': 'Follow-up consultation'
  };

  const lowerText = text.toLowerCase();

  for (const [keyword, diagnosis] of Object.entries(diagnosisKeywords)) {
    if (lowerText.includes(keyword)) {
      return diagnosis;
    }
  }

  return 'Assessment pending - Review clinical notes';
}

/**
 * Extract medications from conversation text (rule-based)
 */
function extractMedications(text) {
  const medicationKeywords = {
    'antibiotic': 'Antibiotic therapy',
    'painkiller': 'Pain management',
    'anti-inflammatory': 'Anti-inflammatory medication',
    'tablet': 'Oral medication prescribed',
    'syrup': 'Liquid medication',
    'injection': 'Injection administered',
    'cream': 'Topical medication',
    'prescription': 'Prescription provided'
  };

  const foundMedications = [];
  const lowerText = text.toLowerCase();

  for (const [keyword, description] of Object.entries(medicationKeywords)) {
    if (lowerText.includes(keyword)) {
      foundMedications.push(description);
    }
  }

  return foundMedications.length > 0 ? foundMedications.join(', ') : 'Medication details not specified in transcript';
}

/**
 * Extract follow-up actions from conversation text (rule-based)
 */
function extractFollowUp(text) {
  const followUpKeywords = {
    'follow up': 'Schedule follow-up appointment',
    'revisit': 'Revisit clinic if symptoms worsen',
    'rest': 'Rest and recovery recommended',
    'test': 'Additional tests/labs required',
    'specialist': 'Referral to specialist recommended',
    'emergency': 'Seek emergency care if condition worsens',
    'monitor': 'Monitor symptoms and report changes',
    'prescription': 'Follow prescription dosage instructions',
    'appointment': 'Follow-up appointment scheduled'
  };

  const foundActions = [];
  const lowerText = text.toLowerCase();

  for (const [keyword, action] of Object.entries(followUpKeywords)) {
    if (lowerText.includes(keyword)) {
      foundActions.push(action);
    }
  }

  return foundActions.length > 0 ? foundActions.join('; ') : 'Follow standard care instructions - consult healthcare provider';
}

/**
 * Calculate consultation duration
 */
function calculateDuration(messages) {
  if (messages.length === 0) return '0 minutes';

  const firstMessage = new Date(messages[0].created_at);
  const lastMessage = new Date(messages[messages.length - 1].created_at);
  const diffMinutes = Math.round((lastMessage - firstMessage) / 60000);

  return diffMinutes > 0
    ? `~${diffMinutes} minutes`
    : 'Just started';
}

module.exports = {
  generateMedicalSummary,
  extractSymptoms,
  extractDiagnosis,
  extractMedications,
  extractFollowUp
};
