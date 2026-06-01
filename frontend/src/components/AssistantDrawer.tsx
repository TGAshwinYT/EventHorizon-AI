import { useState, useRef, useEffect } from 'react';
import { useUserStore } from '../store/userStore';
import { useVoice } from '../hooks/useVoice';
import { usePageContext } from '../hooks/usePageContext';
import VoiceWaveform from './VoiceWaveform';
import { RecentChats } from './RecentChats';
import { chatMemory, ChatSession } from '../services/chatMemory';
import { X, Send, Mic, Volume2, Sparkles, ChevronRight, FileText, MessageSquare, History, VolumeX, Trash2 } from 'lucide-react';

export default function AssistantDrawer() {
  const isListening = useUserStore((state) => state.isListening);
  const setIsListening = useUserStore((state) => state.setIsListening);
  const messages = useUserStore((state) => state.messages);
  const clearMessages = useUserStore((state) => state.clearMessages);
  const profile = useUserStore((state) => state.profile);
  const activeLanguage = useUserStore((state) => state.activeLanguage);
  
  const ttsEnabled = useUserStore((state) => state.ttsEnabled);
  const setTtsEnabled = useUserStore((state) => state.setTtsEnabled);
  const pageKeyPoints = useUserStore((state) => state.pageKeyPoints);

  const [textInput, setTextInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // Active Session states
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [activeSessionName, setActiveSessionName] = useState<string | null>(null);
  const [activeSessionTimestamp, setActiveSessionTimestamp] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'chat' | 'recent'>('chat');
  const currentSessionIdRef = useRef<string>(Math.random().toString(36).substring(2, 15));

  // Hook integrations
  const {
    isRecording,
    recordingSeconds,
    voiceLoading,
    isSpeaking,
    startRecording,
    stopRecording,
    sendTextMessage,
    stopPlayback,
    speakText
  } = useVoice();

  const {
    pageTitle,
    summary: pageSummary,
    loading: pageLoading,
    triggerPageAnalysis,
    suggestedQuestions
  } = usePageContext();

  // Scroll to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, voiceLoading, activeTab]);

  // Load session or handle custom open drawer event
  useEffect(() => {
    chatMemory.checkMidnightTransition();

    const handleOpenDrawer = (e: Event) => {
      const customEvent = e as CustomEvent;
      const id = customEvent.detail?.sessionId;
      if (id) {
        const found = chatMemory.findSession(id);
        if (found) {
          setActiveSessionId(found.session.id);
          setActiveSessionName(found.session.name);
          setActiveSessionTimestamp(found.session.timestamp);
          setActiveTab('chat');
          setIsListening(true);
        }
      }
    };

    window.addEventListener('eventhorizon_open_drawer', handleOpenDrawer);
    return () => {
      window.removeEventListener('eventhorizon_open_drawer', handleOpenDrawer);
    };
  }, [setIsListening]);

  // Hey Horizon Wake Word Automation Effect
  useEffect(() => {
    const playChimeSound = () => {
      try {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();
        
        // Note 1 (C5)
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(523.25, ctx.currentTime);
        gain1.gain.setValueAtTime(0.0, ctx.currentTime);
        gain1.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.05);
        gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
        osc1.start(ctx.currentTime);
        osc1.stop(ctx.currentTime + 0.35);
        
        // Note 2 (E5)
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(659.25, ctx.currentTime + 0.12);
        gain2.gain.setValueAtTime(0.0, ctx.currentTime + 0.12);
        gain2.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.17);
        gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.47);
        osc2.start(ctx.currentTime + 0.12);
        osc2.stop(ctx.currentTime + 0.47);
      } catch (err) {
        console.warn("Failed to play wake chime:", err);
      }
    };

    const handleWakeup = async () => {
      setIsListening(true);
      setActiveTab('chat');
      
      setTimeout(async () => {
        playChimeSound();
        
        const langGreetings: Record<string, string> = {
          en: "Yes, I am listening. How can I help you?",
          ta: "சொல்லுங்க அண்ணா, நான் கேட்கிறேன். என்ன உதவி வேண்டும்?",
          hi: "हाँ भैया, मैं सुन रहा हूँ। मैं आपकी क्या मदद कर सकता हूँ?",
          te: "చెப்பండి అన్నా, నేను వింటున్నాను. మీకు ఏమి సహాయం కావాలి?",
          bn: "হ্যাঁ দাদা, আমি শুনছি। আপনাকে কীভাবে সাহায্য করতে পারি?",
          mr: "होय दादा, मी ऐकत आहे. मी तुम्हाला कशी मदत करू?",
          gu: "હા દાદા, હું સાંભળી રહ્યો છું. હું તમારી શું મદદ કરી શકું?",
          kn: "ಹೌದು ಅಣ್ಣ, ನಾನು ಕೇಳುತ್ತಿದ್ದೇನೆ. ನಾನು ನಿಮಗೆ ಹೇಗೆ ಸಹಾಯ ಮಾಡಲಿ?",
          ml: "അതെ ചേട്ടാ, ഞാൻ കേൾക്കുന്നുണ്ട്. ഞാൻ എങ്ങനെ സഹായിക്കണം?"
        };
        
        const greeting = langGreetings[activeLanguage] || langGreetings['en'];
        await speakText(greeting);
        startRecording();
      }, 500);
    };

    window.addEventListener('eventhorizon_wakeup', handleWakeup);
    return () => {
      window.removeEventListener('eventhorizon_wakeup', handleWakeup);
    };
  }, [setIsListening, activeLanguage, speakText, startRecording]);

  // Automatically save and update active session as messages stream in
  useEffect(() => {
    if (messages.length > 0) {
      const firstUserMsg = messages.find(m => m.role === 'user')?.content || messages[0].content;
      const sessName = activeSessionName || chatMemory.generateSessionName(firstUserMsg);
      const sessTimestamp = activeSessionTimestamp || Date.now();
      const sessId = activeSessionId || currentSessionIdRef.current;

      const currentSession: ChatSession = {
        id: sessId,
        name: sessName,
        timestamp: sessTimestamp,
        messages: messages.map(m => ({
          role: m.role,
          content: m.content,
          timestamp: m.timestamp instanceof Date ? m.timestamp.getTime() : new Date(m.timestamp).getTime()
        })),
        language: activeLanguage
      };

      if (!activeSessionId) {
        setActiveSessionId(sessId);
        setActiveSessionName(sessName);
        setActiveSessionTimestamp(sessTimestamp);
      }

      chatMemory.saveSession(currentSession, 'recent');
    }
  }, [messages, activeLanguage, activeSessionId, activeSessionName, activeSessionTimestamp]);

  // If the assistant is not opened, don't show the drawer
  if (!isListening) return null;

  const handleSendText = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!textInput.trim()) return;
    
    const message = textInput;
    setTextInput('');
    await sendTextMessage(message);
  };

  const handleMicClick = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const handleQuickQuestion = async (question: string) => {
    await sendTextMessage(question);
  };

  const handleClearChat = () => {
    clearMessages();
    currentSessionIdRef.current = Math.random().toString(36).substring(2, 15);
    setActiveSessionId(null);
    setActiveSessionName(null);
    setActiveSessionTimestamp(null);
  };

  const handleSelectRecentSession = (session: ChatSession) => {
    const formatted = session.messages.map(msg => ({
      id: Math.random().toString(36).substring(2, 9),
      role: msg.role,
      content: msg.content,
      timestamp: new Date(msg.timestamp)
    }));

    useUserStore.setState({ messages: formatted });
    useUserStore.getState().setActiveLanguage(session.language);
    
    setActiveSessionId(session.id);
    setActiveSessionName(session.name);
    setActiveSessionTimestamp(session.timestamp);
    setActiveTab('chat');
  };

  const handleCloseDrawer = () => {
    stopPlayback();
    // Archive today's active chats to historical settings panel on closing drawer
    chatMemory.moveRecentToHistory();
    setIsListening(false);
  };

  return (
    <div id="assistant-drawer-container" className="fixed inset-0 z-[100] flex justify-end bg-black/40 backdrop-blur-sm animate-fade-in">
      
      {/* Click outside to close (desktop only) */}
      <div 
        className="hidden md:block flex-1"
        onClick={handleCloseDrawer}
      />

      {/* Main Drawer Shell */}
      <div className="w-full md:w-[420px] h-full bg-[#FAFAF7] flex flex-col shadow-2xl animate-slide-up border-l border-[#eaeae0]">
        
        {/* Drawer Header */}
        <div className="bg-[#1A4731] text-white px-5 py-4 flex items-center justify-between shadow-md h-18 select-none">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative shrink-0">
              <span className="inline-block h-10 w-10 rounded-full bg-gradient-to-tr from-[#F5A623] to-[#4A90D9] p-0.5 shadow-md">
                <span className="flex h-full w-full items-center justify-center rounded-full bg-[#0D1F16] text-[#F5A623] text-lg font-bold">
                  H
                </span>
              </span>
              <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-green-500 border-2 border-[#1A4731]"></span>
            </div>
            <div className="min-w-0">
              <h2 className="font-extrabold text-base flex items-center gap-2 whitespace-nowrap">
                Horizon
                <span className="text-[10px] bg-[#F5A623] text-[#0d1f16] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider whitespace-nowrap shrink-0">
                  AI Friend
                </span>
              </h2>
              <p className="text-xs text-[#8b9b8b] font-medium whitespace-nowrap overflow-hidden text-ellipsis max-w-[150px]">
                {isRecording ? 'Listening...' : isSpeaking ? 'Speaking...' : 'Ready to help anna'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Clear Chat Button */}
            <button 
              onClick={handleClearChat}
              className="p-2 rounded-xl text-[#b0c0b0] hover:text-white hover:bg-white/10 cursor-pointer transition-all flex items-center justify-center"
              title="Clear Chat"
            >
              <Trash2 className="h-5 w-5" />
            </button>
            
            {/* Voice TTS Toggle Button */}
            <button
              onClick={() => setTtsEnabled(!ttsEnabled)}
              className={`p-2 rounded-xl hover:bg-white/10 cursor-pointer transition-all flex items-center justify-center ${
                ttsEnabled ? 'text-[#F5A623]' : 'text-red-400 hover:text-red-300'
              }`}
              title={ttsEnabled ? "Mute Voice (TTS)" : "Unmute Voice (TTS)"}
            >
              {ttsEnabled ? <Volume2 className="h-5 w-5 animate-pulse" /> : <VolumeX className="h-5 w-5" />}
            </button>
            
            {/* Close Button */}
            <button 
              onClick={handleCloseDrawer}
              className="p-2 rounded-xl hover:bg-white/10 text-white cursor-pointer transition-all flex items-center justify-center"
              title="Close Assistant"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Dynamic Sub-Tab Navigator */}
        <div className="flex border-b border-[#eaeae0] bg-[#f4f4ec]">
          <button
            onClick={() => setActiveTab('chat')}
            className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 border-b-2 transition-all duration-300 ${
              activeTab === 'chat'
                ? 'border-[#1A4731] text-[#1A4731] bg-white'
                : 'border-transparent text-[#5a6e5a] hover:text-[#1A4731]'
            }`}
          >
            <MessageSquare className="h-4 w-4" />
            Chat Window
          </button>
          <button
            onClick={() => setActiveTab('recent')}
            className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 border-b-2 transition-all duration-300 ${
              activeTab === 'recent'
                ? 'border-[#1A4731] text-[#1A4731] bg-white'
                : 'border-transparent text-[#5a6e5a] hover:text-[#1A4731]'
            }`}
          >
            <History className="h-4 w-4" />
            Recent Chats
          </button>
        </div>

        {activeTab === 'chat' ? (
          <>
            {/* Page Context Banner */}
            <div className="bg-[#eef7f2] border-b border-[#d2edd7] px-4 py-2.5 flex items-center justify-between text-xs text-[#1A4731]">
              <div className="flex items-center gap-2 font-semibold">
                <Sparkles className="h-4 w-4 text-[#F5A623] animate-pulse" />
                <span className="truncate max-w-[220px]">
                  Reading: {pageTitle || 'Event Horizon Page'}
                </span>
              </div>
              <button
                onClick={triggerPageAnalysis}
                disabled={pageLoading}
                className="flex items-center gap-1 bg-[#1A4731] hover:bg-[#123323] text-white font-bold py-1 px-2.5 rounded-lg shadow-sm disabled:opacity-50 cursor-pointer"
              >
                <FileText className="h-3 w-3" />
                {pageLoading ? 'Analyzing...' : 'Analyze Page'}
              </button>
            </div>

            {/* Chat Bubbles Scroll Panel */}
            <div className="flex-1 overflow-y-auto custom-scrollbar px-4 py-5 space-y-4 bg-[#FAFAF7]">
              
              {/* Premium Page AI Advisory Card */}
              {pageSummary && (
                <div className="bg-[#1A4731] text-white rounded-2xl p-4 shadow-md border border-[#F5A623]/20 space-y-3 relative overflow-hidden animate-fade-in">
                  <div className="absolute -top-10 -right-10 w-24 h-24 bg-[#F5A623]/10 rounded-full blur-xl pointer-events-none" />
                  
                  <div className="flex items-center justify-between border-b border-white/10 pb-2 relative z-10">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="h-4 w-4 text-[#F5A623] animate-pulse" />
                      <h4 className="font-extrabold text-xs uppercase tracking-wider text-[#F5A623]">Page AI Advisory</h4>
                    </div>
                    <button 
                      onClick={() => useUserStore.setState({ pageSummary: null, pageKeyPoints: [], pageSuggestedQuestions: [] })}
                      className="text-[10px] text-[#b0c0b0] hover:text-white underline cursor-pointer"
                    >
                      Dismiss
                    </button>
                  </div>

                  <div className="relative z-10">
                    <span className="text-[10px] text-white/40 block mb-1 font-mono uppercase tracking-wider truncate">Reading: {pageTitle || 'Active Page'}</span>
                    <p className="text-xs font-semibold leading-relaxed text-gray-100">{pageSummary}</p>
                  </div>

                  {pageKeyPoints && pageKeyPoints.length > 0 && (
                    <div className="space-y-1 relative z-10">
                      <p className="text-[10px] font-bold text-[#F5A623] uppercase tracking-widest">Key Insights:</p>
                      <ul className="text-[11px] space-y-1 text-gray-200 pl-1 list-none">
                        {pageKeyPoints.map((pt, idx) => (
                          <li key={idx} className="flex items-start gap-1.5">
                            <span className="text-[#F5A623] shrink-0 font-bold">✔</span>
                            <span>{pt}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="flex gap-2 pt-1 relative z-10">
                    <button
                      onClick={() => {
                        let fullSpeechText = pageSummary || "";
                        if (pageKeyPoints && pageKeyPoints.length > 0) {
                          const langTransitions: Record<string, string> = {
                            en: "Here are the key insights: ",
                            ta: "முக்கிய கருத்துக்கள்: ",
                            hi: "मुख्य बातें: ",
                            te: "ముఖ్యమైన విషయాలు: ",
                            kn: "ಮುಖ್ಯ ಮಾಹಿತಿ: ",
                            ml: "പ്രധാന വിവരങ്ങൾ: ",
                            bn: "মূল তথ্যগুলি: ",
                            mr: "मुख्य मुद्दे: ",
                            gu: "મુખ્ય વિગતો: ",
                            pa: "ਮੁੱਖ ਨੁਕਤੇ: "
                          };
                          const transition = langTransitions[activeLanguage] || langTransitions['en'];
                          fullSpeechText += ". " + transition + " " + pageKeyPoints.join(". ");
                        }
                        speakText(fullSpeechText);
                      }}
                      disabled={voiceLoading}
                      className={`flex-1 border rounded-lg py-1.5 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        isSpeaking ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 animate-pulse' :
                        'bg-white/10 hover:bg-white/20 text-white border-white/20'
                      }`}
                    >
                      <Volume2 className="h-3.5 w-3.5" />
                      {isSpeaking ? 'Speaking...' : 'Listen to Advisor'}
                    </button>
                  </div>

                  {suggestedQuestions && suggestedQuestions.length > 0 && (
                    <div className="space-y-1.5 pt-2 border-t border-white/10 relative z-10">
                      <p className="text-[9px] font-bold text-white/50 uppercase tracking-wider pl-1">Ask Horizon about this page:</p>
                      <div className="flex flex-wrap gap-1.5">
                        {suggestedQuestions.map((q, idx) => (
                          <button
                            key={idx}
                            onClick={() => handleQuickQuestion(q)}
                            className="text-left py-1 px-2 text-[10px] font-bold text-white bg-white/5 hover:bg-[#F5A623] hover:text-[#0d1f16] rounded-lg border border-white/10 transition-all flex items-center gap-1 cursor-pointer"
                          >
                            <span>{q}</span>
                            <ChevronRight className="h-3 w-3 opacity-60" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Welcome Message if empty */}
              {messages.length === 0 && !pageSummary && (
                <div className="text-center p-6 space-y-4 bg-white rounded-2xl border border-[#eaeae0] mx-2 shadow-sm animate-fade-in">
                  <div className="text-3xl">🌾</div>
                  <h3 className="font-extrabold text-[#1A4731] text-lg">
                    வணக்கம் {profile?.display_name || 'நண்பா'}!
                  </h3>
                  <p className="text-sm text-[#5a6e5a] leading-relaxed">
                    சொல்லுங்க, நான் உங்களுக்கு எப்படி உதவ முடியும்? உங்களது பயிர்கள், வானிலை அல்லது மானியம் பற்றி எதை வேண்டுமானாலும் கேளுங்கள்!
                  </p>
                </div>
              )}

              {/* Messages list */}
              {messages.map((msg) => {
                const isUser = msg.role === 'user';
                return (
                  <div
                    key={msg.id}
                    className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-fade-in`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-sm ${
                        isUser
                          ? 'bg-[#F5A623] text-[#0d1f16] rounded-tr-none font-semibold'
                          : 'bg-[#1A4731] text-white rounded-tl-none font-medium'
                      }`}
                    >
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                      
                      {/* Speak answer trigger for AI message */}
                      {!isUser && (
                        <button
                          onClick={() => speakText(msg.content)}
                          className="mt-1.5 flex items-center gap-1 text-[10px] text-[#b0c0b0] hover:text-[#F5A623] font-bold cursor-pointer transition-colors"
                        >
                          <Volume2 className="h-3.5 w-3.5" />
                          Listen Again
                        </button>
                      )}
                      
                      <span className="block text-[9px] text-right mt-1 opacity-60">
                        {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                );
              })}

              {/* Voice recording loader */}
              {voiceLoading && (
                <div className="flex justify-start">
                  <div className="bg-[#1A4731] text-white rounded-2xl rounded-tl-none px-4 py-3 shadow-sm flex items-center gap-2">
                    <span className="flex h-2 w-2 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                    </span>
                    <span className="text-xs font-semibold">Horizon is thinking...</span>
                  </div>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>

            {/* Dynamic Voice Waveform Panel */}
            <div className="bg-white border-t border-[#eaeae0] py-2">
              <VoiceWaveform active={isRecording || isSpeaking} />
            </div>

            {/* Voice Controls & Input Bar */}
            <div className="p-4 bg-white border-t border-[#eaeae0] space-y-3">
              
              {/* Active recording state panel */}
              {isRecording && (
                <div className="flex items-center justify-between bg-red-50 text-red-600 px-4 py-2 rounded-xl text-xs font-bold animate-pulse">
                  <span>🎤 RECORDING ACTIVE</span>
                  <span>{recordingSeconds}s</span>
                </div>
              )}

              <form onSubmit={handleSendText} className="flex items-center gap-3">
                
                {/* Interactive Mic Orb */}
                <button
                  type="button"
                  onClick={handleMicClick}
                  className={`p-4 rounded-full shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer flex-shrink-0 ${
                    isRecording
                      ? 'bg-red-600 text-white animate-pulse'
                      : 'bg-[#1A4731] hover:bg-[#123323] text-white'
                  }`}
                  title={isRecording ? 'Stop Recording' : 'Speak to Horizon'}
                >
                  <Mic className="h-5.5 w-5.5" />
                </button>

                {/* Input Text Box */}
                <input
                  type="text"
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder="Ask anything or speak / தட்டச்சு செய்க..."
                  className="flex-1 px-4 py-3.5 rounded-2xl border border-[#eaeae0] focus:border-[#1A4731] outline-none text-sm font-semibold text-[#1A4731] bg-white placeholder-gray-400"
                  disabled={isRecording}
                />

                {/* Send Button */}
                <button
                  type="submit"
                  disabled={!textInput.trim() || isRecording}
                  className="p-3.5 rounded-full bg-[#1A4731] hover:bg-[#123323] text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                >
                  <Send className="h-5 w-5" />
                </button>
              </form>
            </div>
          </>
        ) : (
          /* Recent Chats Tab panel content */
          <div className="flex-1 bg-[#FAFAF7] px-5 py-6">
            <RecentChats
              onSelectSession={handleSelectRecentSession}
              activeSessionId={activeSessionId}
            />
          </div>
        )}

      </div>
    </div>
  );
}
