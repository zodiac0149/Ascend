import React, { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { motion } from 'framer-motion';
import { ScoreCard } from '@/components/dashboard/ScoreCard';
import { Button } from '@/components/ui/Button';
import { scoreToGrade, formatPercent } from '@/utils/formatters';
import type { InterviewFeedback } from '@/types/interview';
import type { AssessmentResult } from '@/types/assessment';
import type { JudgeType } from '@/types/interview';

type ResultData = InterviewFeedback | AssessmentResult;

function isInterviewFeedback(data: ResultData): data is InterviewFeedback {
  return 'contentScore' in data;
}

export default function ResultsPage() {
  const router = useRouter();
  const [result, setResult] = useState<ResultData | null>(null);
  const [judgeType, setJudgeType] = useState<JudgeType>('technical');

  useEffect(() => {
    const raw = sessionStorage.getItem('ascend_result');
    const jt = sessionStorage.getItem('ascend_judge_type') as JudgeType | null;
    if (!raw) { router.push('/dashboard'); return; }
    try {
      setResult(JSON.parse(raw) as ResultData);
      if (jt) setJudgeType(jt);
    } catch {
      router.push('/dashboard');
    }
  }, [router]);

  if (!result) {
    return (
      <div className="page-container flex items-center justify-center min-h-screen">
        <div className="w-12 h-12 rounded-full border-2 border-brand-500/30 border-t-brand-500 animate-spin" />
      </div>
    );
  }

  const isInterview = isInterviewFeedback(result);

  // Normalise score fields
  const overallScore = isInterview
    ? result.overallScore
    : (result as AssessmentResult).rawScore;
  const grade = result.grade ?? scoreToGrade(overallScore);

  const strengths = isInterview
    ? result.strengths
    : [];

  const improvements = isInterview
    ? result.areasOfImprovement
    : (result as AssessmentResult).areasOfImprovement;

  const feedback = isInterview
    ? result.detailedFeedback
    : (result as AssessmentResult).llmFeedback;

  return (
    <>
      <Head>
        <title>Your Results — Ascend</title>
        <meta name="description" content="View your AI interview or assessment results and personalised feedback." />
      </Head>

      <div className="page-container px-6 py-10 md:px-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-10 max-w-5xl mx-auto">
          <Link href="/dashboard" className="flex items-center gap-2 text-text-muted hover:text-text-primary transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="text-sm font-medium">Dashboard</span>
          </Link>
          <span className="text-lg font-black gradient-text">Ascend</span>
        </div>

        <div className="max-w-5xl mx-auto">
          {/* Hero result */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-12"
          >
            <p className="section-label mb-3">
              {isInterview ? `${judgeType} interview` : `${judgeType} assessment`} · Results
            </p>
            <h1 className="text-4xl md:text-5xl font-black text-text-primary mb-2">
              Here&apos;s how you did 🎯
            </h1>
            <p className="text-text-secondary">
              Comprehensive AI analysis of your performance
            </p>
          </motion.div>

          {/* Score cards */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="flex flex-wrap justify-center gap-6 mb-12"
          >
            {/* Overall score */}
            <ScoreCard
              score={overallScore}
              grade={grade}
              label="Overall Score"
              size="lg"
            />

            {isInterview && (
              <>
                <ScoreCard
                  score={(result as InterviewFeedback).contentScore}
                  grade={scoreToGrade((result as InterviewFeedback).contentScore)}
                  label="Content & Accuracy"
                  subtitle="Answer quality"
                  size="md"
                />
                <ScoreCard
                  score={(result as InterviewFeedback).demeanorScore}
                  grade={scoreToGrade((result as InterviewFeedback).demeanorScore)}
                  label="Demeanor & Delivery"
                  subtitle="Eye contact & posture"
                  size="md"
                />
              </>
            )}

            {!isInterview && (
              <ScoreCard
                score={Math.round(((result as AssessmentResult).correctAnswers / (result as AssessmentResult).totalQuestions) * 100)}
                grade={grade}
                label="Accuracy"
                subtitle={`${(result as AssessmentResult).correctAnswers} / ${(result as AssessmentResult).totalQuestions} correct`}
                size="md"
              />
            )}
          </motion.div>

          {/* Behavioral metrics (interview only) */}
          {isInterview && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="glass-card p-6 mb-8"
            >
              <h2 className="text-lg font-bold text-text-primary mb-4">
                Behavioral & Demeanor Metrics
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="bg-surface-700/50 rounded-xl p-4 text-center">
                  <div className={`text-3xl font-black mb-1 ${
                    result.eyeContactPercent >= 70 ? 'text-emerald-400' :
                    result.eyeContactPercent >= 50 ? 'text-amber-400' : 'text-red-400'
                  }`}>
                    {formatPercent(result.eyeContactPercent, 0)}
                  </div>
                  <p className="text-xs text-text-muted font-medium">Eye Contact</p>
                </div>
                <div className="bg-surface-700/50 rounded-xl p-4 text-center">
                  <div className={`text-3xl font-black mb-1 ${
                    result.postureAlerts === 0 ? 'text-emerald-400' :
                    result.postureAlerts <= 2 ? 'text-amber-400' : 'text-red-400'
                  }`}>
                    {result.postureAlerts}
                  </div>
                  <p className="text-xs text-text-muted font-medium">Posture Alerts</p>
                </div>
                <div className="bg-surface-700/50 rounded-xl p-4 text-center">
                  <div className="text-3xl font-black mb-1 text-brand-400">
                    {result.eyeContactPercent >= 80 ? '🟢' : result.eyeContactPercent >= 60 ? '🟡' : '🔴'}
                  </div>
                  <p className="text-xs text-text-muted font-medium">Presence Rating</p>
                </div>
              </div>
            </motion.div>
          )}

          <div className="grid md:grid-cols-2 gap-8 mb-8">
            {/* Strengths */}
            {strengths.length > 0 && (
              <motion.div
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                className="glass-card p-6"
              >
                <h2 className="flex items-center gap-2 text-lg font-bold text-text-primary mb-4">
                  <span className="text-emerald-400">✓</span> Strengths
                </h2>
                <ul className="flex flex-col gap-3">
                  {strengths.map((s, i) => (
                    <motion.li
                      key={i}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.25 + i * 0.05 }}
                      className="flex items-start gap-3 text-sm text-text-secondary"
                    >
                      <span className="w-5 h-5 rounded-full bg-emerald-500/15 text-emerald-400 flex items-center justify-center text-xs shrink-0 mt-0.5">
                        ✓
                      </span>
                      {s}
                    </motion.li>
                  ))}
                </ul>
              </motion.div>
            )}

            {/* Areas of Improvement */}
            {improvements.length > 0 && (
              <motion.div
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                className="glass-card p-6"
              >
                <h2 className="flex items-center gap-2 text-lg font-bold text-text-primary mb-4">
                  <span className="text-amber-400">↑</span> Areas of Improvement
                </h2>
                <ul className="flex flex-col gap-3">
                  {improvements.map((area, i) => (
                    <motion.li
                      key={i}
                      initial={{ opacity: 0, x: 8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.25 + i * 0.05 }}
                      className="flex items-start gap-3 text-sm text-text-secondary"
                    >
                      <span className="w-5 h-5 rounded-full bg-amber-500/15 text-amber-400 flex items-center justify-center text-xs shrink-0 mt-0.5">
                        !
                      </span>
                      {area}
                    </motion.li>
                  ))}
                </ul>
              </motion.div>
            )}
          </div>

          {/* Detailed feedback */}
          {feedback && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="glass-card p-6 mb-10"
            >
              <h2 className="text-lg font-bold text-text-primary mb-3">
                AI Feedback Summary
              </h2>
              <p className="text-text-secondary text-sm leading-relaxed">{feedback}</p>
            </motion.div>
          )}

          {/* MCQ per-question breakdown (assessments only) */}
          {!isInterview && (result as AssessmentResult).perQuestionFeedback && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="glass-card p-6 mb-10"
            >
              <h2 className="text-lg font-bold text-text-primary mb-4">Question Breakdown</h2>
              <div className="flex flex-col gap-4">
                {(result as AssessmentResult).perQuestionFeedback.map((qf, i) => {
                  const LABELS = ['A', 'B', 'C', 'D'];
                  const selectedLabel = qf.selectedIndex >= 0 && qf.selectedIndex < LABELS.length
                    ? LABELS[qf.selectedIndex]
                    : '—';
                  const correctLabel = qf.correctIndex >= 0 && qf.correctIndex < LABELS.length
                    ? LABELS[qf.correctIndex]
                    : '—';
                  const selectedText = qf.options?.[qf.selectedIndex] ?? '';
                  const correctText = qf.options?.[qf.correctIndex] ?? '';

                  return (
                    <div
                      key={qf.questionId}
                      className={`p-4 rounded-xl border ${
                        qf.isCorrect
                          ? 'bg-emerald-500/5 border-emerald-500/20'
                          : 'bg-red-500/5 border-red-500/20'
                      }`}
                    >
                      <div className="flex items-start gap-3 mb-2">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${
                          qf.isCorrect ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                        }`}>
                          {qf.isCorrect ? '✓' : '✗'}
                        </span>
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-text-primary mb-1">
                            Q{i + 1}{qf.category ? ` · ${qf.category}` : ''}
                          </p>
                          {qf.questionText && (
                            <p className="text-sm text-text-secondary leading-relaxed">
                              {qf.questionText}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Answer details */}
                      <div className="ml-9 mt-2 flex flex-col gap-1.5">
                        <div className={`text-xs font-medium ${qf.isCorrect ? 'text-emerald-400' : 'text-red-400'}`}>
                          Your answer: <span className="font-bold">{selectedLabel}</span>
                          {selectedText && ` — ${selectedText}`}
                        </div>
                        {!qf.isCorrect && (
                          <div className="text-xs font-medium text-emerald-400">
                            Correct answer: <span className="font-bold">{correctLabel}</span>
                            {correctText && ` — ${correctText}`}
                          </div>
                        )}
                        {qf.explanation && (
                          <p className="text-xs text-text-muted mt-1 leading-relaxed">
                            💡 {qf.explanation}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Link href="/interview">
              <Button variant="primary" size="lg">
                Try Another Interview
              </Button>
            </Link>
            <Link href="/assessment">
              <Button variant="secondary" size="lg">
                Take Assessment
              </Button>
            </Link>
            <Link href="/dashboard">
              <Button variant="ghost">
                View Dashboard
              </Button>
            </Link>
          </motion.div>
        </div>
      </div>
    </>
  );
}
