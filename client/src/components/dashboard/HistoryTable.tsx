import React from 'react';
import { motion } from 'framer-motion';
import { formatDate, scoreToGrade, scoreToColorClass, truncate } from '@/utils/formatters';
import type { AssessmentHistoryItem } from '@/types/assessment';
import type { InterviewHistoryItem } from '@/types/interview';

type HistoryItem = AssessmentHistoryItem | InterviewHistoryItem;

interface HistoryTableProps {
  items: HistoryItem[];
  type: 'assessment' | 'interview';
  isLoading?: boolean;
  onViewDetails?: (id: string) => void;
}

function isInterviewItem(item: HistoryItem): item is InterviewHistoryItem {
  return 'overall_score' in item;
}

export function HistoryTable({ items, type, isLoading = false, onViewDetails }: HistoryTableProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="skeleton h-16 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="w-16 h-16 rounded-full bg-surface-700 flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </div>
        <p className="text-text-secondary font-medium">No {type} history yet</p>
        <p className="text-text-muted text-sm mt-1">
          Complete your first {type} to see results here
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {items.map((item, i) => {
        const score = isInterviewItem(item)
          ? item.overall_score
          : (item as AssessmentHistoryItem).raw_score;
        const grade = scoreToGrade(score ?? 0);
        const colorClass = scoreToColorClass(score ?? 0);

        return (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="glass-card-hover p-4 flex items-center gap-4"
          >
            {/* Score badge */}
            <div className={`text-2xl font-black font-mono ${colorClass} min-w-[3rem] text-center`}>
              {score != null ? `${Math.round(score)}` : '--'}
              <span className="text-xs font-semibold text-text-muted block">%</span>
            </div>

            {/* Divider */}
            <div className="w-px h-10 bg-surface-border" />

            {/* Details */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text-primary truncate">
                {truncate(item.job_description, 60)}
              </p>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-xs text-text-muted capitalize">
                  {item.judge_type} {isInterviewItem(item) ? 'Interview' : 'Assessment'}
                </span>
                <span className="text-text-muted text-xs">·</span>
                <span className="text-xs text-text-muted">{formatDate(item.created_at)}</span>
                {!isInterviewItem(item) && (
                  <>
                    <span className="text-text-muted text-xs">·</span>
                    <span className="text-xs text-text-muted">
                      {(item as AssessmentHistoryItem).correct_answers}/
                      {(item as AssessmentHistoryItem).total_questions} correct
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Grade + Action */}
            <div className="flex items-center gap-3 shrink-0">
              <span className={`text-lg font-bold ${colorClass}`}>{grade}</span>
              {onViewDetails && (
                <button
                  onClick={() => onViewDetails(item.id)}
                  className="btn-secondary text-xs px-3 py-1.5"
                >
                  View
                </button>
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
