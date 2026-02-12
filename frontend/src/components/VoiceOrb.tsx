import { motion } from 'framer-motion';

interface VoiceOrbProps {
    status: 'idle' | 'listening' | 'thinking' | 'speaking';
    size?: 'sm' | 'md'; // 'md' is default (large)
}

const VoiceOrb = ({ status, size = 'md' }: VoiceOrbProps) => {
    const isSmall = size === 'sm';

    // Dimensions based on size
    const containerClass = isSmall ? 'w-8 h-8' : 'w-32 h-32';
    const coreClass = isSmall ? 'w-6 h-6' : 'w-20 h-20';
    const iconClass = isSmall ? 'w-3 h-3' : 'w-8 h-8';
    const blurClass = isSmall ? 'blur-[10px]' : 'blur-[40px]';

    return (
        <div className={`relative flex items-center justify-center ${containerClass}`}>
            {/* Ambient Glow */}
            <motion.div
                animate={{
                    scale: status === 'listening' ? [1, 1.2, 1] : status === 'thinking' ? [1, 1.1, 1] : 1,
                    opacity: status === 'listening' || status === 'thinking' ? 0.8 : 0.5,
                }}
                transition={{ repeat: Infinity, duration: status === 'thinking' ? 1 : 2, ease: "easeInOut" }}
                className={`absolute w-full h-full rounded-full ${blurClass} opacity-50 ${status === 'thinking' ? 'bg-purple-500' : 'bg-blue-500'}`}
            />

            {/* Core Waveforms - Animated when listening */}
            {status === 'listening' && (
                <div className="absolute flex items-center justify-center gap-0.5">
                    {[...Array(5)].map((_, i) => (
                        <motion.div
                            key={i}
                            animate={{ height: isSmall ? [5, 12, 5] : [20, 50, 20] }}
                            transition={{
                                repeat: Infinity,
                                duration: 1,
                                ease: "easeInOut",
                                delay: i * 0.1
                            }}
                            className={`${isSmall ? 'w-0.5' : 'w-1'} bg-white rounded-full bg-opacity-80 shadow-[0_0_10px_rgba(255,255,255,0.8)]`}
                        />
                    ))}
                </div>
            )}

            {/* Central Microphone Icon / Circle */}
            <div className={`relative z-10 ${coreClass} rounded-full glass-button flex items-center justify-center shadow-[0_0_30px_rgba(59,130,246,0.3)] border ${status === 'thinking' ? 'border-purple-400/30' : 'border-blue-400/30'}`}>
                <svg
                    viewBox="0 0 24 24"
                    className={`${iconClass} text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]`}
                    fill="currentColor"
                >
                    <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                    <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                </svg>
            </div>

            {/* Speaking Ring */}
            {status === 'speaking' && (
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                    className={`absolute ${isSmall ? 'w-7 h-7' : 'w-24 h-24'} rounded-full border-2 border-t-white border-r-transparent border-b-transparent border-l-transparent opacity-70`}
                />
            )}
        </div>
    );
};

export default VoiceOrb;
