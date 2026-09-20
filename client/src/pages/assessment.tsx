import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { QuestionCard } from '@/components/assessment/QuestionCard';
import { NavigationNav } from '@/components/assessment/NavigationNav';
import { TextArea } from '@/components/ui/TextArea';
import { Button } from '@/components/ui/Button';
import { generateAssessment, submitAssessment } from '@/services/resumeService';
import { analyzeResume } from '@/services/interviewService';
import type { MCQQuestion, AssessmentResult, JudgeType } from '@/types/assessment';

type Phase = 'setup' | 'test' | 'submitting';

export default function AssessmentPage() {
  const router = useRouter();

  // Setup state
  const [judgeType, setJudgeType] = useState<JudgeType>('technical');
  const [jobDescription, setJobDescription] = useState('');
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [resumeText, setResumeText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  // Test state
  const [phase, setPhase] = useState<Phase>('setup');
  const [assessmentId, setAssessmentId] = useState('');
  const [questions, setQuestions] = useState<MCQQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, number>>({});
  const [hasReachedEnd, setHasReachedEnd] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Track when user reaches the final question (spec requirement)
  useEffect(() => {
    if (questions.length > 0 && currentIndex === questions.length - 1) {
      setHasReachedEnd(true);
    }
  }, [currentIndex, questions.length]);

  const handleResumeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setResumeFile(file);
    try {
      const result = await analyzeResume(file);
      setResumeText(result.resumeText);
      toast.success('Resume parsed!');
    } catch {
      toast.error('Could not parse resume.');
    }
  };

  const handleGenerate = async () => {
    if (!jobDescription.trim()) {
      toast.error('Please enter a job description.');
      return;
    }
    setIsGenerating(true);
    try {
      const result = await generateAssessment({
        resumeText: resumeText || 'General technical assessment',
        jobDescription,
        judgeType,
        questionCount: 10,
      });
      setAssessmentId(result.assessmentId);
      setQuestions(result.questions);
      setCurrentIndex(0);
      setUserAnswers({});
      setHasReachedEnd(false);
      setPhase('test');
    } catch (err) {
      toast.error((err as Error).message || 'Failed to generate assessment.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSelectAnswer = (optionIndex: number) => {
    const q = questions[currentIndex];
    if (!q) return;
    setUserAnswers((prev) => ({ ...prev, [q.id]: optionIndex }));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setPhase('submitting');
    try {
      const result: AssessmentResult = await submitAssessment({
        assessmentId,
        questions,
        userAnswers,
        judgeType,
        jobDescription,
      });
      sessionStorage.setItem('ascend_result', JSON.stringify(result));
      sessionStorage.setItem('ascend_judge_type', judgeType);
      router.push('/results');
    } catch (err) {
      toast.error((err as Error).message || 'Submission failed.');
      setPhase('test');
      setIsSubmitting(false);
    }
  };

  // ── Setup Screen ─────────────────────────────────────────────────────────────

  if (phase === 'setup') {
    return (
      <>
        <Head>
          <title>MCQ Assessment — Ascend</title>
          <meta name="description" content="Take an AI-generated skill assessment based on your resume and job requirements." />
        </Head>
        <div className="page-container flex flex-col items-center justify-center min-h-screen px-6 py-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-2xl"
          >
            <div className="text-center mb-8">
              <h1 className="text-3xl font-black text-text-primary mb-2">Skills Assessment</h1>
              <p className="text-text-secondary">
                AI-generated MCQ test tailored to your role and resume.
              </p>
            </div>

            <div className="glass-card p-8 flex flex-col gap-6">
              {/* Resume */}
              <div>
                <p className="text-sm font-semibold text-text-secondary mb-2">Resume (optional)</p>
                <label className={`flex items-center gap-3 p-4 rounded-xl border border-dashed cursor-pointer transition-colors
                  ${resumeFile ? 'border-accent-500/50 bg-accent-500/5' : 'border-surface-border hover:border-brand-500/50'}`}>
                  <input type="file" accept=".pdf" onChange={handleResumeUpload} className="hidden" />
                  <svg className="w-5 h-5 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                  <span className="text-sm text-text-secondary">
                    {resumeFile ? resumeFile.name : 'Attach resume PDF'}
                  </span>
                  {resumeText && <span className="ml-auto text-xs text-accent-500 font-semibold">✓ Parsed</span>}
                </label>
              </div>

              {/* Job description textarea — 25vh per spec */}
              <TextArea
                label="Job Description / Role Requirements"
                placeholder="Paste the full job description here..."
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                heightVh={25}
              />

              {/* Judge mode */}
              <div>
                <p className="text-sm font-semibold text-text-secondary mb-3">Assessment Focus</p>
                <div className="grid grid-cols-2 gap-3">
                  {(['technical', 'hr'] as JudgeType[]).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setJudgeType(mode)}
                      className={`flex items-center gap-3 p-4 rounded-xl border transition-all text-left
                        ${judgeType === mode
                          ? 'border-brand-500/60 bg-brand-500/10'
                          : 'border-surface-border hover:border-surface-500'}`}
                    >
                      <span className="text-xl">{mode === 'technical' ? '💻' : '🤝'}</span>
                      <span className="text-sm font-semibold text-text-primary capitalize">{mode}</span>
                    </button>
                  ))}
                </div>
              </div>

              <Button
                variant="primary"
                size="lg"
                className="w-full"
                onClick={handleGenerate}
                loading={isGenerating}
                disabled={!jobDescription.trim()}
              >
                Generate Assessment (10 Questions)
              </Button>
            </div>
          </motion.div>
        </div>
      </>
    );
  }

  // ── Submitting overlay ────────────────────────────────────────────────────────

  if (phase === 'submitting') {
    return (
      <div className="page-container flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="w-16 h-16 rounded-full border-2 border-brand-500/30 border-t-brand-500 animate-spin" />
          <h2 className="text-xl font-bold text-text-primary">Evaluating your answers...</h2>
          <p className="text-text-muted text-sm">Our AI is generating personalised feedback</p>
        </div>
      </div>
    );
  }

  // ── MCQ Test Screen ───────────────────────────────────────────────────────────

  const currentQ = questions[currentIndex];

  return (
    <>
      <Head>
        <title>Assessment — Question {currentIndex + 1} — Ascend</title>
      </Head>
      <div className="page-container min-h-screen px-6 py-10">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-accent-500 flex items-center justify-center">
                <span className="text-white font-black text-sm">A</span>
              </div>
              <span className="font-bold text-text-secondary capitalize">{judgeType} Assessment</span>
            </div>
            <span className="text-sm text-text-muted">
              {Object.keys(userAnswers).length} / {questions.length} answered
            </span>
          </div>

          {/* Question card */}
          <AnimatePresence mode="wait">
            {currentQ && (
              <QuestionCard
                key={currentQ.id}
                question={currentQ}
                questionNumber={currentIndex + 1}
                totalQuestions={questions.length}
                selectedAnswer={userAnswers[currentQ.id]}
                onSelectAnswer={handleSelectAnswer}
              />
            )}
          </AnimatePresence>

          {/* Navigation */}
          <div className="mt-8">
            <NavigationNav
              currentIndex={currentIndex}
              totalQuestions={questions.length}
              hasAnsweredCurrent={currentQ ? currentQ.id in userAnswers : false}
              hasReachedEnd={hasReachedEnd}
              isSubmitting={isSubmitting}
              onPrevious={() => setCurrentIndex((i) => Math.max(0, i - 1))}
              onNext={() => setCurrentIndex((i) => Math.min(questions.length - 1, i + 1))}
              onSubmit={handleSubmit}
            />
          </div>
        </div>
      </div>
    </>
  );
}
