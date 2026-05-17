import React from 'react';
import { X } from 'lucide-react';
import ChatBox from '../ChatBox';
import InteractiveAIInput from '../InteractiveAIInput';
import type { NetworkQuality } from '../../lib/NetworkMonitor';
import type { PipelineStreamState } from '../../hooks/useAudioPipeline';

interface Message {
    id: string;
    text: string;
    sender: 'user' | 'ai';
    timestamp: Date;
}

interface AssistantDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    messages: Message[];
    voiceStatus: 'idle' | 'listening' | 'thinking' | 'speaking';
    onMicClick: () => void;
    onSubmitText: (text: string) => void;
    networkQuality?: NetworkQuality;
    streamState?: PipelineStreamState;
    bufferedChunks: number;
    waveformLevel: number;
    recordingDuration: number;
    isRecording: boolean;
    onReadAloud: (text: string, lang?: string) => void;
    currentUI: any;
    pageContextText?: string;
}

const AssistantDrawer: React.FC<AssistantDrawerProps> = ({
    isOpen, onClose, messages, voiceStatus, onMicClick, onSubmitText,
    networkQuality, streamState, bufferedChunks, waveformLevel,
    recordingDuration, isRecording, onReadAloud, currentUI, pageContextText
}) => {
    return (
        <>
            {/* Backdrop */}
            {isOpen && (
                <div 
                    className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[55] transition-opacity md:hidden"
                    onClick={onClose}
                />
            )}

            {/* Drawer */}
            <div className={`
                fixed top-0 bottom-0 right-0 z-[60] w-full md:w-[420px] bg-background-dark/95 backdrop-blur-xl border-l border-white/10
                transform transition-transform duration-300 ease-in-out flex flex-col shadow-2xl
                ${isOpen ? 'translate-x-0' : 'translate-x-full'}
            `}>
                <div className="flex items-center justify-between p-4 border-b border-white/10 bg-primary/20">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center relative">
                            <img src="/logo.png" alt="Horizon" className="w-8 h-8 object-cover rounded-full" />
                            {voiceStatus === 'listening' && <div className="absolute inset-0 rounded-full bg-accent animate-ping opacity-50" />}
                        </div>
                        <div>
                            <h3 className="font-semibold text-white">Horizon</h3>
                            <p className="text-xs text-secondary-light">Your Village Friend</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                        <X className="w-6 h-6 text-white/70" />
                    </button>
                </div>

                {pageContextText && (
                    <div className="px-4 py-2 bg-primary/40 border-b border-primary-light/30 text-xs text-white/80 flex items-center gap-2 shadow-inner">
                        <span className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
                        📄 Horizon is reading: {pageContextText}
                    </div>
                )}

                <div className="flex-1 overflow-y-auto px-4 pb-4 pt-4 custom-scrollbar">
                    {messages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-center opacity-60">
                            <h2 className="text-xl font-bold mb-2">Hello there!</h2>
                            <p className="text-sm text-gray-400">Tap the mic to talk with me.</p>
                            {voiceStatus === 'listening' && <p className="mt-4 text-blue-400 animate-pulse">{currentUI.listening}</p>}
                            {voiceStatus === 'thinking' && <p className="mt-4 text-purple-400 animate-pulse">{currentUI.thinking}</p>}
                            {voiceStatus === 'speaking' && <p className="mt-4 text-blue-400">{currentUI.speaking}</p>}
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <ChatBox messages={messages} onReadAloud={onReadAloud} />
                            {voiceStatus === 'thinking' && (
                                <div className="flex gap-4 animate-fade-in pl-2">
                                    <div className="w-6 h-6 rounded-full bg-purple-500/20 flex items-center justify-center border border-purple-500/30">
                                        <div className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-ping" />
                                    </div>
                                    <div className="bg-white/5 rounded-2xl rounded-tl-none p-3 border border-white/10 flex items-center">
                                        <span className="text-gray-300 text-xs">{currentUI.thinking}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                    <div id="drawer-scroll-anchor" className="h-4" />
                </div>

                <div className="border-t border-white/5 bg-background-dark">
                    <InteractiveAIInput
                        voiceStatus={voiceStatus}
                        onMicClick={onMicClick}
                        onSubmitText={onSubmitText}
                        networkQuality={networkQuality}
                        streamState={streamState}
                        bufferedChunks={bufferedChunks}
                        waveformLevel={waveformLevel}
                        recordingDuration={recordingDuration}
                        isRecording={isRecording}
                    />
                </div>
            </div>
        </>
    );
};

export default AssistantDrawer;
