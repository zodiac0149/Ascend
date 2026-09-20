import React, { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { PostureAlert } from '@/types/interview';

interface PostureAlertProps {
  alerts: PostureAlert[];
  onDismiss: (id: string) => void;
}

const alertConfig: Record<
  PostureAlert['type'],
  { icon: string; color: string; bg: string; border: string }
> = {
  eye_contact: {
    icon: '👁️',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/40',
  },
  posture: {
    icon: '🪑',
    color: 'text-orange-400',
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/40',
  },
  out_of_frame: {
    icon: '📷',
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/40',
  },
};

export function PostureAlertOverlay({ alerts, onDismiss }: PostureAlertProps) {
  // Auto-dismiss alerts after 5 seconds
  useEffect(() => {
    const timers: NodeJS.Timeout[] = alerts.map((alert) =>
      setTimeout(() => onDismiss(alert.id), 5000)
    );
    return () => timers.forEach(clearTimeout);
  }, [alerts, onDismiss]);

  return (
    <div className="absolute top-4 left-4 right-4 z-30 flex flex-col gap-2 pointer-events-none">
      <AnimatePresence>
        {alerts.map((alert) => {
          const cfg = alertConfig[alert.type];
          return (
            <motion.div
              key={alert.id}
              initial={{ opacity: 0, y: -8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.95 }}
              transition={{ type: 'spring', duration: 0.3 }}
              className={`
                flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium
                backdrop-blur-md border ${cfg.bg} ${cfg.border} ${cfg.color}
                pointer-events-auto shadow-glass
              `}
            >
              <span className="text-base">{cfg.icon}</span>
              <span className="flex-1">{alert.message}</span>
              <button
                onClick={() => onDismiss(alert.id)}
                className="text-current/60 hover:text-current transition-colors"
                aria-label="Dismiss"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
