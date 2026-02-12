import os
import requests
from typing import Optional

# Mapping project language codes to IndicTrans2 language tags
INDIC_LANG_TAGS = {
    'en': 'eng_Latn',
    'hi': 'hin_Deva',
    'bn': 'ben_Beng',
    'te': 'tel_Telu',
    'mr': 'mar_Deva',
    'ta': 'tam_Taml',
    'ur': 'urd_Arab',
    'gu': 'guj_Gujr',
    'kn': 'kan_Knda',
    'ml': 'mal_Mlym',
    'pa': 'pan_Guru'
}

class TranslatorService:
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv('HUGGINGFACE_API_KEY')
        # IndicTrans2 English to Indic
        self.en_indic_url = "https://api-inference.huggingface.co/models/ai4bharat/indictrans2-en-indic-1B"
        # IndicTrans2 Indic to English
        self.indic_en_url = "https://api-inference.huggingface.co/models/ai4bharat/indictrans2-indic-en-1B"
        
    def _query(self, url: str, text: str, src_lang: str, tgt_lang: str) -> Optional[str]:
        if not self.api_key:
            print("Warning: HUGGINGFACE_API_KEY not set. Translation will fail.")
            return None
            
        headers = {"Authorization": f"Bearer {self.api_key}"}
        # Prepend language tags as expected by IndicTrans2 processor
        # Reference: https://github.com/AI4Bharat/IndicTrans2
        payload = {
            "inputs": text,
            "parameters": {
                "src_lang": src_lang,
                "tgt_lang": tgt_lang
            }
        }
        
        try:
            response = requests.post(url, headers=headers, json=payload)
            result = response.json()
            if isinstance(result, list) and len(result) > 0:
                return result[0].get('generated_text', '')
            elif isinstance(result, dict) and 'error' in result:
                print(f"IndicTrans2 API Error: {result['error']}")
                return None
            return None
        except Exception as e:
            print(f"Translation Error: {e}")
            return None

    def translate_to_english(self, text: str, src_lang_code: str) -> str:
        """Translates Indic text to English using IndicTrans2."""
        if src_lang_code == 'en':
            return text
            
        src_tag = INDIC_LANG_TAGS.get(src_lang_code)
        if not src_tag:
            return text # Fallback
            
        translated = self._query(self.indic_en_url, text, src_tag, "eng_Latn")
        return translated if translated else text

    def translate_from_english(self, text: str, tgt_lang_code: str) -> str:
        """Translates English text to Indic language using IndicTrans2."""
        if tgt_lang_code == 'en':
            return text
            
        tgt_tag = INDIC_LANG_TAGS.get(tgt_lang_code)
        if not tgt_tag:
            return text # Fallback
            
        translated = self._query(self.en_indic_url, text, "eng_Latn", tgt_tag)
        return translated if translated else text

# Singleton instance
translator = TranslatorService()
