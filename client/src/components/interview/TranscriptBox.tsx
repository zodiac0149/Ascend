import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface TranscriptBoxProps {
  transcript: string;
  isListening: boolean;
  isProcessing?: boolean;
  placeholder?: string;
}

export function TranscriptBox({
  transcript,
  isListening,
  isProcessing = false,
  placeholder = 'Your spoken answer will appear here in real time...',
}: TranscriptBoxProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
          <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
            Live Transcript
          </span>
        </div>

        {/* Status badges */}
        <AnimatePresence mode="wait">
          {isProcessing ? (
            <motion.div
              key="processing"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full
                         bg-brand-500/15 text-brand-400 border border-brand-500/30"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse" />
              Processing...
            </motion.div>
          ) : isListening ? (
            <motion.div
              key="listening"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="live-badge"
            >
              LISTENING
            </motion.div>
          ) : (
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-xs text-text-muted"
            >
              Waiting...
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Transcript text area */}
      <div
        className="flex-1 bg-surface-700/50 border border-surface-border rounded-xl p-4
                   overflow-y-auto text-sm leading-relaxed"
      >
        {transcript ? (
          <p className="text-text-primary whitespace-pre-wrap break-words">
            {transcript}
            {isListening && (
              <span className="inline-block w-0.5 h-4 bg-brand-400 ml-0.5 animate-blink" />
            )}
          </p>
        ) : (
          <p className="text-text-muted italic">{placeholder}</p>
        )}
      </div>

      {/* Microphone waveform indicator */}
      {isListening && (
        <div className="mt-3 flex items-center justify-center gap-0.5">
          {Array.from({ length: 20 }).map((_, i) => (
            <motion.div
              key={i}
              className="w-0.5 bg-brand-500 rounded-full"
              animate={{
                height: [4, Math.random() * 20 + 4, 4],
              }}
              transition={{
                duration: 0.4 + Math.random() * 0.4,
                repeat: Infinity,
                delay: i * 0.05,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
