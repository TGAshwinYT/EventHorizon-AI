/**
 * PushToTalkButton — EventHorizon AI
 *
 * A premium push-to-talk button with:
 * - Touch-and-hold for mobile, click-to-toggle for desktop
 * - Real-time waveform visualization
 * - Network quality indicator badge
 * - Buffered chunks indicator
 * - 30-second duration countdown
 * - Recording state animations with glassmorphism
 */

import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Wifi, WifiOff, Signal } from 'lucide-react';
import type { NetworkQuality } from '../lib/NetworkMonitor';
import type { PipelineStreamState } from '../hooks/useAudioPipeline';

interface PushToTalkButtonProps {
  isRecording: boolean;
  waveformLevel: number;
  networkQuality: NetworkQuality;
  streamState: PipelineStreamState;
  bufferedChunks: number;
  recordingDuration: number;
  onStart: () => void;
  onStop: () => void;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const MAX_DURATION = 30;

export default function PushToTalkButton({
  isRecording,
  waveformLevel,
  networkQuality,
  streamState,
  bufferedChunks,
  recordingDuration,
  onStart,
  onStop,
  disabled = false,
  size = 'lg',
}: PushToTalkButtonProps) {
  const sizeMap = {
    sm: { container: 48, icon: 20, ring: 56, badge: 14 },
    md: { container: 64, icon: 28, ring: 76, badge: 18 },
    lg: { container: 80, icon: 36, ring: 96, badge: 22 },
  };
  const s = sizeMap[size];
  const remainingSeconds = MAX_DURATION - recordingDuration;

  // Determine button color scheme
  const getColorScheme = () => {
    if (disabled) return { bg: 'rgba(100,100,120,0.3)', glow: 'transparent', ring: 'rgba(100,100,120,0.2)' };
    if (isRecording) {
      if (streamState === 'buffering') return { bg: 'rgba(245,158,11,0.8)', glow: 'rgba(245,158,11,0.4)', ring: 'rgba(245,158,11,0.3)' };
      return { bg: 'rgba(239,68,68,0.85)', glow: 'rgba(239,68,68,0.4)', ring: 'rgba(239,68,68,0.3)' };
    }
    return { bg: 'rgba(59,130,246,0.6)', glow: 'rgba(59,130,246,0.2)', ring: 'rgba(59,130,246,0.15)' };
  };

  const colors = getColorScheme();

  // Network quality badge
  const getNetworkBadge = () => {
    switch (networkQuality) {
      case 'offline':
        return { color: '#ef4444', label: '⚠', icon: WifiOff };
      case '2g':
        return { color: '#f59e0b', label: '2G', icon: Signal };
      case '3g':
        return { color: '#22c55e', label: '3G', icon: Signal };
      case 'good':
        return { color: '#10b981', label: '✓', icon: Wifi };
    }
  };

  const badge = getNetworkBadge();

  // Waveform bars data (5 bars that respond to audio level)
  const bars = [0.6, 1.0, 0.8, 1.0, 0.6];

  const handleClick = () => {
    if (disabled) return;
    if (isRecording) {
      onStop();
    } else {
      onStart();
    }
  };

  // Touch-and-hold handlers for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    if (disabled || isRecording) return;
    e.preventDefault();
    onStart();
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!isRecording) return;
    e.preventDefault();
    onStop();
  };

  return (
    <div className="relative flex items-center justify-center" style={{ width: s.ring + 20, height: s.ring + 20 }}>
      {/* Outer animated ring — recording progress */}
      {isRecording && (
        <svg
          className="absolute"
          width={s.ring + 16}
          height={s.ring + 16}
          style={{ transform: 'rotate(-90deg)' }}
        >
          {/* Background ring */}
          <circle
            cx={(s.ring + 16) / 2}
            cy={(s.ring + 16) / 2}
            r={(s.ring + 4) / 2}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={3}
          />
          {/* Progress ring (countdown) */}
          <motion.circle
            cx={(s.ring + 16) / 2}
            cy={(s.ring + 16) / 2}
            r={(s.ring + 4) / 2}
            fill="none"
            stroke={streamState === 'buffering' ? '#f59e0b' : '#ef4444'}
            strokeWidth={3}
            strokeLinecap="round"
            strokeDasharray={Math.PI * (s.ring + 4)}
            animate={{
              strokeDashoffset: Math.PI * (s.ring + 4) * (1 - recordingDuration / MAX_DURATION),
            }}
            transition={{ duration: 0.3 }}
            style={{ filter: 'drop-shadow(0 0 4px rgba(239,68,68,0.5))' }}
          />
        </svg>
      )}

      {/* Pulse rings when recording */}
      <AnimatePresence>
        {isRecording && (
          <>
            <motion.div
              className="absolute rounded-full"
              style={{
                width: s.container + 20,
                height: s.container + 20,
                border: `1px solid ${colors.ring}`,
              }}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{
                scale: [1, 1.3 + waveformLevel * 2],
                opacity: [0.6, 0],
              }}
              transition={{ repeat: Infinity, duration: 1.5, ease: 'easeOut' }}
            />
            <motion.div
              className="absolute rounded-full"
              style={{
                width: s.container + 12,
                height: s.container + 12,
                border: `1px solid ${colors.ring}`,
              }}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{
                scale: [1, 1.2 + waveformLevel * 1.5],
                opacity: [0.4, 0],
              }}
              transition={{ repeat: Infinity, duration: 1.5, ease: 'easeOut', delay: 0.3 }}
            />
          </>
        )}
      </AnimatePresence>

      {/* Glow effect */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: s.container + 8,
          height: s.container + 8,
          background: colors.glow,
          filter: 'blur(20px)',
        }}
        animate={{
          scale: isRecording ? [1, 1.2 + waveformLevel * 3, 1] : 1,
          opacity: isRecording ? 0.8 : 0.3,
        }}
        transition={{
          repeat: isRecording ? Infinity : 0,
          duration: 0.5,
          ease: 'easeInOut',
        }}
      />

      {/* Main button */}
      <motion.button
        onClick={handleClick}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        disabled={disabled}
        className="relative z-10 rounded-full flex items-center justify-center border transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400/50"
        style={{
          width: s.container,
          height: s.container,
          background: colors.bg,
          borderColor: isRecording ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          boxShadow: isRecording
            ? `0 0 30px ${colors.glow}, inset 0 1px 0 rgba(255,255,255,0.1)`
            : '0 4px 20px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1)',
        }}
        whileTap={{ scale: 0.92 }}
        whileHover={{ scale: disabled ? 1 : 1.05 }}
      >
        {/* Waveform bars (visible when recording) */}
        <AnimatePresence mode="wait">
          {isRecording ? (
            <motion.div
              key="waveform"
              className="flex items-center justify-center gap-[3px]"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              transition={{ duration: 0.2 }}
            >
              {bars.map((multiplier, i) => (
                <motion.div
                  key={i}
                  className="rounded-full bg-white"
                  style={{ width: size === 'sm' ? 2 : 3 }}
                  animate={{
                    height: 8 + waveformLevel * multiplier * (s.icon * 1.5),
                  }}
                  transition={{ duration: 0.1, ease: 'easeOut' }}
                />
              ))}
            </motion.div>
          ) : (
            <motion.div
              key="mic"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              transition={{ duration: 0.2 }}
            >
              {disabled ? (
                <MicOff
                  style={{ width: s.icon, height: s.icon }}
                  className="text-white/40"
                />
              ) : (
                <Mic
                  style={{ width: s.icon, height: s.icon }}
                  className="text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.6)]"
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>

      {/* Network quality badge */}
      <motion.div
        className="absolute flex items-center justify-center rounded-full border text-[10px] font-bold"
        style={{
          width: s.badge,
          height: s.badge,
          top: 0,
          right: 2,
          backgroundColor: badge.color,
          borderColor: 'rgba(0,0,0,0.3)',
          fontSize: size === 'sm' ? 7 : 9,
          color: '#fff',
          boxShadow: `0 0 6px ${badge.color}`,
        }}
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 400, damping: 20 }}
      >
        {badge.label}
      </motion.div>

      {/* Buffered chunks indicator */}
      <AnimatePresence>
        {bufferedChunks > 0 && (
          <motion.div
            className="absolute flex items-center justify-center rounded-full bg-amber-500 text-white text-[9px] font-bold border border-amber-600"
            style={{
              width: s.badge,
              height: s.badge,
              bottom: 0,
              right: 2,
              boxShadow: '0 0 8px rgba(245,158,11,0.5)',
            }}
            initial={{ scale: 0 }}
            animate={{ scale: [1, 1.2, 1] }}
            exit={{ scale: 0 }}
            transition={{ duration: 0.3 }}
          >
            {bufferedChunks}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Duration countdown (when recording) */}
      <AnimatePresence>
        {isRecording && (
          <motion.div
            className="absolute -bottom-7 text-xs font-mono tabular-nums"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            style={{
              color: remainingSeconds <= 5 ? '#ef4444' : 'rgba(255,255,255,0.5)',
            }}
          >
            {remainingSeconds}s
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
