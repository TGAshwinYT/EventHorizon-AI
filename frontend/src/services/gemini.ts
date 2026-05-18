import { assistantApi } from './api';

export const geminiService = {
  /**
   * Request text response from Gemini 3 Flash.
   */
  async generateResponse(message: string, language: string, history: any[], pageContext?: string) {
    return assistantApi.chat(message, language, history, pageContext);
  },

  /**
   * Request TTS voice audio from Gemini (or fallback).
   */
  async generateSpeech(text: string, language: string): Promise<string> {
    return assistantApi.getSpeechAudio(text, language);
  }
};
