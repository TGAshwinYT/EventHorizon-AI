import { useState, useRef, useEffect, FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Send, Mic, Volume2, VolumeX, Bot, User, Loader2 } from 'lucide-react';

interface Message {
  role: 'user' | 'model';
  content: string;
}

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [useVoice, setUseVoice] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const initAudio = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 24000,
      });
    }
  };

  const playAudio = async (base64Audio: string) => {
    initAudio();
    const ctx = audioContextRef.current!;
    
    // Convert base64 to binary
    const binaryString = atob(base64Audio);
    const len = binaryString.length;
    const bytes = new Int16Array(len / 2);
    for (let i = 0; i < len; i += 2) {
      // 16-bit PCM Little Endian
      bytes[i / 2] = binaryString.charCodeAt(i) | (binaryString.charCodeAt(i + 1) << 8);
    }

    // Convert Int16 PCM to Float32
    const float32Data = new Float32Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) {
      float32Data[i] = bytes[i] / 32768.0;
    }

    const buffer = ctx.createBuffer(1, float32Data.length, 24000);
    buffer.getChannelData(0).set(float32Data);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    
    setIsSpeaking(true);
    source.onended = () => setIsSpeaking(false);
    source.start();
  };

  const handleSubmit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      // 1. Get Text Response from Gemini 3 Flash
      const chatResponse = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: userMessage,
          history: messages.map(m => ({
            role: m.role,
            parts: [{ text: m.content }]
          }))
        }),
      });

      const chatData = await chatResponse.json();
      if (chatData.error) throw new Error(chatData.error);

      setMessages(prev => [...prev, { role: 'model', content: chatData.text }]);
      
      // 2. Generate Voice if enabled
      if (useVoice) {
        const ttsResponse = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: chatData.text }),
        });
        const ttsData = await ttsResponse.json();
        if (ttsData.audio) {
          playAudio(ttsData.audio);
        }
      }
    } catch (error) {
      console.error('Error:', error);
      setMessages(prev => [...prev, { role: 'model', content: "Sorry, I encountered an error. Please check your API key in Settings > Secrets." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-indigo-500/30">
      {/* Header */}
      <header className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Bot className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-lg tracking-tight">Gemini Companion</h1>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs text-zinc-400 font-medium">Flash 3.1 Neural Voice</span>
            </div>
          </div>
        </div>
        <button 
          onClick={() => setUseVoice(!useVoice)}
          className={`p-2.5 rounded-full transition-all duration-300 ${
            useVoice ? 'bg-indigo-600/20 text-indigo-400' : 'bg-zinc-800 text-zinc-500'
          }`}
          title={useVoice ? "Turn off voice" : "Turn on voice"}
        >
          {useVoice ? <Volume2 size={20} /> : <VolumeX size={20} />}
        </button>
      </header>

      {/* Chat Area */}
      <main 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-6 scroll-smooth"
      >
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center opacity-40 py-12">
            <Bot size={64} className="mb-4 text-indigo-400" />
            <h2 className="text-xl font-medium mb-1">How can I help you today?</h2>
            <p className="text-sm max-w-xs">Ask me anything, and I'll respond with Gemini's intelligence and a realistic neural voice.</p>
          </div>
        )}

        <AnimatePresence initial={false}>
          {messages.map((m, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`flex gap-3 max-w-[85%] ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center mt-1 ${
                  m.role === 'user' ? 'bg-zinc-800' : 'bg-indigo-600/20 text-indigo-400'
                }`}>
                  {m.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                </div>
                <div className={`p-4 rounded-2xl ${
                  m.role === 'user' 
                  ? 'bg-indigo-600 text-white rounded-tr-none shadow-lg shadow-indigo-600/10' 
                  : 'bg-zinc-900 border border-zinc-800 rounded-tl-none'
                }`}>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{m.content}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {isLoading && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex justify-start"
          >
            <div className="flex gap-3 items-center text-zinc-500 ml-1">
              <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
              <span className="text-xs font-mono tracking-widest uppercase italic">Processing...</span>
            </div>
          </motion.div>
        )}

        {isSpeaking && (
          <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-zinc-900/80 backdrop-blur border border-indigo-500/30 px-4 py-2 rounded-full flex items-center gap-3 shadow-2xl z-20">
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4].map(i => (
                <motion.div
                  key={i}
                  animate={{ height: [8, 16, 8] }}
                  transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.1 }}
                  className="w-1 bg-indigo-400 rounded-full"
                />
              ))}
            </div>
            <span className="text-xs font-medium text-indigo-300">Speaking...</span>
          </div>
        )}
      </main>

      {/* Input Area */}
      <footer className="p-4 bg-zinc-950 border-t border-zinc-900">
        <form 
          onSubmit={handleSubmit}
          className="max-w-4xl mx-auto relative group"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            className="w-full bg-zinc-900 border border-zinc-800 text-zinc-100 rounded-2xl py-4 pl-5 pr-14 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all placeholder:text-zinc-600 text-sm"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className={`absolute right-2 top-2 h-10 w-10 flex items-center justify-center rounded-xl transition-all ${
              !input.trim() || isLoading 
                ? 'text-zinc-700 bg-zinc-800' 
                : 'text-white bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-600/20'
            }`}
          >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send size={18} />}
          </button>
        </form>
        <p className="text-[10px] text-center mt-3 text-zinc-600 font-medium tracking-wide">
          POWERED BY GEMINI 3 FLASH & NEURAL TTS
        </p>
      </footer>
    </div>
  );
}
