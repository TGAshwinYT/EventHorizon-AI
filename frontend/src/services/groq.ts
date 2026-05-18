import { assistantApi } from './api';

export const groqService = {
  /**
   * Request voice transcription from Groq Whisper whisper-large-v3.
   */
  async transcribeAudio(audioBlob: Blob): Promise<{ transcript: string; language_detected: string }> {
    return assistantApi.transcribeVoice(audioBlob);
  }
};
