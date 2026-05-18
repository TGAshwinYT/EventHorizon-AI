import { create } from 'zustand';
import api from '../api';

export interface UserProfile {
  username: string;
  display_name?: string;
  language?: string;
  state?: string;
  district?: string;
  mandal?: string;
  crops?: string[];
  alerts_enabled: boolean;
  onboarding_completed: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  audioUrl?: string;
  timestamp: Date;
}

interface UserState {
  token: string | null;
  profile: UserProfile | null;
  messages: ChatMessage[];
  isListening: boolean;
  isSpeaking: boolean;
  isAnalyzingPage: boolean;
  pageSummary: string | null;
  pageKeyPoints: string[];
  pageSuggestedQuestions: string[];
  activeLanguage: string;
  onboardingStep: number;
  ttsEnabled: boolean;
  
  // Actions
  setToken: (token: string | null) => void;
  setProfile: (profile: UserProfile | null) => void;
  setIsListening: (isListening: boolean) => void;
  setIsSpeaking: (isSpeaking: boolean) => void;
  setIsAnalyzingPage: (isAnalyzingPage: boolean) => void;
  setActiveLanguage: (lang: string) => void;
  setOnboardingStep: (step: number) => void;
  setTtsEnabled: (enabled: boolean) => void;
  
  // Chat Actions
  addMessage: (role: 'user' | 'assistant', content: string, audioUrl?: string) => void;
  clearMessages: () => void;
  
  // Async Operations
  fetchProfile: () => Promise<UserProfile | null>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<boolean>;
  saveMemory: (key: string, value: string) => Promise<void>;
  analyzePage: (title: string, url: string, content: string) => Promise<void>;
}

export const useUserStore = create<UserState>((set, get) => ({
  token: localStorage.getItem('event_horizon_token'),
  profile: null,
  messages: [],
  isListening: false,
  isSpeaking: false,
  isAnalyzingPage: false,
  pageSummary: null,
  pageKeyPoints: [],
  pageSuggestedQuestions: [],
  activeLanguage: localStorage.getItem('event_horizon_lang') || 'en',
  onboardingStep: 0,
  ttsEnabled: localStorage.getItem('event_horizon_tts_enabled') !== 'false',

  setToken: (token) => {
    if (token) {
      localStorage.setItem('event_horizon_token', token);
    } else {
      localStorage.removeItem('event_horizon_token');
    }
    set({ token });
  },

  setProfile: (profile) => set({ profile }),
  setIsListening: (isListening) => set({ isListening }),
  setIsSpeaking: (isSpeaking) => set({ isSpeaking }),
  setIsAnalyzingPage: (isAnalyzingPage) => set({ isAnalyzingPage }),
  
  setActiveLanguage: (lang) => {
    localStorage.setItem('event_horizon_lang', lang);
    set({ activeLanguage: lang });
  },
  
  setTtsEnabled: (ttsEnabled) => {
    localStorage.setItem('event_horizon_tts_enabled', String(ttsEnabled));
    set({ ttsEnabled });
  },
  
  setOnboardingStep: (onboardingStep) => set({ onboardingStep }),

  addMessage: (role, content, audioUrl) => {
    const newMessage: ChatMessage = {
      id: Math.random().toString(36).substring(2, 9),
      role,
      content,
      audioUrl,
      timestamp: new Date()
    };
    set((state) => ({ messages: [...state.messages, newMessage] }));
  },

  clearMessages: () => set({ messages: [] }),

  fetchProfile: async () => {
    const { token } = get();
    if (!token) return null;
    
    try {
      const response = await api.get('/api/assistant/user/profile', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data) {
        set({ 
          profile: response.data,
          activeLanguage: response.data.language || get().activeLanguage 
        });
        return response.data;
      }
    } catch (error) {
      console.error('[STORE PROFILE FETCH ERROR]', error);
    }
    return null;
  },

  updateProfile: async (updates) => {
    const { token } = get();
    if (!token) return false;
    
    try {
      const response = await api.post('/api/assistant/user/profile', updates, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data) {
        set({ 
          profile: response.data,
          activeLanguage: response.data.language || get().activeLanguage
        });
        return true;
      }
    } catch (error) {
      console.error('[STORE PROFILE UPDATE ERROR]', error);
    }
    return false;
  },

  saveMemory: async (key, value) => {
    const { profile } = get();
    if (!profile) return;
    try {
      await api.post('/api/assistant/user/memory', {
        user_id: profile.username,
        key,
        value
      });
    } catch (error) {
      console.error('[STORE SAVE MEMORY ERROR]', error);
    }
  },

  analyzePage: async (title, url, content) => {
    const { profile } = get();
    set({ isAnalyzingPage: true, pageSummary: null, pageKeyPoints: [], pageSuggestedQuestions: [] });
    try {
      const response = await api.post('/api/assistant/page/analyze', {
        page_title: title,
        page_url: url,
        page_content: content,
        user_id: profile?.username
      });
      if (response.data) {
        set({
          pageSummary: response.data.summary,
          pageKeyPoints: response.data.key_points || [],
          pageSuggestedQuestions: response.data.suggested_questions || []
        });
      }
    } catch (error) {
      console.error('[STORE PAGE ANALYZE ERROR]', error);
    } finally {
      set({ isAnalyzingPage: false });
    }
  }
}));
