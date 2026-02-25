"""
Translation service for the Healthcare Translation App
Uses MyMemory Translation API (free tier)
"""
import os
import requests
from typing import Dict, Optional
from dotenv import load_dotenv

load_dotenv()

# Supported languages
SUPPORTED_LANGUAGES = [
    {"code": "en", "name": "English"},
    {"code": "es", "name": "Spanish"},
    {"code": "zh", "name": "Chinese"},
    {"code": "ar", "name": "Arabic"},
    {"code": "fr", "name": "French"},
    {"code": "de", "name": "German"},
    {"code": "pt", "name": "Portuguese"},
    {"code": "ru", "name": "Russian"},
    {"code": "hi", "name": "Hindi"},
    {"code": "vi", "name": "Vietnamese"},
    {"code": "ko", "name": "Korean"},
    {"code": "ja", "name": "Japanese"},
    {"code": "it", "name": "Italian"},
    {"code": "nl", "name": "Dutch"},
]


class TranslationService:
    """Handles translation using MyMemory API"""

    def __init__(self):
        self.api_url = "https://api.mymemory.translated.net/get"
        self.email = os.getenv('MYMEMORY_API_EMAIL', '')

    def translate(self, text: str, target_lang: str, source_lang: str = 'auto') -> Dict:
        """
        Translate text to target language

        Args:
            text: Text to translate
            target_lang: Target language code (e.g., 'es', 'en')
            source_lang: Source language code (default: 'auto' for auto-detection)

        Returns:
            Dictionary with translation result
        """
        if not text or not text.strip():
            return {
                'success': False,
                'error': 'No text provided for translation'
            }

        if len(text) > 2000:
            return {
                'success': False,
                'error': 'Text exceeds maximum length of 2000 characters'
            }

        # Build API request
        params = {
            'q': text,
            'langpair': f'{source_lang}|{target_lang}'
        }

        if self.email:
            params['email'] = self.email

        try:
            response = requests.get(
                self.api_url,
                params=params,
                timeout=5
            )
            response.raise_for_status()
            data = response.json()

            if data.get('responseStatus') == 200:
                return {
                    'success': True,
                    'original_text': text,
                    'translated_text': data['responseData']['translatedText'],
                    'source_language': source_lang if source_lang != 'auto' else 'auto-detected',
                    'target_language': target_lang,
                    'matches': data.get('matches', [])
                }
            else:
                return {
                    'success': False,
                    'error': data.get('responseDetails', 'Translation failed')
                }

        except requests.exceptions.Timeout:
            return {
                'success': False,
                'error': 'Translation service timeout. Please try again.'
            }
        except requests.exceptions.RequestException as e:
            return {
                'success': False,
                'error': f'Translation service error: {str(e)}'
            }

    def detect_language(self, text: str) -> Optional[str]:
        """
        Detect language of text (simplified - returns 'en' for English-like text)

        For a production app, integrate a proper language detection service
        """
        # Simple heuristic based on character patterns
        # This is a simplified version - use a proper service in production
        return 'en'  # Default to English for demo

    def get_supported_languages(self) -> list:
        """Get list of supported languages"""
        return SUPPORTED_LANGUAGES

    def test_connection(self) -> Dict:
        """Test translation service connection"""
        result = self.translate("Hello", "es")
        return {
            'success': result['success'],
            'api': 'MyMemory',
            'latency': 0
        }


# Global translation service instance
translation_service = TranslationService()


def translate_text(text: str, target_lang: str, source_lang: str = 'en') -> str:
    """
    Convenience function to translate text

    Args:
        text: Text to translate
        target_lang: Target language code
        source_lang: Source language code

    Returns:
        Translated text or original if translation fails
    """
    result = translation_service.translate(text, target_lang, source_lang)
    if result['success']:
        return result['translated_text']
    else:
        print(f"Translation error: {result.get('error')}")
        return text  # Return original text on failure


def get_language_name(code: str) -> str:
    """Get language name from code"""
    for lang in SUPPORTED_LANGUAGES:
        if lang['code'] == code:
            return lang['name']
    return code.capitalize()


def get_language_options() -> Dict:
    """Get language options as a dictionary for Streamlit selectbox"""
    return {lang['name']: lang['code'] for lang in SUPPORTED_LANGUAGES}
