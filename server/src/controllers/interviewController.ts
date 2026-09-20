import type { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import type { AuthenticatedRequest } from '../middleware/authMiddleware';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { invokeAndParse } from '../services/bedrockService';
import { synthesiseSpeech } from '../services/ttsService';
import { transcribeAudio, cleanTranscript } from '../services/sttService';
import { supabaseAdmin } from '../config/supabase';
import { truncateResumeText } from '../utils/pdfParser';
import { saveLocalInterview, getLocalInterviewHistory } from '../utils/localStore';
import {
  buildHRInterviewSystemPrompt,
  buildHRQuestionsPrompt,
  buildHRAnswerEvaluationPrompt,
  buildHRFinalScoringPrompt,
} from '../utils/hrPrompts';
import {
  buildTechInterviewSystemPrompt,
  buildTechQuestionsPrompt,
  buildTechAnswerEvaluationPrompt,
  buildTechFinalScoringPrompt,
} from '../utils/techPrompts';
import type {
  InterviewStartPayload,
  InterviewQuestion,
  AnswerSubmitPayload,
  AnswerEvaluationResult,
  InterviewCompletePayload,
  InterviewFeedback,
  ConversationTurn,
  DemeanorTelemetry,
} from '../types/payload.d';

// ── Session Initialisation ────────────────────────────────────────────────────

/**
 * POST /api/interview/start
 * Generates 6 interview questions and synthesizes TTS audio for the first one.
 * Creates a session record in Supabase.
 */
export const startInterview = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { resumeText, jobDescription, judgeType } = req.body as InterviewStartPayload;

  if (!resumeText || !jobDescription || !judgeType) {
    throw createError('resumeText, jobDescription, and judgeType are required.', 400);
  }

  const truncated = truncateResumeText(resumeText);

  const systemPrompt =
    judgeType === 'technical'
      ? buildTechInterviewSystemPrompt()
      : buildHRInterviewSystemPrompt();

  const questionsPrompt =
    judgeType === 'technical'
      ? buildTechQuestionsPrompt(truncated, jobDescription)
      : buildHRQuestionsPrompt(truncated, jobDescription);

  // 1. Generate questions via Bedrock
  const parsed = await invokeAndParse<{ questions: InterviewQuestion[] }>(
    systemPrompt,
    questionsPrompt,
    [],
    { temperature: 0.7, maxTokens: 2048 }
  );

  const questions: InterviewQuestion[] = (parsed.questions ?? []).map((q, i) => ({
    ...q,
    index: i,
  }));

  if (questions.length === 0) {
    throw createError('Failed to generate interview questions.', 500);
  }

  // 2. Synthesize audio for the first question
  const firstQuestion = questions[0];
  let audioDataUri: string | undefined;
  try {
    audioDataUri = await synthesiseSpeech(firstQuestion.question);
  } catch (ttsErr) {
    console.warn('[TTS] Audio synthesis failed for Q1, proceeding without audio:', ttsErr);
  }

  // 3. Create session in Supabase (for authenticated users)
  const sessionId = uuidv4();

  if (req.userId) {
    await supabaseAdmin.from('interview_sessions').insert({
      id: sessionId,
      user_id: req.userId,
      judge_type: judgeType,
      job_description: jobDescription,
      resume_text: truncated,
      status: 'in_progress',
    });
  }

  res.status(200).json({
    success: true,
    data: {
      sessionId,
      questions,
      firstQuestion,
      audioDataUri,
      totalQuestions: questions.length,
    },
  });
});

// ── Answer Submission + Evaluation Loop ──────────────────────────────────────

/**
 * POST /api/interview/answer
 * Evaluates the candidate's answer using Bedrock and returns the next question
 * with synthesized TTS audio. If it's the last question, skips next question.
 */
export const submitAnswer = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const {
    sessionId,
    questionIndex,
    question,
    answerText,
    conversationHistory,
    judgeType,
    isLastQuestion,
    jobDescription,
  } = req.body as AnswerSubmitPayload & { jobDescription: string };

  if (!question || !answerText || judgeType === undefined) {
    throw createError('question, answerText, and judgeType are required.', 400);
  }

  const systemPrompt =
    judgeType === 'technical'
      ? buildTechInterviewSystemPrompt()
      : buildHRInterviewSystemPrompt();

  const evalPrompt =
    judgeType === 'technical'
      ? buildTechAnswerEvaluationPrompt(
          question,
          answerText,
          conversationHistory,
          isLastQuestion,
          jobDescription
        )
      : buildHRAnswerEvaluationPrompt(
          question,
          answerText,
          conversationHistory,
          isLastQuestion,
          jobDescription
        );

  // Evaluate via Bedrock
  const evaluation = await invokeAndParse<AnswerEvaluationResult>(
    systemPrompt,
    evalPrompt,
    [],
    { temperature: 0.6, maxTokens: 1024 }
  );

  // Synthesize TTS for next question if not complete
  let audioDataUri: string | undefined;
  if (!evaluation.isComplete && evaluation.nextQuestion) {
    try {
      audioDataUri = await synthesiseSpeech(evaluation.nextQuestion.question);
    } catch (ttsErr) {
      console.warn('[TTS] Failed to synthesize next question audio:', ttsErr);
    }
  }

  // Append turn to session transcript in Supabase
  if (req.userId && sessionId) {
    const newTurns: ConversationTurn[] = [
      { role: 'assistant', content: question, questionIndex, timestamp: new Date().toISOString() },
      { role: 'user', content: answerText, questionIndex, timestamp: new Date().toISOString() },
    ];

    // Use RPC or manual append — simple approach: fetch, append, update
    const { data: sessionData } = await supabaseAdmin
      .from('interview_sessions')
      .select('transcript')
      .eq('id', sessionId)
      .single();

    const existing: ConversationTurn[] = (sessionData?.transcript as ConversationTurn[]) ?? [];
    await supabaseAdmin
      .from('interview_sessions')
      .update({ transcript: [...existing, ...newTurns] })
      .eq('id', sessionId);
  }

  res.status(200).json({
    success: true,
    data: {
      ...evaluation,
      audioDataUri,
    },
  });
});

// ── Session Completion + Final Scoring ────────────────────────────────────────

/**
 * POST /api/interview/complete
 * Accepts the full conversation history + client-side demeanor telemetry.
 * Synthesizes a comprehensive score and actionable feedback via Bedrock.
 * Persists the final result to Supabase.
 */
export const completeInterview = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const {
    sessionId,
    conversationHistory,
    demeanorTelemetry,
    judgeType,
    jobDescription,
    resumeText,
  } = req.body as InterviewCompletePayload;

  if (!conversationHistory || !demeanorTelemetry || !judgeType) {
    throw createError('conversationHistory, demeanorTelemetry, and judgeType are required.', 400);
  }

  const systemPrompt =
    judgeType === 'technical'
      ? buildTechInterviewSystemPrompt()
      : buildHRInterviewSystemPrompt();

  const scoringPrompt =
    judgeType === 'technical'
      ? buildTechFinalScoringPrompt(conversationHistory, demeanorTelemetry, jobDescription)
      : buildHRFinalScoringPrompt(conversationHistory, demeanorTelemetry, jobDescription);

  const feedback = await invokeAndParse<InterviewFeedback>(
    systemPrompt,
    scoringPrompt,
    [],
    { temperature: 0.4, maxTokens: 2048 }
  );

  // Merge demeanor metrics into feedback
  const enrichedFeedback: InterviewFeedback = {
    ...feedback,
    eyeContactPercent: demeanorTelemetry.eyeContactPercent,
    postureAlerts: demeanorTelemetry.postureAlertCount,
  };

  // 1. Persist final state to local disk store
  saveLocalInterview({
    id: sessionId,
    user_id: req.userId || null,
    job_description: jobDescription,
    judge_type: judgeType,
    overall_score: feedback.overallScore,
    content_score: feedback.contentScore,
    demeanor_score: feedback.demeanorScore,
    status: 'completed',
    created_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
  });

  // 2. Persist final state to Supabase
  if (req.userId && sessionId) {
    try {
      await supabaseAdmin
        .from('interview_sessions')
        .update({
          demeanor_telemetry: demeanorTelemetry,
          content_score: feedback.contentScore,
          demeanor_score: feedback.demeanorScore,
          overall_score: feedback.overallScore,
          llm_feedback: enrichedFeedback,
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', sessionId);
    } catch (sbErr) {
      console.warn('[Interview] Could not update interview_sessions in Supabase:', sbErr);
    }
  }

  res.status(200).json({ success: true, data: enrichedFeedback });
});

// ── History ────────────────────────────────────────────────────────────────────

/**
 * GET /api/interview/history
 * Returns completed interview sessions for the authenticated user.
 */
export const getInterviewHistory = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.userId) throw createError('Authentication required.', 401);

  try {
    const { data, error } = await supabaseAdmin
      .from('interview_sessions')
      .select('id, created_at, judge_type, overall_score, content_score, demeanor_score, status, job_description')
      .eq('user_id', req.userId)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(20);

    if (!error && Array.isArray(data) && data.length > 0) {
      res.json({ success: true, data });
      return;
    }
  } catch (sbErr) {
    console.warn('[Interview] Supabase query failed, falling back to local store:', sbErr);
  }

  // Fallback to local store
  const localHistory = getLocalInterviewHistory(req.userId);
  res.json({ success: true, data: localHistory });
});

/**
 * GET /api/interview/:sessionId/result
 * Returns the full result for a specific session.
 */
export const getInterviewResult = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.userId) throw createError('Authentication required.', 401);

  const { sessionId } = req.params;

  const { data, error } = await supabaseAdmin
    .from('interview_sessions')
    .select('*')
    .eq('id', sessionId)
    .eq('user_id', req.userId)
    .single();

  if (error || !data) throw createError('Session not found.', 404);

  res.json({ success: true, data });
});

/**
 * POST /api/interview/transcribe
 * Accepts an audio file upload and transcribes it using Deepgram Nova-2 STT.
 */
export const transcribeAudioController = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.file) {
    throw createError('Audio file is required under form field "audio".', 400);
  }

  const language = (req.query.language as string) || 'en';
  const transcript = await transcribeAudio(
    req.file.buffer,
    req.file.mimetype,
    language
  );
  const cleanedTranscript = cleanTranscript(transcript);

  res.json({
    success: true,
    data: {
      transcript,
      cleanedTranscript,
    },
  });
});
