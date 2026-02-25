/**
 * Audio Transcription Service
 * Provides speech-to-text transcription capabilities
 * Supports: OpenAI Whisper, Google Speech-to-Text, AWS Transcribe, Azure Speech
 */

const fs = require('fs').promises;
const path = require('path');

class TranscriptionService {
  constructor() {
    this.provider = process.env.TRANSCRIPTION_PROVIDER || 'openai';
    this.apiKey = process.env.TRANSCRIPTION_API_KEY;
    this.model = process.env.TRANSCRIPTION_MODEL || 'whisper-1';
    this.region = process.env.AWS_REGION || 'us-east-1';
  }

  /**
   * Transcribe audio file
   * @param {string} audioFilePath - Path to audio file
   * @param {object} options - Additional options
   * @returns {Promise<object>} Transcription result with text, confidence, language
   */
  async transcribeAudio(audioFilePath, options = {}) {
    const {
      language = null,
      detectLanguage = true,
      timestamps = false,
      speakerDiarization = false
    } = options;

    try {
      // Check if file exists
      await fs.access(audioFilePath);

      let result;
      switch (this.provider) {
        case 'openai':
          result = await this.transcribeWithOpenAI(audioFilePath, { language, timestamps });
          break;
        case 'google':
          result = await this.transcribeWithGoogle(audioFilePath, { language, timestamps, speakerDiarization });
          break;
        case 'aws':
          result = await this.transcribeWithAWS(audioFilePath, { language });
          break;
        case 'azure':
          result = await this.transcribeWithAzure(audioFilePath, { language });
          break;
        default:
          throw new Error(`Unsupported transcription provider: ${this.provider}`);
      }

      return {
        text: result.text,
        confidence: result.confidence || 0.95,
        language: result.language || language || 'en',
        duration: result.duration || null,
        timestamps: result.timestamps || null,
        speakers: result.speakers || null
      };

    } catch (error) {
      console.error('Audio transcription error:', error);
      throw new Error(`Transcription failed: ${error.message}`);
    }
  }

  /**
   * Transcribe using OpenAI Whisper API
   */
  async transcribeWithOpenAI(audioFilePath, options) {
    const axios = require('axios');
    const FormData = require('form-data');

    const formData = new FormData();
    formData.append('file', await fs.readFile(audioFilePath), {
      filename: path.basename(audioFilePath),
      contentType: 'audio/mpeg'
    });
    formData.append('model', this.model);

    if (options.language) {
      formData.append('language', options.language);
    }

    if (options.timestamps) {
      formData.append('timestamp_granularities[]', 'word');
    }

    const response = await axios.post(
      'https://api.openai.com/v1/audio/transcriptions',
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          'Authorization': `Bearer ${this.apiKey}`
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity
      }
    );

    const result = {
      text: response.data.text,
      confidence: 0.95,
      language: response.data.language || options.language || 'en'
    };

    if (response.data.words) {
      result.timestamps = response.data.words;
    }

    return result;
  }

  /**
   * Transcribe using Google Cloud Speech-to-Text
   */
  async transcribeWithGoogle(audioFilePath, options) {
    // Note: This requires google-cloud/speech package
    // For production use, install: @google-cloud/speech

    try {
      const speech = require('@google-cloud/speech');
      const client = new speech.SpeechClient({
        keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
      });

      const audioBytes = await fs.readFile(audioFilePath);
      const audio = {
        content: audioBytes.toString('base64')
      };

      const config = {
        encoding: 'MP3',
        sampleRateHertz: 16000,
        languageCode: options.language || 'en-US',
        enableWordTimeOffsets: options.timestamps || false,
        enableAutomaticPunctuation: true
      };

      if (options.speakerDiarization) {
        config.enableSpeakerDiarization = true;
        config.diarizationSpeakerCount = 2;
      }

      const [response] = await client.recognize({ audio, config });

      const transcription = response.results
        .map(result => result.alternatives[0].transcript)
        .join(' ');

      let speakers = null;
      if (response.results[0]?.alternatives[0]?.words) {
        // Extract speaker information if diarization enabled
        speakers = this.extractSpeakers(response.results[0].alternatives[0].words);
      }

      return {
        text: transcription,
        confidence: response.results[0]?.alternatives[0]?.confidence || 0.9,
        language: options.language || 'en',
        speakers
      };

    } catch (error) {
      console.error('Google transcription error:', error);
      throw error;
    }
  }

  /**
   * Transcribe using AWS Transcribe
   */
  async transcribeWithAWS(audioFilePath, options) {
    // Note: AWS Transcribe is async and requires S3 upload
    // This is a simplified implementation

    try {
      const AWS = require('aws-sdk');
      const { TranscribeService, S3 } = AWS;

      // Upload to S3 first
      const s3 = new S3({
        region: this.region,
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
      });

      const bucketName = process.env.AWS_S3_BUCKET;
      const key = `transcriptions/${Date.now()}-${path.basename(audioFilePath)}`;

      await s3.putObject({
        Bucket: bucketName,
        Key: key,
        Body: await fs.readFile(audioFilePath)
      }).promise();

      // Start transcription job
      const transcribe = new TranscribeService({
        region: this.region,
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
      });

      const jobName = `transcribe-${Date.now()}`;

      await transcribe.startTranscriptionJob({
        TranscriptionJobName: jobName,
        Media: {
          MediaFileUri: `s3://${bucketName}/${key}`
        },
        MediaFormat: 'mp3',
        LanguageCode: options.language || 'en-US'
      }).promise();

      // Poll for completion
      let job;
      while (true) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        job = await transcribe.getTranscriptionJob({
          TranscriptionJobName: jobName
        }).promise();

        if (job.TranscriptionJob.TranscriptionJobStatus === 'COMPLETED') {
          break;
        }
        if (job.TranscriptionJob.TranscriptionJobStatus === 'FAILED') {
          throw new Error('AWS Transcribe job failed');
        }
      }

      // Get results
      const transcript = await axios.get(job.TranscriptionJob.Transcript.TranscriptFileUri);
      const result = transcript.data.results.transcripts[0].transcript;

      return {
        text: result,
        confidence: 0.9,
        language: options.language || 'en'
      };

    } catch (error) {
      console.error('AWS transcription error:', error);
      throw error;
    }
  }

  /**
   * Transcribe using Azure Speech Service
   */
  async transcribeWithAzure(audioFilePath, options) {
    // Note: Requires azure-cognitiveservices-speech-sdk package

    try {
      const sdk = require('microsoft-cognitiveservices-speech-sdk');

      const speechConfig = sdk.SpeechConfig.fromSubscription(
        this.apiKey,
        process.env.AZURE_REGION || 'eastus'
      );

      if (options.language) {
        speechConfig.speechRecognitionLanguage = options.language;
      }

      const audioConfig = sdk.AudioConfig.fromWavFileInput(
        await fs.readFile(audioFilePath)
      );

      const recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);

      return new Promise((resolve, reject) => {
        recognizer.recognizeOnceAsync((result) => {
          recognizer.close();

          if (result.reason === sdk.ResultReason.RecognizedSpeech) {
            resolve({
              text: result.text,
              confidence: 0.9,
              language: options.language || 'en'
            });
          } else {
            reject(new Error('Speech recognition failed'));
          }
        }, (error) => {
          recognizer.close();
          reject(error);
        });
      });

    } catch (error) {
      console.error('Azure transcription error:', error);
      throw error;
    }
  }

  /**
   * Extract speaker information from transcription words
   */
  extractSpeakers(words) {
    const speakers = {};

    words.forEach(word => {
      const speaker = word.speakerTag;
      if (!speakers[speaker]) {
        speakers[speaker] = [];
      }
      speakers[speaker].push({
        word: word.word,
        startTime: word.startTime,
        endTime: word.endTime
      });
    });

    return speakers;
  }

  /**
   * Batch transcribe multiple audio files
   */
  async batchTranscribe(audioFilePaths, options = {}) {
    const results = await Promise.allSettled(
      audioFilePaths.map(async (filePath) => {
        const result = await this.transcribeAudio(filePath, options);
        return {
          filePath,
          ...result
        };
      })
    );

    const successes = results
      .filter(r => r.status === 'fulfilled')
      .map(r => r.value);

    const failures = results
      .filter(r => r.status === 'rejected')
      .map(r => ({
        filePath: r.reason.filePath || 'unknown',
        error: r.reason.message
      }));

    return {
      successes,
      failures,
      total: audioFilePaths.length,
      successful: successes.length,
      failed: failures.length
    };
  }

  /**
   * Mock transcription for testing (when no API key available)
   */
  async mockTranscribe(audioFilePath) {
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    return {
      text: 'This is a mock transcription. In production, this would be the actual transcribed text from the audio file.',
      confidence: 0.95,
      language: 'en',
      duration: 30.5,
      timestamps: null,
      speakers: null
    };
  }

  /**
   * Test transcription service connection
   */
  async testConnection() {
    try {
      if (!this.apiKey && this.provider !== 'mock') {
        return {
          success: false,
          provider: this.provider,
          error: 'No API key configured'
        };
      }

      const testAudioPath = path.join(__dirname, '../../audio/test.mp3');

      // Create a mock test if file doesn't exist
      try {
        await fs.access(testAudioPath);
      } catch {
        return {
          success: false,
          provider: this.provider,
          error: 'No test audio file found'
        };
      }

      const result = await this.transcribeAudio(testAudioPath, { language: 'en' });

      return {
        success: true,
        provider: this.provider,
        model: this.model,
        result
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
const transcriptionService = new TranscriptionService();

module.exports = transcriptionService;
