import React from 'react';
import { motion } from 'framer-motion';
import { scoreToColorClass, scoreToStrokeColor } from '@/utils/formatters';

interface ScoreCardProps {
  score: number;
  grade: string;
  label: string;
  subtitle?: string;
  size?: 'sm' | 'md' | 'lg';
}

const sizes = {
  sm: { ring: 64, stroke: 6, textScore: 'text-xl', textGrade: 'text-xs' },
  md: { ring: 88, stroke: 7, textScore: 'text-3xl', textGrade: 'text-sm' },
  lg: { ring: 120, stroke: 8, textScore: 'text-5xl', textGrade: 'text-base' },
};

export function ScoreCard({ score, grade, label, subtitle, size = 'md' }: ScoreCardProps) {
  const cfg = sizes[size];
  const radius = (cfg.ring - cfg.stroke * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDash = circumference - (score / 100) * circumference;
  const color = scoreToColorClass(score);
  const strokeColor = scoreToStrokeColor(score);

  return (
    <div className="glass-card p-6 flex flex-col items-center gap-4">
      {/* Circular progress ring */}
      <div className="score-ring" style={{ width: cfg.ring, height: cfg.ring }}>
        <svg width={cfg.ring} height={cfg.ring} className="-rotate-90">
          {/* Background ring */}
          <circle
            cx={cfg.ring / 2}
            cy={cfg.ring / 2}
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={cfg.stroke}
          />
          {/* Score ring */}
          <motion.circle
            cx={cfg.ring / 2}
            cy={cfg.ring / 2}
            r={radius}
            fill="none"
            stroke={strokeColor}
            strokeWidth={cfg.stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: strokeDash }}
            transition={{ duration: 1.2, ease: 'easeOut', delay: 0.2 }}
            style={{ filter: `drop-shadow(0 0 8px ${strokeColor}60)` }}
          />
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span
            className={`font-black ${cfg.textScore} ${color}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            {Math.round(score)}
          </motion.span>
          <span className={`${cfg.textGrade} font-bold ${color}`}>{grade}</span>
        </div>
      </div>

      {/* Label */}
      <div className="text-center">
        <p className="text-sm font-semibold text-text-primary">{label}</p>
        {subtitle && <p className="text-xs text-text-muted mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}
