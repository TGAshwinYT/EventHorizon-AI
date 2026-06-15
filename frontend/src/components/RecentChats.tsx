import React, { useEffect, useState } from 'react';
import { MessageSquare, Trash2, Calendar, ArrowRight } from 'lucide-react';
import { chatMemory, ChatSession } from '../services/chatMemory';

interface RecentChatsProps {
  onSelectSession: (session: ChatSession) => void;
  activeSessionId?: string | null;
}

export const RecentChats: React.FC<RecentChatsProps> = ({ onSelectSession, activeSessionId }) => {
  const [sessions, setSessions] = useState<ChatSession[]>([]);

  const loadRecentSessions = () => {
    const list = chatMemory.getSessions('recent');
    setSessions(list);
  };

  useEffect(() => {
    loadRecentSessions();
    // Setup a small listener check interval for updates
    const interval = setInterval(loadRecentSessions, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    chatMemory.deleteSession(id, 'recent');
    loadRecentSessions();
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-6 text-center text-slate-400">
        <MessageSquare className="h-10 w-10 text-emerald-500/40 mb-2 animate-pulse" />
        <p className="text-sm font-medium">No active chats today.</p>
        <p className="text-xs text-slate-500 mt-1">Start speaking or typing to build a new session!</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
      <h3 className="text-xs font-semibold text-amber-500/80 uppercase tracking-wider px-2 mb-1 flex items-center gap-1.5">
        <Calendar className="h-3 w-3" /> Today's Conversations
      </h3>
      {sessions.map((session) => {
        const isActive = session.id === activeSessionId;
        return (
          <div
            key={session.id}
            onClick={() => onSelectSession(session)}
            className={`group relative flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all duration-300 border backdrop-blur-md ${
              isActive
                ? 'bg-emerald-500/10 border-emerald-500/50 shadow-md shadow-emerald-500/5'
                : 'bg-slate-900/40 hover:bg-slate-800/40 border-slate-700/30 hover:border-amber-500/30'
            }`}
          >
            <div className="flex items-start gap-3 pr-8 min-w-0">
              <div className={`p-2 rounded-lg shrink-0 ${
                isActive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800/60 text-slate-400'
              }`}>
                <MessageSquare className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-200 group-hover:text-white truncate">
                  {session.name}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xxs text-slate-500">{formatTime(session.timestamp)}</span>
                  <span className="text-[10px] uppercase font-bold text-amber-500/70 bg-amber-500/5 px-1.5 py-0.5 rounded-md">
                    {session.language.toUpperCase()}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={(e) => handleDelete(e, session.id)}
                className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all duration-200"
                title="Delete Chat"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
              <ArrowRight className={`h-4 w-4 transition-transform duration-300 ${
                isActive ? 'text-emerald-400 translate-x-0' : 'text-slate-500 group-hover:translate-x-1'
              }`} />
            </div>
          </div>
        );
      })}
    </div>
  );
};
