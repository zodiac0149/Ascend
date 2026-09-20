import React, { useState, useCallback, useRef, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { VideoFeed } from '@/components/interview/VideoFeed';
import { PostureAlertOverlay } from '@/components/interview/PostureAlert';
import { TranscriptBox } from '@/components/interview/TranscriptBox';
import { TextArea } from '@/components/ui/TextArea';
import { Button } from '@/components/ui/Button';
import { useSpeechToText } from '@/hooks/useSpeechToText';
import { useAudioPlayer } from '@/hooks/useAudioPlayer';
import {
  startInterview,
  submitAnswer,
  completeInterview,
  analyzeResume,
} from '@/services/interviewService';
import type {
  InterviewQuestion,
  ConversationTurn,
  DemeanorTelemetry,
  PostureAlert,
  InterviewFeedback,
  JudgeType,
} from '@/types/interview';

type Phase = 'setup' | 'active' | 'processing' | 'completed';

interface SetupState {
  jobDescription: string;
  judgeType: JudgeType;
  resumeFile: File | null;
  resumeText: string;
}

export default function InterviewPage() {
  const router = useRouter();
  const getDemeanorRef = useRef<(() => Omit<DemeanorTelemetry, 'eyeContactPercent'> & { eyeContactPercent: number }) | null>(null);

  // UI State
  const [phase, setPhase] = useState<Phase>('setup');
  const [setup, setSetup] = useState<SetupState>({
    jobDescription: '',
    judgeType: 'technical',
    resumeFile: null,
    resumeText: '',
  });
  const [isStarting, setIsStarting] = useState(false);

  // Session state
  const [sessionId, setSessionId] = useState('');
  const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<InterviewQuestion | null>(null);
  const [conversationHistory, setConversationHistory] = useState<ConversationTurn[]>([]);
  const [alerts, setAlerts] = useState<PostureAlert[]>([]);
  const [feedback, setFeedback] = useState<InterviewFeedback | null>(null);
  const [isProcessingAnswer, setIsProcessingAnswer] = useState(false);

  // Hooks
  const { transcript, isListening, startListening, stopListening } = useSpeechToText({
    continuous: true,
    onFinalTranscript: () => {},
  });
  const { play: playAudio, speakText, isPlaying } = useAudioPlayer();

  // ── Setup Handlers ──────────────────────────────────────────────────────────

  const handleResumeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSetup((prev) => ({ ...prev, resumeFile: file }));
    try {
      const result = await analyzeResume(file);
      setSetup((prev) => ({ ...prev, resumeText: result.resumeText }));
      toast.success('Resume parsed successfully!');
    } catch {
      toast.error('Could not parse resume. Please try again.');
    }
  };

  const handleStartInterview = async () => {
    if (!setup.jobDescription.trim()) {
      toast.error('Please enter a job description.');
      return;
    }
    setIsStarting(true);
    try {
      const response = await startInterview({
        resumeText: setup.resumeText || 'No resume provided — conduct a general interview.',
        jobDescription: setup.jobDescription,
        judgeType: setup.judgeType,
      });

      setSessionId(response.sessionId);
      setQuestions(response.questions);
      setCurrentQuestion(response.firstQuestion);
      setPhase('active');

      // Play first question audio (Murf AI → browser TTS fallback)
      if (response.audioDataUri) {
        await playAudio(response.audioDataUri).catch(() => {});
      } else if (response.firstQuestion?.question) {
        await speakText(response.firstQuestion.question).catch(() => {});
      }
    } catch (err) {
      toast.error((err as Error).message || 'Failed to start interview.');
    } finally {
      setIsStarting(false);
    }
  };

  // ── Answer Submission ───────────────────────────────────────────────────────

  const handleSubmitAnswer = useCallback(async () => {
    if (!currentQuestion) return;

    // Stop STT and get final transcript
    const answerText = await stopListening();

    if (!answerText.trim()) {
      toast.error('Please speak your answer before submitting.');
      return;
    }

    setIsProcessingAnswer(true);
    setPhase('processing');

    // Append to conversation history
    const newHistory: ConversationTurn[] = [
      ...conversationHistory,
      {
        role: 'assistant',
        content: currentQuestion.question,
        questionIndex: currentQuestion.index,
        timestamp: new Date().toISOString(),
      },
      {
        role: 'user',
        content: answerText,
        questionIndex: currentQuestion.index,
        timestamp: new Date().toISOString(),
      },
    ];
    setConversationHistory(newHistory);

    const isLastQuestion = currentQuestion.index === questions.length - 1;

    try {
      const response = await submitAnswer({
        sessionId,
        questionIndex: currentQuestion.index,
        question: currentQuestion.question,
        answerText,
        conversationHistory: newHistory,
        judgeType: setup.judgeType,
        isLastQuestion,
        jobDescription: setup.jobDescription,
      });

      if (response.isComplete || isLastQuestion) {
        // Complete the interview
        await handleCompleteInterview(newHistory);
      } else if (response.nextQuestion) {
        setCurrentQuestion(response.nextQuestion);
        setPhase('active');
        // Play next question audio (Murf AI → browser TTS fallback)
        if (response.audioDataUri) {
          await playAudio(response.audioDataUri).catch(() => {});
        } else {
          await speakText(response.nextQuestion.question).catch(() => {});
        }
      }
    } catch (err) {
      toast.error((err as Error).message || 'Failed to process your answer.');
      setPhase('active');
    } finally {
      setIsProcessingAnswer(false);
    }
  }, [currentQuestion, conversationHistory, questions, sessionId, setup, stopListening, playAudio, speakText]);

  const handleCompleteInterview = async (history: ConversationTurn[]) => {
    const demeanor = getDemeanorRef.current?.() ?? {
      eyeContactLossCount: 0,
      poorPostureDuration: 0,
      postureAlertCount: 0,
      gazeOffScreenDuration: 0,
      eyeContactPercent: 100,
      totalDurationSeconds: 0,
    };

    try {
      const result = await completeInterview({
        sessionId,
        conversationHistory: history,
        demeanorTelemetry: demeanor,
        judgeType: setup.judgeType,
        jobDescription: setup.jobDescription,
        resumeText: setup.resumeText,
      });
      setFeedback(result);
      setPhase('completed');

      // Store result in sessionStorage for results page
      sessionStorage.setItem('ascend_result', JSON.stringify(result));
      sessionStorage.setItem('ascend_judge_type', setup.judgeType);
    } catch (err) {
      toast.error((err as Error).message || 'Failed to generate final feedback.');
      setPhase('active');
    }
  };

  // ── Setup Screen ─────────────────────────────────────────────────────────────

  if (phase === 'setup') {
    return (
      <>
        <Head>
          <title>AI Mock Interview — Ascend</title>
        </Head>
        <div className="page-container flex flex-col items-center justify-center min-h-screen px-6 py-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-2xl"
          >
            <div className="mb-8 text-center">
              <h1 className="text-3xl font-black text-text-primary mb-2">Configure Your Interview</h1>
              <p className="text-text-secondary">
                Paste the job description and choose your AI judge mode.
              </p>
            </div>

            <div className="glass-card p-8 flex flex-col gap-6">
              {/* Resume upload */}
              <div>
                <p className="text-sm font-semibold text-text-secondary mb-2">
                  Resume (optional — improves question relevance)
                </p>
                <label className={`flex items-center gap-3 p-4 rounded-xl border border-dashed cursor-pointer transition-colors
                  ${setup.resumeFile ? 'border-accent-500/50 bg-accent-500/5' : 'border-surface-border hover:border-brand-500/50'}`}>
                  <input type="file" accept=".pdf" onChange={handleResumeUpload} className="hidden" />
                  <svg className="w-5 h-5 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                  <span className="text-sm text-text-secondary">
                    {setup.resumeFile ? setup.resumeFile.name : 'Attach your resume PDF'}
                  </span>
                  {setup.resumeText && <span className="ml-auto text-xs text-accent-500 font-semibold">✓ Parsed</span>}
                </label>
              </div>

              {/* Job description — 25vh textarea (spec) */}
              <TextArea
                label="Job Description / Requirements"
                placeholder="Paste the job posting or eligibility criteria here..."
                value={setup.jobDescription}
                onChange={(e) => setSetup((prev) => ({ ...prev, jobDescription: e.target.value }))}
                heightVh={25}
                hint="The more detail you provide, the more tailored the interview questions will be."
              />

              {/* Judge mode toggle */}
              <div>
                <p className="text-sm font-semibold text-text-secondary mb-3">AI Judge Mode</p>
                <div className="grid grid-cols-2 gap-3">
                  {(['technical', 'hr'] as JudgeType[]).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setSetup((prev) => ({ ...prev, judgeType: mode }))}
                      className={`flex flex-col items-start gap-2 p-4 rounded-xl border transition-all text-left
                        ${setup.judgeType === mode
                          ? 'border-brand-500/60 bg-brand-500/10 shadow-glow-cyan'
                          : 'border-surface-border hover:border-surface-500 bg-surface-700/30'}`}
                    >
                      <span className="text-lg">{mode === 'technical' ? '💻' : '🤝'}</span>
                      <div>
                        <p className="text-sm font-bold text-text-primary capitalize">{mode} Judge</p>
                        <p className="text-xs text-text-muted mt-0.5">
                          {mode === 'technical'
                            ? 'Code, algorithms, and system design'
                            : 'Behavioral, soft skills, and culture fit'}
                        </p>
                      </div>
                      {setup.judgeType === mode && (
                        <div className="ml-auto absolute top-3 right-3 w-4 h-4 rounded-full bg-brand-500 flex items-center justify-center">
                          <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <Button
                variant="primary"
                className="w-full"
                size="lg"
                onClick={handleStartInterview}
                loading={isStarting}
                disabled={!setup.jobDescription.trim()}
              >
                Start Interview Prep →
              </Button>
            </div>
          </motion.div>
        </div>
      </>
    );
  }

  // ── Completed Screen ──────────────────────────────────────────────────────────

  if (phase === 'completed' && feedback) {
    router.push('/results');
    return null;
  }

  // ── Active Interview Screen — 50/50 Split ─────────────────────────────────────

  return (
    <>
      <Head>
        <title>AI Interview — Ascend</title>
      </Head>
      <div className="page-container flex flex-col h-screen overflow-hidden">
        {/* Header bar */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-surface-border shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-lg font-black gradient-text">Ascend</span>
            <span className="text-surface-border">·</span>
            <span className="text-sm text-text-secondary capitalize">{setup.judgeType} Interview</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-text-muted">
              Q{currentQuestion ? currentQuestion.index + 1 : 1} / {questions.length}
            </span>
            {(phase === 'processing' || isProcessingAnswer) && (
              <div className="flex items-center gap-2 text-xs text-brand-400 font-semibold">
                <div className="w-3 h-3 rounded-full border border-brand-400/40 border-t-brand-400 animate-spin" />
                Processing...
              </div>
            )}
          </div>
        </div>

        {/* 50/50 split-screen */}
        <div className="flex flex-1 overflow-hidden">
          {/* LEFT PANEL — User Video Feed + CV */}
          <div className="w-1/2 relative bg-black border-r border-surface-border">
            <VideoFeed
              enabled={phase === 'active' || phase === 'processing'}
              onAlert={(alert) => setAlerts((prev) => [...prev.slice(-4), alert])}
              onDemeanorRef={(fn) => { getDemeanorRef.current = fn as typeof getDemeanorRef.current; }}
            />
            {/* Posture alert overlay */}
            <PostureAlertOverlay
              alerts={alerts}
              onDismiss={(id) => setAlerts((prev) => prev.filter((a) => a.id !== id))}
            />
          </div>

          {/* RIGHT PANEL — Question + Transcript */}
          <div className="w-1/2 flex flex-col">
            {/* TOP HALF — AI Question */}
            <div className="flex-1 p-6 border-b border-surface-border overflow-y-auto">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-6 h-6 rounded-full bg-brand-500/15 flex items-center justify-center">
                  <svg className="w-3 h-3 text-brand-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                  </svg>
                </div>
                <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                  {setup.judgeType === 'technical' ? 'Technical' : 'HR'} Judge
                </span>
                {isPlaying && (
                  <span className="live-badge ml-auto">🔊 Speaking</span>
                )}
              </div>

              <AnimatePresence mode="wait">
                {currentQuestion ? (
                  <motion.div
                    key={currentQuestion.index}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ duration: 0.3 }}
                  >
                    {currentQuestion.category && (
                      <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold
                                       bg-brand-500/10 text-brand-400 border border-brand-500/20 mb-3">
                        {currentQuestion.category}
                      </span>
                    )}
                    <p className="text-lg font-semibold text-text-primary leading-relaxed">
                      {currentQuestion.question}
                    </p>
                  </motion.div>
                ) : (
                  <div className="skeleton h-24 w-full rounded-xl" />
                )}
              </AnimatePresence>
            </div>

            {/* BOTTOM HALF — Live Transcript + Controls */}
            <div className="flex-1 flex flex-col p-6 overflow-hidden">
              <div className="flex-1 overflow-hidden">
                <TranscriptBox
                  transcript={transcript}
                  isListening={isListening}
                  isProcessing={isProcessingAnswer}
                />
              </div>

              {/* Controls */}
              <div className="flex items-center gap-3 mt-4 pt-4 border-t border-surface-border">
                {isListening ? (
                  <Button
                    variant="danger"
                    className="flex-1"
                    onClick={handleSubmitAnswer}
                    disabled={isProcessingAnswer}
                    leftIcon={
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                      </svg>
                    }
                  >
                    Submit Answer
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    className="flex-1"
                    onClick={startListening}
                    disabled={isPlaying || isProcessingAnswer}
                    leftIcon={
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                      </svg>
                    }
                  >
                    {isPlaying ? 'Wait for question...' : 'Start Speaking'}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
