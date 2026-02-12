import React, { useEffect, useRef, useState } from 'react';
import { Volume2, ChevronDown, ChevronUp, User, Bot } from 'lucide-react';

interface Message {
    id: string;
    text: string;
    sender: 'user' | 'ai';
    timestamp: Date;
}

interface ChatBoxProps {
    messages: Message[];
    onReadAloud: (text: string) => void;
}

const MessageItem = ({ msg, onReadAloud }: { msg: Message, onReadAloud: (text: string) => void }) => {
    const [showDetails, setShowDetails] = useState(false);
    const [summary, details] = msg.text.split('|||').map(s => s.trim());
    const hasDetails = !!details;

    const isUser = msg.sender === 'user';

    return (
        <div className={`flex w-full mb-6 ${isUser ? 'justify-end' : 'justify-start'}`}>
            <div className={`flex max-w-[85%] md:max-w-[75%] gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>

                {/* Avatar */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1 ${isUser ? 'bg-blue-600' : 'bg-purple-600'
                    }`}>
                    {isUser ? <User className="w-5 h-5 text-white" /> : <Bot className="w-5 h-5 text-white" />}
                </div>

                {/* Bubble */}
                <div className={`relative px-5 py-4 rounded-2xl text-base leading-relaxed shadow-lg backdrop-blur-md border ${isUser
                    ? 'bg-blue-600/20 border-blue-500/30 text-blue-50 rounded-tr-none'
                    : 'bg-white/10 border-white/10 text-gray-100 rounded-tl-none'
                    }`}>
                    <div className="whitespace-pre-line">
                        {summary}
                    </div>

                    {hasDetails && (
                        <div className="mt-3">
                            {showDetails && (
                                <div className="mt-3 pt-3 border-t border-white/10 text-sm opacity-90 animate-fade-in whitespace-pre-line bg-black/10 p-3 rounded-lg">
                                    {details}
                                </div>
                            )}
                            <button
                                onClick={() => {
                                    if (!showDetails) {
                                        onReadAloud(details);
                                    }
                                    setShowDetails(!showDetails);
                                }}
                                className="mt-2 text-xs font-bold uppercase tracking-wider text-purple-300 hover:text-purple-200 flex items-center gap-1 transition-colors"
                            >
                                {showDetails ? (
                                    <><ChevronUp className="w-3 h-3" /> Less Options</>
                                ) : (
                                    <><ChevronDown className="w-3 h-3" /> More Details</>
                                )}
                            </button>
                        </div>
                    )}

                    {!isUser && (
                        <div className="mt-3 pt-2 flex items-center gap-2 border-t border-white/5">
                            <button
                                onClick={() => onReadAloud(msg.text.replace('|||', ' '))}
                                className="p-1.5 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-all"
                                title="Read Aloud"
                            >
                                <Volume2 className="w-4 h-4" />
                            </button>
                        </div>
                    )}

                    <span className="text-[10px] opacity-40 absolute bottom-1 right-3">
                        {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                </div>
            </div>
        </div>
    );
};

const ChatBox: React.FC<ChatBoxProps> = ({ messages, onReadAloud }) => {
    const endOfMessagesRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    return (
        <div className="w-full flex-col space-y-2">
            {messages.length === 0 && (
                <div className="text-center text-gray-500 py-10 opacity-50">
                    start a conversation...
                </div>
            )}

            {messages.map((msg) => (
                <MessageItem key={msg.id} msg={msg} onReadAloud={onReadAloud} />
            ))}

            <div ref={endOfMessagesRef} />
        </div>
    );
};

export default ChatBox;
