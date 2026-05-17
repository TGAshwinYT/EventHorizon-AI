import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Loader2, StopCircle, Send, Wifi, WifiOff, Signal } from 'lucide-react';
import type { NetworkQuality } from '../lib/NetworkMonitor';
import type { PipelineStreamState } from '../hooks/useAudioPipeline';

interface InteractiveAIInputProps {
    voiceStatus: 'idle' | 'listening' | 'thinking' | 'speaking';
    onMicClick: () => void;
    onSubmitText: (text: string) => void;
    // New pipeline props
    networkQuality?: NetworkQuality;
    streamState?: PipelineStreamState;
    bufferedChunks?: number;
    waveformLevel?: number;
    recordingDuration?: number;
    isRecording?: boolean;
}

const MAX_DURATION = 30;

export default function InteractiveAIInput({
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
            // If there's text, act as a Send button
            onSubmitText(text);
            setText('');
            setIsExpanded(false);
        } else {
            onMicClick();
        }
    };

    // Network quality badge config
    const getNetworkBadge = () => {
        switch (networkQuality) {
            case 'offline':
                return { color: '#ef4444', label: '⚠', Icon: WifiOff };
            case '2g':
                return { color: '#f59e0b', label: '2G', Icon: Signal };
            case '3g':
                return { color: '#22c55e', label: '3G', Icon: Signal };
            case 'good':
                return { color: '#10b981', label: '✓', Icon: Wifi };
        }
    };

    const badge = getNetworkBadge();
    const remainingSeconds = MAX_DURATION - recordingDuration;
    const showRecordingState = isRecording || voiceStatus === 'listening';

    // Waveform bars for the recording state
    const waveformBars = [0.5, 0.8, 1.0, 0.8, 0.5];

    return (
        <div className="absolute bottom-12 right-0 z-50 flex justify-end items-center h-16" ref={containerRef}>
            <motion.div
                layout
                initial={{ width: 64, marginRight: 0 }}
                animate={{
                    width: isExpanded ? 400 : 72,
                    borderTopLeftRadius: 32,
                    borderBottomLeftRadius: 32,
                    borderTopRightRadius: isExpanded ? 32 : 0,
                    borderBottomRightRadius: isExpanded ? 32 : 0,
                    marginRight: isExpanded ? 24 : 0,
                }}
                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                className={`relative flex items-center shadow-2xl h-16 overflow-hidden ${isExpanded
                    ? 'bg-gray-200/90 text-slate-900 backdrop-blur-md border border-white/20'
                    : 'bg-white/5 text-white backdrop-blur-xl border-y border-l border-white/10 hover:bg-white/10'
                    }`}
            >
                {/* Network quality badge — shown when not expanded */}
                {!isExpanded && (
                    <motion.div
                        className="absolute top-1 left-1 flex items-center justify-center rounded-full text-[8px] font-bold z-20"
                        style={{
                            width: 16,
                            height: 16,
                            backgroundColor: badge.color,
                            color: '#fff',
                            boxShadow: `0 0 4px ${badge.color}`,
                        }}
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                    >
                        {badge.label}
                    </motion.div>
                )}

                {/* Buffered chunks badge — shown when buffering */}
                <AnimatePresence>
                    {bufferedChunks > 0 && !isExpanded && (
                        <motion.div
                            className="absolute bottom-1 left-1 flex items-center justify-center rounded-full bg-amber-500 text-white text-[8px] font-bold z-20"
                            style={{
                                width: 16,
                                height: 16,
                                boxShadow: '0 0 6px rgba(245,158,11,0.5)',
                            }}
                            initial={{ scale: 0 }}
                            animate={{ scale: [1, 1.2, 1] }}
                            exit={{ scale: 0 }}
                        >
                            {bufferedChunks}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Recording duration countdown */}
                <AnimatePresence>
                    {showRecordingState && !isExpanded && (
                        <motion.div
                            className="absolute -top-6 right-0 w-[72px] text-center text-[10px] font-mono tabular-nums"
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 4 }}
                            style={{
                                color: remainingSeconds <= 5 ? '#ef4444' : 'rgba(255,255,255,0.5)',
                            }}
                        >
                            {remainingSeconds}s
                        </motion.div>
                    )}
                </AnimatePresence>

                {isExpanded && (
                    <motion.input
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.1 }}
                        type="text"
                        autoFocus
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Ask what you want"
                        className="flex-1 bg-transparent border-none focus:outline-none pl-6 pr-2 text-slate-900 placeholder-slate-500 font-medium h-full w-full"
                    />
                )}

                <motion.button
                    id="drawer-mic-btn"
                    layout="position"
                    onClick={handleMicClick}
                    className={`h-16 shrink-0 flex items-center justify-center transition-colors absolute right-0 top-0 bottom-0 ${voiceStatus === 'listening' || isRecording ? 'bg-red-500 text-white shadow-[0_0_20px_rgba(239,68,68,0.5)]' :
                        voiceStatus === 'thinking' ? 'bg-purple-600 text-white shadow-[0_0_20px_rgba(147,51,234,0.5)]' :
                            voiceStatus === 'speaking' ? 'bg-cyan-500 text-white shadow-[0_0_20px_rgba(6,182,212,0.5)]' :
                                streamState === 'buffering' ? 'bg-amber-500 text-white shadow-[0_0_20px_rgba(245,158,11,0.5)]' :
                                    isExpanded ? 'bg-transparent text-slate-900 hover:bg-slate-300' :
                                        'bg-transparent text-white'
                        } ${isExpanded ? 'rounded-r-full w-16' : 'rounded-r-none w-[72px]'}`}
                >
                    {voiceStatus === 'idle' && !isRecording && (
                        text.trim().length > 0 ? (
                            <Send
                                className="w-6 h-6 text-emerald-600 transition-transform hover:scale-110 hover:-translate-y-1 hover:translate-x-1"
                                fill="currentColor"
                            />
                        ) : (
                            <Mic
                                className={`w-7 h-7 ${!isExpanded ? 'text-white drop-shadow-[0_0_12px_rgba(255,255,255,1)] animate-[pulse_2s_ease-in-out_infinite]' : 'text-slate-900'}`}
                                fill={isExpanded ? "transparent" : "currentColor"}
                            />
                        )
                    )}
                    {/* Waveform bars when recording via pipeline */}
                    {isRecording && voiceStatus === 'idle' && (
                        <div className="flex items-center justify-center gap-[2px]">
                            {waveformBars.map((multiplier, i) => (
                                <motion.div
                                    key={i}
                                    className="w-[3px] rounded-full bg-white"
                                    animate={{
                                        height: 6 + waveformLevel * multiplier * 30,
                                    }}
                                    transition={{ duration: 0.1, ease: 'easeOut' }}
                                />
                            ))}
                        </div>
                    )}
                    {(voiceStatus === 'listening' && !isRecording) && <MicOff className="w-6 h-6 animate-pulse" fill="currentColor" />}
                    {voiceStatus === 'thinking' && <Loader2 className="w-6 h-6 animate-spin" />}
                    {voiceStatus === 'speaking' && <StopCircle className="w-6 h-6" fill="currentColor" />}
                </motion.button>
            </motion.div>
        </div>
    );
}
