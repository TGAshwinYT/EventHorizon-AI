export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface ChatSession {
  id: string;
  name: string;
  timestamp: number;
  messages: ChatMessage[];
  language: string;
}

const RECENT_KEY = 'eventhorizon_recent_chats';
const HISTORY_KEY = 'eventhorizon_chat_history';

export const chatMemory = {
  /**
   * Helper to truncate and extract a concise, clean session name from the first user message.
   */
  generateSessionName(firstMessage: string): string {
    const cleanText = firstMessage
      .replace(/[#*`_]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    
    if (cleanText.length <= 30) {
      return cleanText || 'New Conversation';
    }
    
    // Take the first 3-5 words
    const words = cleanText.split(' ');
    if (words.length <= 4) {
      return cleanText.substring(0, 27) + '...';
    }
    
    return words.slice(0, 4).join(' ') + '...';
  },

  /**
   * Get chats from a category ('recent' or 'history').
   */
  getSessions(category: 'recent' | 'history'): ChatSession[] {
    try {
      const key = category === 'recent' ? RECENT_KEY : HISTORY_KEY;
      const raw = localStorage.getItem(key);
      if (!raw) return [];
      return JSON.parse(raw) as ChatSession[];
    } catch (e) {
      console.error('Failed to parse sessions:', e);
      return [];
    }
  },

  /**
   * Save a single session or update it in localStorage.
   */
  saveSession(session: ChatSession, category: 'recent' | 'history' = 'recent') {
    try {
      const key = category === 'recent' ? RECENT_KEY : HISTORY_KEY;
      const sessions = this.getSessions(category);
      
      const existingIdx = sessions.findIndex(s => s.id === session.id);
      if (existingIdx !== -1) {
        sessions[existingIdx] = session;
      } else {
        sessions.unshift(session); // Add to the top
      }
      
      localStorage.setItem(key, JSON.stringify(sessions));
    } catch (e) {
      console.error('Failed to save session:', e);
    }
  },

  /**
   * Find a session by ID anywhere in storage.
   */
  findSession(id: string): { session: ChatSession; category: 'recent' | 'history' } | null {
    const recent = this.getSessions('recent');
    const foundRecent = recent.find(s => s.id === id);
    if (foundRecent) return { session: foundRecent, category: 'recent' };

    const history = this.getSessions('history');
    const foundHistory = history.find(s => s.id === id);
    if (foundHistory) return { session: foundHistory, category: 'history' };

    return null;
  },

  /**
   * Move all 'recent' chats into the 'history' collection.
   * Triggered when the assistant drawer closes or past midnight.
   */
  moveRecentToHistory() {
    try {
      const recent = this.getSessions('recent');
      if (recent.length === 0) return;

      const history = this.getSessions('history');
      
      // Combine and filter duplicates (by session ID)
      const combined = [...recent, ...history];
      const uniqueMap = new Map<string, ChatSession>();
      combined.forEach(s => {
        if (!uniqueMap.has(s.id)) {
          uniqueMap.set(s.id, s);
        }
      });
      
      const sortedHistory = Array.from(uniqueMap.values()).sort((a, b) => b.timestamp - a.timestamp);
      
      localStorage.setItem(HISTORY_KEY, JSON.stringify(sortedHistory));
      localStorage.removeItem(RECENT_KEY);
      
      console.log(`[CHAT MEMORY] Successfully archived ${recent.length} recent chats into history.`);
    } catch (e) {
      console.error('Failed to archive recent chats:', e);
    }
  },

  /**
   * Delete a session by ID.
   */
  deleteSession(id: string, category: 'recent' | 'history') {
    try {
      const key = category === 'recent' ? RECENT_KEY : HISTORY_KEY;
      const sessions = this.getSessions(category);
      const filtered = sessions.filter(s => s.id !== id);
      localStorage.setItem(key, JSON.stringify(filtered));
    } catch (e) {
      console.error('Failed to delete session:', e);
    }
  },

  /**
   * Check if a "midnight transition" is needed and perform it.
   */
  checkMidnightTransition() {
    try {
      const lastCheckKey = 'eventhorizon_last_midnight_check';
      const lastCheck = localStorage.getItem(lastCheckKey);
      const now = new Date();
      
      if (lastCheck) {
        const lastCheckDate = new Date(parseInt(lastCheck, 10));
        // If the date has changed (i.e. we are in a new day), transition
        if (now.getDate() !== lastCheckDate.getDate() || now.getMonth() !== lastCheckDate.getMonth() || now.getFullYear() !== lastCheckDate.getFullYear()) {
          this.moveRecentToHistory();
        }
      }
      
      localStorage.setItem(lastCheckKey, now.getTime().toString());
    } catch (e) {
      console.error('Failed midnight check:', e);
    }
  }
};
