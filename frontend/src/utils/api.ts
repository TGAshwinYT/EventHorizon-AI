import axios from 'axios';

const API_BASE_URL = '/api';

export interface ChatRequest {
  message?: string;
  language?: string;
  voice_enabled?: boolean;
  context?: string;
  audio?: Blob;
}

export interface ChatResponse {
  response_text: string;
  user_text?: string;
  audio_base64?: string;
  detected_language: string;
  sentiment?: string;
}

export interface MarketItem {
  name: string;
  price: string;
  location: string;
  trend: string;
}

export const api = {
  async sendChatMessage(request: ChatRequest): Promise<ChatResponse> {
    const formData = new FormData();
    
    if (request.message) formData.append('message', request.message);
    if (request.language) formData.append('language', request.language);
    if (request.voice_enabled !== undefined) formData.append('voice_enabled', String(request.voice_enabled));
    if (request.context) formData.append('context', request.context);
    if (request.audio) formData.append('audio', request.audio, 'recording.webm');
    
    const response = await axios.post<ChatResponse>(`${API_BASE_URL}/chat/`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    
    return response.data;
  },

  async getMarketData(): Promise<MarketItem[]> {
    const response = await axios.get<MarketItem[]>(`${API_BASE_URL}/market/`);
    return response.data;
  },

  async transcribeAudio(audio: Blob, language: string = 'hi'): Promise<{ text: string; language: string }> {
    const formData = new FormData();
    formData.append('audio', audio, 'recording.webm');
    formData.append('language', language);
    
    const response = await axios.post(`${API_BASE_URL}/voice/transcribe`, formData);
    return response.data;
  },

  async synthesizeSpeech(text: string, language: string = 'hi'): Promise<{ audio_base64: string }> {
    const response = await axios.post(`${API_BASE_URL}/voice/synthesize`, {
      text,
      language,
    });
    return response.data;
  },
};
