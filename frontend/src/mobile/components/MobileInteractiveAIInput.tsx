import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Loader2, StopCircle, Send, Wifi, WifiOff, Signal } from 'lucide-react';
import type { NetworkQuality } from '../../lib/NetworkMonitor';
import type { PipelineStreamState } from '../../hooks/useAudioPipeline';

interface InteractiveAIInputProps {
    voiceStatus: 'idle' | 'listening' | 'thinking' | 'speaking';
    onMicClick: () => void;
    onSubmitText: (text: string) => void;
    networkQuality?: NetworkQuality;
    streamState?: PipelineStreamState;
    bufferedChunks?: number;
    waveformLevel?: number;
    recordingDuration?: number;
    isRecording?: boolean;
}

const MAX_DURATION = 30;

export default function MobileInteractiveAIInput({
    voiceStatus,
    onMicClick,
    onSubmitText,
    networkQuality = 'good',
    streamState = 'idle',
    bufferedChunks = 0,
    waveformLevel = 0,
    recordingDuration = 0,
    isRecording = false,
}: InteractiveAIInputProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [text, setText] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsExpanded(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (text.trim()) {
                onSubmitText(text);
                setText('');
                setIsExpanded(false);
            }
        } else if (e.key === 'Escape') {
            setIsExpanded(false);
        }
    };

    const handleMicClick = () => {
        if (voiceStatus !== 'idle') {
            onMicClick();
            return;
        }

        if (!isExpanded) {
            setIsExpanded(true);
        } else if (text.trim().length > 0) {
            onSubmitText(text);
            setText('');
            setIsExpanded(false);
        } else {
            onMicClick();
        }
    };

    const getNetworkBadge = () => {
        switch (networkQuality) {
            case 'offline': return { color: '#ef4444', label: '⚠', Icon: WifiOff };
            case '2g': return { color: '#f59e0b', label: '2G', Icon: Signal };
            case '3g': return { color: '#22c55e', label: '3G', Icon: Signal };
            case 'good': return { color: '#10b981', label: '✓', Icon: Wifi };
        }
    };

    const badge = getNetworkBadge();
    const remainingSeconds = MAX_DURATION - recordingDuration;
    const showRecordingState = isRecording || voiceStatus === 'listening';
    const waveformBars = [0.5, 0.8, 1.0, 0.8, 0.5];

    return (
        <div className="fixed bottom-24 right-4 z-[60] flex justify-end items-center h-14" ref={containerRef}>
            <motion.div
                layout
                initial={{ width: 56 }}
                animate={{
                    width: isExpanded ? 'calc(100vw - 32px)' : 56,
                    borderRadius: 28,
                }}
                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                className={`relative flex items-center shadow-2xl h-14 overflow-hidden ${isExpanded
                    ? 'bg-gray-200/95 text-slate-900 backdrop-blur-md border border-white/20'
                    : 'bg-white/10 text-white backdrop-blur-xl border border-white/20'
                    }`}
            >
                {!isExpanded && (
                    <motion.div
                        className="absolute top-0.5 left-0.5 flex items-center justify-center rounded-full text-[7px] font-bold z-20"
                        style={{ width: 14, height: 14, backgroundColor: badge.color, color: '#fff', boxShadow: `0 0 4px ${badge.color}` }}
                        initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                    >
                        {badge.label}
                    </motion.div>
                )}

                <AnimatePresence>
                    {bufferedChunks > 0 && !isExpanded && (
                        <motion.div
                            className="absolute bottom-0.5 left-0.5 flex items-center justify-center rounded-full bg-amber-500 text-white text-[7px] font-bold z-20"
                            style={{ width: 14, height: 14, boxShadow: '0 0 6px rgba(245,158,11,0.5)' }}
                            initial={{ scale: 0 }} animate={{ scale: [1, 1.2, 1] }} exit={{ scale: 0 }}
                        >
                            {bufferedChunks}
                        </motion.div>
                    )}
                </AnimatePresence>

                <AnimatePresence>
                    {showRecordingState && !isExpanded && (
                        <motion.div
                            className="absolute -top-5 right-0 w-[56px] text-center text-[10px] font-mono tabular-nums font-bold"
                            initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
                            style={{ color: remainingSeconds <= 5 ? '#ef4444' : 'rgba(255,255,255,0.8)' }}
                        >
                            {remainingSeconds}s
                        </motion.div>
                    )}
                </AnimatePresence>

                {isExpanded && (
                    <motion.input
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
                        type="text" autoFocus value={text} onChange={(e) => setText(e.target.value)} onKeyDown={handleKeyDown}
                        placeholder="Ask what you want"
                        className="flex-1 bg-transparent border-none focus:outline-none pl-6 pr-2 text-slate-900 placeholder-slate-500 font-medium h-full w-full text-base"
                    />
                )}

                <motion.button
                    layout="position"
                    onClick={handleMicClick}
                    className={`h-14 shrink-0 flex items-center justify-center transition-colors absolute right-0 top-0 bottom-0 ${voiceStatus === 'listening' || isRecording ? 'bg-red-500 text-white shadow-[0_0_20px_rgba(239,68,68,0.5)]' :
                        voiceStatus === 'thinking' ? 'bg-purple-600 text-white shadow-[0_0_20px_rgba(147,51,234,0.5)]' :
                            voiceStatus === 'speaking' ? 'bg-cyan-500 text-white shadow-[0_0_20px_rgba(6,182,212,0.5)]' :
                                streamState === 'buffering' ? 'bg-amber-500 text-white shadow-[0_0_20px_rgba(245,158,11,0.5)]' :
                                    isExpanded ? 'bg-transparent text-slate-900 hover:bg-slate-300' : 'bg-transparent text-white'
                        } ${isExpanded ? 'rounded-full w-14' : 'w-[56px]'}`}
                >
                    {voiceStatus === 'idle' && !isRecording && (
                        text.trim().length > 0 ? (
                            <Send className="w-5 h-5 text-emerald-600 transition-transform hover:scale-110" fill="currentColor" />
                        ) : (
                            <Mic className={`w-6 h-6 ${!isExpanded ? 'text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]' : 'text-slate-900'}`} fill={isExpanded ? "transparent" : "currentColor"} />
                        )
                    )}
                    {isRecording && voiceStatus === 'idle' && (
                        <div className="flex items-center justify-center gap-[2px]">
                            {waveformBars.map((multiplier, i) => (
                                <motion.div key={i} className="w-[2px] rounded-full bg-white" animate={{ height: 4 + waveformLevel * multiplier * 24 }} transition={{ duration: 0.1, ease: 'easeOut' }} />
                            ))}
                        </div>
                    )}
                    {(voiceStatus === 'listening' && !isRecording) && <MicOff className="w-5 h-5 animate-pulse" fill="currentColor" />}
                    {voiceStatus === 'thinking' && <Loader2 className="w-5 h-5 animate-spin" />}
                    {voiceStatus === 'speaking' && <StopCircle className="w-5 h-5" fill="currentColor" />}
                </motion.button>
            </motion.div>
        </div>
    );
}
