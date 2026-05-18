import api from '../api';

export const assistantApi = {
  /**
   * Send text message with conversation context to Gemini.
   */
  async chat(message: string, language: string, history: any[], pageContext?: string) {
    const response = await api.post('/api/assistant/chat', {
      message,
      language,
      history,
      page_context: pageContext
    });
    return response.data;
  },

  /**
   * Send recorded audio Blob to Groq Whisper for ASR.
   */
  async transcribeVoice(audioBlob: Blob): Promise<{ transcript: string; language_detected: string }> {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'audio.webm');
    
    const response = await api.post('/api/assistant/voice/stt', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return response.data;
  },

  /**
   * Generate speech audio and return a local Object URL for playing.
   */
  async getSpeechAudio(text: string, language: string): Promise<string> {
    const response = await api.post('/api/assistant/voice/tts', {
      text,
      language
    }, {
      responseType: 'blob'
    });
    
    // Convert audio response Blob to local playing URL (uses actual type returned by server)
    return URL.createObjectURL(response.data);
  }
};
