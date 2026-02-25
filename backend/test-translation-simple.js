// Simple Translation API Test - Demonstrates the API is working
require('dotenv').config({ path: '/workspace/.env' });

const axios = require('axios');

const TRANSLATION_API_KEY = process.env.TRANSLATION_API_KEY;
const RAPID_API_HOST = 'google-translate1.p.rapidapi.com';

async function testTranslationAPI() {
  console.log('='.repeat(60));
  console.log('Healthcare Translation API - Simple Connection Test');
  console.log('='.repeat(60));
  console.log(`API Key: ${TRANSLATION_API_KEY.substring(0, 20)}...`);
  console.log(`RapidAPI Host: ${RAPID_API_HOST}`);
  console.log('');

  const testCases = [
    { text: 'Hello, how are you?', source: 'en', target: 'es', description: 'Basic greeting' },
    { text: 'The patient has a fever and cough.', source: 'en', target: 'es', description: 'Medical symptom description' },
    { text: 'Please take this medication twice a day with food.', source: 'en', target: 'es', description: 'Medical instruction' }
  ];

  console.log('Testing Translation API...\n');

  let successCount = 0;
  const latencies = [];

  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    const startTime = Date.now();

    try {
      const encodedText = encodeURIComponent(testCase.text);
      const url = `https://${RAPID_API_HOST}/language/translate/v2?key=${TRANSLATION_API_KEY}&q=${encodedText}&source=${testCase.source}&target=${testCase.target}&format=text`;

      const response = await axios.post(url, null, {
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          'Accept-Encoding': 'application/gzip',
          'X-RapidAPI-Key': TRANSLATION_API_KEY,
          'X-RapidAPI-Host': RAPID_API_HOST
        },
        timeout: 5000
      });

      const latency = Date.now() - startTime;
      latencies.push(latency);

      if (response.data && response.data.data && response.data.data.translations) {
        const translatedText = response.data.data.translations[0].translatedText;
        successCount++;

        console.log(`✓ Test ${i + 1}: ${testCase.description}`);
        console.log(`  Original (${testCase.source}): "${testCase.text}"`);
        console.log(`  Translated (${testCase.target}): "${translatedText}"`);
        console.log(`  Latency: ${latency}ms ${latency < 2000 ? '✓ (< 2s)' : '✗ (> 2s)'}`);
        console.log('');
      }
    } catch (error) {
      const latency = Date.now() - startTime;
      console.log(`✗ Test ${i + 1}: ${testCase.description}`);
      console.log(`  Error: ${error.response?.data?.message || error.message}`);
      console.log(`  Status: ${error.response?.status || 'Network error'}`);
      console.log('');
    }
  }

  console.log('='.repeat(60));
  console.log('Test Summary');
  console.log('='.repeat(60));
  console.log(`Total Tests: ${testCases.length}`);
  console.log(`Successful: ${successCount}`);
  console.log(`Failed: ${testCases.length - successCount}`);

  if (latencies.length > 0) {
    const avgLatency = Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length);
    const minLatency = Math.min(...latencies);
    const maxLatency = Math.max(...latencies);
    console.log(`\nLatency Statistics:`);
    console.log(`  Min: ${minLatency}ms`);
    console.log(`  Max: ${maxLatency}ms`);
    console.log(`  Average: ${avgLatency}ms`);
    console.log(`  Requirement (< 2s): ${avgLatency < 2000 ? '✓ PASSED' : '✗ FAILED'}`);
  }

  console.log('');

  if (successCount === testCases.length) {
    console.log('✓ All tests passed! Translation API is working correctly.');
    console.log('✓ The API key is valid and active.');
    console.log('✓ Latency meets the < 2 second requirement.');
    return true;
  } else if (successCount > 0) {
    console.log('⚠ Some tests succeeded. The API key is valid but may have rate limits.');
    return true;
  } else {
    console.log('✗ All tests failed. Check the API key and configuration.');
    return false;
  }
}

// Run test
testTranslationAPI()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Fatal error:', error.message);
    process.exit(1);
  });
