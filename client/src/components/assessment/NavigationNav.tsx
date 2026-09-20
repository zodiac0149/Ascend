import React from 'react';
import { Button } from '@/components/ui/Button';

interface NavigationNavProps {
  currentIndex: number;
  totalQuestions: number;
  hasAnsweredCurrent: boolean;
  hasReachedEnd: boolean;
  isSubmitting: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onSubmit: () => void;
}

export function NavigationNav({
  currentIndex,
  totalQuestions,
  hasAnsweredCurrent,
  hasReachedEnd,
  isSubmitting,
  onPrevious,
  onNext,
  onSubmit,
}: NavigationNavProps) {
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === totalQuestions - 1;

  return (
    <div className="flex items-center justify-between pt-6 border-t border-surface-border">
      {/* Previous button */}
      <Button
        variant="secondary"
        onClick={onPrevious}
        disabled={isFirst}
        leftIcon={
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        }
      >
        Previous
      </Button>

      {/* Question dots indicator */}
      <div className="hidden sm:flex items-center gap-1.5">
        {Array.from({ length: totalQuestions }).map((_, i) => (
          <div
            key={i}
            className={`rounded-full transition-all duration-200 ${
              i === currentIndex
                ? 'w-6 h-2 bg-brand-500'
                : i < currentIndex
                ? 'w-2 h-2 bg-brand-500/40'
                : 'w-2 h-2 bg-surface-500'
            }`}
          />
        ))}
      </div>

      {/* Right action: Next or Submit */}
      {isLast ? (
        <Button
          variant="primary"
          onClick={onSubmit}
          loading={isSubmitting}
          disabled={!hasReachedEnd}
          title={!hasReachedEnd ? 'Navigate to the last question to unlock submit' : undefined}
          rightIcon={
            !isSubmitting ? (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : undefined
          }
        >
          Submit Test
        </Button>
      ) : (
        <Button
          variant="primary"
          onClick={onNext}
          rightIcon={
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          }
        >
          Next
        </Button>
      )}
    </div>
  );
}
