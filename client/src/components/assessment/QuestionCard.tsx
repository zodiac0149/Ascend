import React from 'react';
import { motion } from 'framer-motion';
import type { MCQQuestion } from '@/types/assessment';

interface QuestionCardProps {
  question: MCQQuestion;
  questionNumber: number;
  totalQuestions: number;
  selectedAnswer: number | undefined;
  onSelectAnswer: (optionIndex: number) => void;
}

const OPTION_LABELS = ['A', 'B', 'C', 'D'];

export function QuestionCard({
  question,
  questionNumber,
  totalQuestions,
  selectedAnswer,
  onSelectAnswer,
}: QuestionCardProps) {
  return (
    <motion.div
      key={question.id}
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
      className="w-full max-w-3xl mx-auto"
    >
      {/* Question header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          {question.category && (
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-brand-500/10 text-brand-400 border border-brand-500/20">
              {question.category}
            </span>
          )}
        </div>
        <span className="text-sm font-medium text-text-muted">
          Question{' '}
          <span className="text-text-primary font-bold">{questionNumber}</span>
          {' '}of{' '}
          <span className="text-text-primary font-bold">{totalQuestions}</span>
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full h-1.5 bg-surface-600 rounded-full mb-8 overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-brand-500 to-accent-500 rounded-full"
          initial={{ width: `${((questionNumber - 1) / totalQuestions) * 100}%` }}
          animate={{ width: `${(questionNumber / totalQuestions) * 100}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>

      {/* Question text */}
      <div className="glass-card p-6 mb-6">
        <p className="text-lg font-semibold text-text-primary leading-relaxed">
          {question.question}
        </p>
      </div>

      {/* Options */}
      <div className="flex flex-col gap-3">
        {question.options.map((option, index) => {
          const isSelected = selectedAnswer === index;
          return (
            <motion.button
              key={index}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => onSelectAnswer(index)}
              className={`
                w-full flex items-center gap-4 p-4 rounded-xl border text-left
                transition-all duration-200 cursor-pointer
                ${
                  isSelected
                    ? 'bg-brand-500/15 border-brand-500/60 shadow-glow-cyan'
                    : 'bg-surface-700/50 border-surface-border hover:border-surface-500 hover:bg-surface-700'
                }
              `}
            >
              {/* Option label */}
              <span
                className={`
                  flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center
                  text-sm font-bold transition-colors
                  ${
                    isSelected
                      ? 'bg-brand-500 text-white'
                      : 'bg-surface-600 text-text-secondary'
                  }
                `}
              >
                {OPTION_LABELS[index]}
              </span>
              <span
                className={`text-sm font-medium ${
                  isSelected ? 'text-text-primary' : 'text-text-secondary'
                }`}
              >
                {option}
              </span>
              {isSelected && (
                <span className="ml-auto text-brand-400">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd" />
                  </svg>
                </span>
              )}
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
}
