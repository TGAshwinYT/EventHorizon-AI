import React, { useEffect, useState } from 'react';
import { History, Trash2, Calendar, MessageSquare, ExternalLink } from 'lucide-react';
import { chatMemory, ChatSession } from '../services/chatMemory';
import { useUserStore } from '../store/userStore';

export const ChatHistory: React.FC = () => {
  const [historySessions, setHistorySessions] = useState<ChatSession[]>([]);

  const loadHistory = () => {
    const list = chatMemory.getSessions('history');
    setHistorySessions(list);
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    chatMemory.deleteSession(id, 'history');
    loadHistory();
  };

  const handleRestoreSession = (session: ChatSession) => {
    // 1. Format and map messages
    const formatted = session.messages.map(msg => ({
      id: Math.random().toString(36).substring(2, 9),
      role: msg.role,
      content: msg.content,
      timestamp: new Date(msg.timestamp)
    }));

    // 2. Hydrate Zustand Store messages
    useUserStore.setState({ messages: formatted });
    
    // 3. Update active assistant language
    useUserStore.getState().setActiveLanguage(session.language);

    // 4. Save to active recent session first so it updates on select
    chatMemory.saveSession(session, 'recent');

    // 5. Fire global window custom event so AssistantDrawer catches it and slides open
    const event = new CustomEvent('eventhorizon_open_drawer', { 
      detail: { sessionId: session.id } 
    });
    window.dispatchEvent(event);
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  };

  if (historySessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center bg-slate-950/40 border border-slate-800/30 rounded-2xl backdrop-blur-md">
        <History className="h-10 w-10 text-amber-500/30 mb-3 animate-pulse" />
        <p className="text-sm font-semibold text-slate-300">No chat history archived yet.</p>
        <p className="text-xs text-slate-500 mt-1 max-w-[280px]">
          Conversations are automatically archived here on drawer close or past midnight.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-slate-950/40 border border-slate-800/30 rounded-2xl backdrop-blur-md p-5 space-y-4">
      <div className="flex items-center gap-2 border-b border-slate-800/40 pb-3 mb-2">
        <History className="h-5 w-5 text-amber-500" />
        <div>
          <h2 className="text-base font-bold text-slate-200">Conversational Archives</h2>
          <p className="text-xs text-slate-500">Pick up any conversation from previous advisor sessions.</p>
        </div>
      </div>

      <div className="space-y-2.5 max-h-[350px] overflow-y-auto pr-1 custom-scrollbar">
        {historySessions.map((session) => (
          <div
            key={session.id}
            onClick={() => handleRestoreSession(session)}
            className="group flex items-center justify-between p-3.5 rounded-xl cursor-pointer bg-slate-900/60 hover:bg-slate-800/50 border border-slate-800/50 hover:border-amber-500/30 transition-all duration-300 shadow-sm"
          >
            <div className="flex items-start gap-3 min-w-0 pr-6">
              <div className="p-2 rounded-lg bg-slate-800/60 text-slate-400 group-hover:text-amber-400 group-hover:bg-amber-500/10 transition-colors duration-300 shrink-0">
                <MessageSquare className="h-4.5 w-4.5" />
              </div>
              <div className="min-w-0">
                <h4 className="text-sm font-semibold text-slate-200 group-hover:text-white truncate">
                  {session.name}
                </h4>
                <div className="flex items-center gap-2.5 mt-1.5 flex-wrap">
                  <span className="flex items-center gap-1 text-xxs text-slate-500">
                    <Calendar className="h-3 w-3 shrink-0" />
                    {formatDate(session.timestamp)}
                  </span>
                  <span className="text-[9px] uppercase font-extrabold text-amber-500 bg-amber-500/5 px-2 py-0.5 rounded-md border border-amber-500/10">
                    {session.language === 'ta-en' ? 'Tanglish' : session.language === 'hi-en' ? 'Hinglish' : session.language.toUpperCase()}
                  </span>
                  <span className="text-xxs text-slate-500">
                    {session.messages.length} messages
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={(e) => handleDelete(e, session.id)}
                className="opacity-0 group-hover:opacity-100 p-2 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all duration-200"
                title="Delete Archive"
              >
                <Trash2 className="h-4 w-4" />
              </button>
              <div className="p-2 rounded-lg bg-slate-800/40 text-slate-500 group-hover:text-amber-400 transition-colors duration-200">
                <ExternalLink className="h-4 w-4" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
