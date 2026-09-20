import type { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import type { AuthenticatedRequest } from '../middleware/authMiddleware';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { invokeAndParse } from '../services/bedrockService';
import { supabaseAdmin } from '../config/supabase';
import { buildTechMCQPrompt, buildTechInterviewSystemPrompt } from '../utils/techPrompts';
import { buildHRInterviewSystemPrompt } from '../utils/hrPrompts';
import { truncateResumeText } from '../utils/pdfParser';
import {
  saveLocalAssessment,
  getLocalAssessment,
  getLocalAssessmentHistory,
} from '../utils/localStore';
import type {
  MCQGeneratePayload,
  MCQQuestion,
  MCQSubmitPayload,
  MCQResult,
} from '../types/payload.d';

// ── correctIndex Resolver & Normaliser ───────────────────────────────────────
// LLMs can return answers in various formats:
//   - "correctAnswer": exact option text (e.g. "React")
//   - "correctOptionLetter": "A", "B", "C", "D"
//   - "correctIndex": 0, 1, 2, 3 (or sometimes 1, 2, 3, 4 or "0", "A")
//   - "explanation": "Option B is correct because..."
//
// resolveCorrectQuestionAnswer uses a multi-strategy cascade to determine the true
// 0-based index and guarantees options[correctIndex] points to the intended answer.

const LETTER_MAP: Record<string, number> = { a: 0, b: 1, c: 2, d: 3 };

function normalizeCorrectIndex(raw: unknown, totalOptions = 4): number {
  if (typeof raw === 'number') {
    if (Number.isInteger(raw) && raw >= 0 && raw < totalOptions) return raw;
    if (Number.isInteger(raw) && raw === totalOptions) return totalOptions - 1; // 1-based edge case
    return 0;
  }

  if (typeof raw === 'string') {
    const trimmed = raw.trim().toLowerCase();
    if (trimmed.length === 1 && trimmed in LETTER_MAP) {
      return LETTER_MAP[trimmed];
    }
    const parsed = parseInt(trimmed, 10);
    if (!isNaN(parsed)) {
      if (parsed >= 0 && parsed < totalOptions) return parsed;
      if (parsed === totalOptions) return totalOptions - 1;
    }
  }

  return 0;
}

function resolveQuestionAnswer(
  q: {
    question?: string;
    options?: string[];
    correctIndex?: unknown;
    correctAnswer?: unknown;
    correctOptionLetter?: unknown;
    explanation?: unknown;
  },
  totalOptions = 4
): { resolvedIndex: number; resolvedAnswerText: string } {
  const options = Array.isArray(q.options)
    ? q.options.map((opt) => String(opt).trim())
    : [];

  const cleanOption = (text: string) =>
    text.replace(/^[A-Da-d0-9][\.\)\:\-]\s*/, '').trim().toLowerCase();

  // Strategy 1: Match correctAnswer text against options
  if (typeof q.correctAnswer === 'string' && q.correctAnswer.trim()) {
    const rawTarget = q.correctAnswer.trim().toLowerCase();
    const cleanTarget = cleanOption(rawTarget);

    // 1a: Exact match
    const exactIdx = options.findIndex((opt) => opt.toLowerCase() === rawTarget);
    if (exactIdx !== -1) {
      return { resolvedIndex: exactIdx, resolvedAnswerText: options[exactIdx] };
    }

    // 1b: Cleaned match (ignoring "A) ", "1. ", etc.)
    const cleanIdx = options.findIndex((opt) => cleanOption(opt) === cleanTarget);
    if (cleanIdx !== -1) {
      return { resolvedIndex: cleanIdx, resolvedAnswerText: options[cleanIdx] };
    }

    // 1c: Substring inclusion
    if (cleanTarget.length > 3) {
      const subIdx = options.findIndex((opt) => {
        const co = cleanOption(opt);
        return co.includes(cleanTarget) || cleanTarget.includes(co);
      });
      if (subIdx !== -1) {
        return { resolvedIndex: subIdx, resolvedAnswerText: options[subIdx] };
      }
    }
  }

  // Strategy 2: Match correctOptionLetter ("A", "B", "C", "D")
  if (typeof q.correctOptionLetter === 'string' && q.correctOptionLetter.trim()) {
    const letter = q.correctOptionLetter.trim().toLowerCase();
    if (letter in LETTER_MAP && LETTER_MAP[letter] < options.length) {
      const idx = LETTER_MAP[letter];
      return { resolvedIndex: idx, resolvedAnswerText: options[idx] ?? '' };
    }
  }

  // Strategy 3: Check explanation for explicit "Option X is correct"
  if (typeof q.explanation === 'string' && q.explanation) {
    const expMatch = q.explanation.match(/\b(?:option|choice|answer)\s+([A-D])\b/i);
    if (expMatch && expMatch[1]) {
      const letter = expMatch[1].toLowerCase();
      if (letter in LETTER_MAP && LETTER_MAP[letter] < options.length) {
        const idx = LETTER_MAP[letter];
        return { resolvedIndex: idx, resolvedAnswerText: options[idx] ?? '' };
      }
    }
  }

  // Strategy 4: Fallback to normalized correctIndex
  const normIdx = normalizeCorrectIndex(q.correctIndex, options.length || totalOptions);
  return { resolvedIndex: normIdx, resolvedAnswerText: options[normIdx] ?? '' };
}

// ── In-Memory Session Cache ──────────────────────────────────────────────────
// Keeps generated questions (with correct answers) available even for guests
// or if Supabase session lookup is unauthenticated/delayed.
interface StoredAssessmentSession {
  assessmentId: string;
  userId?: string;
  questions: MCQQuestion[];
  createdAt: number;
}

const assessmentSessionCache = new Map<string, StoredAssessmentSession>();

// Periodically clean up cache entries older than 4 hours
setInterval(() => {
  const cutoff = Date.now() - 4 * 60 * 60 * 1000;
  for (const [id, session] of assessmentSessionCache.entries()) {
    if (session.createdAt < cutoff) {
      assessmentSessionCache.delete(id);
    }
  }
}, 30 * 60 * 1000);

/**
 * POST /api/assessment/generate
 * Generates MCQ questions via Bedrock based on resume + job description.
 * Saves a new assessment session to Supabase and returns questions + assessmentId.
 */
export const generateAssessment = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { resumeText, jobDescription, judgeType, questionCount = 10 } =
    req.body as MCQGeneratePayload;

  if (!resumeText || !jobDescription || !judgeType) {
    throw createError('resumeText, jobDescription, and judgeType are required.', 400);
  }

  const truncated = truncateResumeText(resumeText);

  const systemPrompt =
    judgeType === 'technical'
      ? buildTechInterviewSystemPrompt()
      : buildHRInterviewSystemPrompt();

  const userPrompt = buildTechMCQPrompt(truncated, jobDescription, questionCount, judgeType);

  const parsed = await invokeAndParse<{ questions: MCQQuestion[] }>(
    systemPrompt,
    userPrompt,
    [],
    { temperature: 0.5, maxTokens: 4096 }
  );

  // Resolve questions with robust multi-strategy answer matching
  const questions: MCQQuestion[] = (parsed.questions ?? []).map((q, i) => {
    const options = Array.isArray(q.options) ? q.options.map(String) : [];
    const { resolvedIndex, resolvedAnswerText } = resolveQuestionAnswer(q, options.length || 4);

    return {
      ...q,
      id: q.id ?? `q${i + 1}`,
      options: options as [string, string, string, string],
      correctIndex: resolvedIndex,
      correctAnswer: resolvedAnswerText,
      explanation: q.explanation ?? 'No explanation provided.',
      category: q.category ?? (judgeType === 'technical' ? 'Technical' : 'HR Competency'),
    };
  });

  if (questions.length === 0) {
    throw createError('Bedrock returned zero questions. Please try again.', 500);
  }

  const assessmentId = uuidv4();

  // 1. Cache session in memory (guaranteed answer retrieval on submit)
  assessmentSessionCache.set(assessmentId, {
    assessmentId,
    userId: req.userId,
    questions,
    createdAt: Date.now(),
  });

  // 2. Persist session to local disk store (instant, durable across restarts)
  saveLocalAssessment({
    id: assessmentId,
    user_id: req.userId || null,
    job_description: jobDescription,
    judge_type: judgeType,
    resume_text: truncated,
    questions: questions,
    total_questions: questions.length,
    status: 'in_progress',
    created_at: new Date().toISOString(),
  });

  // 3. Persist session to Supabase
  try {
    await supabaseAdmin.from('assessments').insert({
      id: assessmentId,
      user_id: req.userId || null,
      job_description: jobDescription,
      judge_type: judgeType,
      resume_text: truncated,
      questions: questions,  // stored with verified correctIndex server-side
      total_questions: questions.length,
      status: 'in_progress',
    });
  } catch (dbErr) {
    console.warn('[Assessment] Supabase insert warning (non-fatal, session cached in memory and disk):', dbErr);
  }

  console.log(`[MCQ] Generated assessment ${assessmentId} with ${questions.length} questions for user ${req.userId ?? 'guest'}`);
  questions.forEach((q, i) => {
    console.log(`[MCQ] Q${i + 1}: correctIndex=${q.correctIndex} ("${q.options[q.correctIndex] ?? q.correctAnswer}")`);
  });

  // Return questions WITHOUT correctIndex to client (prevent cheating)
  const safeQuestions = questions.map(({ correctIndex: _ci, explanation: _ex, correctAnswer: _ca, ...q }) => q);

  res.status(200).json({
    success: true,
    data: {
      assessmentId,
      questions: safeQuestions,
      totalQuestions: questions.length,
    },
  });
});

/**
 * POST /api/assessment/submit
 * Evaluates submitted answers against stored questions.
 * Calculates score, generates LLM feedback, and persists results.
 */
export const submitAssessment = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { assessmentId, questions, userAnswers, judgeType, jobDescription } =
    req.body as MCQSubmitPayload;

  if (!assessmentId || !userAnswers) {
    throw createError('assessmentId and userAnswers are required.', 400);
  }

  let storedQuestions: MCQQuestion[] = [];

  // Strategy 1: Check in-memory session cache (guarantees correctIndex even for guests)
  const cached = assessmentSessionCache.get(assessmentId);
  if (cached?.questions && cached.questions.length > 0) {
    storedQuestions = cached.questions;
    console.log(`[Assessment] Retrieved ${storedQuestions.length} questions from in-memory cache for ${assessmentId}`);
  }

  // Strategy 2: Check persistent local store (survives dev server restarts)
  if (storedQuestions.length === 0) {
    const local = getLocalAssessment(assessmentId);
    if (local?.questions && Array.isArray(local.questions) && local.questions.length > 0) {
      storedQuestions = local.questions as MCQQuestion[];
      console.log(`[Assessment] Retrieved ${storedQuestions.length} questions from local store for ${assessmentId}`);
    }
  }

  // Strategy 3: Fetch from Supabase by assessmentId
  if (storedQuestions.length === 0) {
    const { data, error } = await supabaseAdmin
      .from('assessments')
      .select('questions')
      .eq('id', assessmentId)
      .maybeSingle();

    if (!error && data?.questions && Array.isArray(data.questions) && data.questions.length > 0) {
      storedQuestions = data.questions as MCQQuestion[];
      console.log(`[Assessment] Retrieved ${storedQuestions.length} questions from Supabase for ${assessmentId}`);
    }
  }

  // Strategy 4: Fallback to client questions only if neither cache nor DB had it
  if (storedQuestions.length === 0 && Array.isArray(questions) && questions.length > 0) {
    console.warn(`[Assessment] Fallback to client questions for assessment ${assessmentId}`);
    storedQuestions = questions;
  }

  // Defensively resolve/normalise correctIndex
  storedQuestions = storedQuestions.map((q) => {
    const { resolvedIndex, resolvedAnswerText } = resolveQuestionAnswer(q, q.options?.length ?? 4);
    return {
      ...q,
      correctIndex: resolvedIndex,
      correctAnswer: q.correctAnswer ?? resolvedAnswerText,
    };
  });

  // Grade answers
  let correctCount = 0;
  const perQuestionFeedback = storedQuestions.map((q) => {
    const selected = typeof userAnswers[q.id] === 'number' ? userAnswers[q.id] : -1;
    const normalizedCorrect = q.correctIndex;
    const isCorrect = selected === normalizedCorrect;
    if (isCorrect) correctCount++;
    return {
      questionId: q.id,
      questionText: q.question,
      options: q.options,
      isCorrect,
      selectedIndex: selected,
      correctIndex: normalizedCorrect,
      explanation: q.explanation ?? 'No explanation provided.',
      category: q.category ?? 'General',
    };
  });

  const rawScore = Math.round((correctCount / storedQuestions.length) * 100);
  const grade = scoreToGrade(rawScore);

  console.log(`[Assessment] Graded ${assessmentId}: ${correctCount}/${storedQuestions.length} (${rawScore}%, Grade: ${grade})`);

  // Generate LLM feedback on weak areas with safe fallback
  const incorrectTopics = perQuestionFeedback
    .filter((f) => !f.isCorrect)
    .map((f) => f.category ?? 'General')
    .join(', ');

  let llmFeedbackSummary = rawScore >= 90
    ? `Outstanding performance! You scored ${rawScore}% and demonstrated strong mastery.`
    : rawScore >= 70
    ? `Good effort! You scored ${rawScore}%. Review the questions you missed to reinforce your knowledge.`
    : `You scored ${rawScore}%. Spend more time reviewing core principles in the highlighted areas.`;

  let areasOfImprovement: string[] = rawScore >= 90
    ? ['Explore advanced design patterns and system scalability', 'Practice explaining technical trade-offs with peers', 'Keep up-to-date with emerging tools and ecosystem updates']
    : incorrectTopics
    ? [`Focus revision on: ${incorrectTopics}`, 'Build hands-on sample projects to practice these concepts', 'Review relevant technical documentation and official guides']
    : ['Review fundamentals of the target role', 'Practice timed technical assessments', 'Work through real-world architectural scenarios'];

  try {
    const feedbackPrompt = `The candidate scored ${rawScore}% on a ${judgeType} assessment for: "${jobDescription}".
${incorrectTopics ? `Incorrect topics: ${incorrectTopics}.` : 'The candidate answered all questions correctly!'}
Provide 3 specific, actionable improvement recommendations in JSON:
{"areasOfImprovement": ["rec1", "rec2", "rec3"], "llmFeedback": "2-sentence summary"}`;

    const aiFeedback = await invokeAndParse<{
      areasOfImprovement: string[];
      llmFeedback: string;
    }>(
      judgeType === 'technical' ? buildTechInterviewSystemPrompt() : buildHRInterviewSystemPrompt(),
      feedbackPrompt,
      [],
      { temperature: 0.6, maxTokens: 1024 }
    );

    if (aiFeedback?.llmFeedback) llmFeedbackSummary = aiFeedback.llmFeedback;
    if (Array.isArray(aiFeedback?.areasOfImprovement) && aiFeedback.areasOfImprovement.length > 0) {
      areasOfImprovement = aiFeedback.areasOfImprovement;
    }
  } catch (feedbackErr) {
    console.warn('[Assessment] LLM feedback summary generation failed (using fallback):', feedbackErr);
  }

  const result: MCQResult = {
    assessmentId,
    rawScore,
    correctAnswers: correctCount,
    totalQuestions: storedQuestions.length,
    grade,
    perQuestionFeedback,
    llmFeedback: llmFeedbackSummary,
    areasOfImprovement,
  };

  // 1. Persist results to local disk store (instant, durable across restarts)
  saveLocalAssessment({
    id: assessmentId,
    user_id: req.userId || null,
    job_description: jobDescription,
    judge_type: judgeType,
    questions: storedQuestions,
    user_answers: userAnswers,
    raw_score: rawScore,
    total_questions: storedQuestions.length,
    correct_answers: correctCount,
    llm_feedback: {
      feedback: llmFeedbackSummary,
      improvements: areasOfImprovement,
      grade,
    },
    status: 'completed',
    created_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
  });

  // 2. Persist results to Supabase (upsert ensures dashboard and history show it)
  try {
    const updatePayload = {
      user_answers: userAnswers,
      raw_score: rawScore,
      correct_answers: correctCount,
      llm_feedback: {
        feedback: llmFeedbackSummary,
        improvements: areasOfImprovement,
        grade,
      },
      status: 'completed',
      completed_at: new Date().toISOString(),
      ...(req.userId ? { user_id: req.userId } : {}),
    };

    const { data: existing } = await supabaseAdmin
      .from('assessments')
      .select('id')
      .eq('id', assessmentId)
      .maybeSingle();

    if (existing) {
      await supabaseAdmin
        .from('assessments')
        .update(updatePayload)
        .eq('id', assessmentId);
    } else {
      await supabaseAdmin.from('assessments').insert({
        id: assessmentId,
        user_id: req.userId || null,
        job_description: jobDescription,
        judge_type: judgeType,
        questions: storedQuestions,
        total_questions: storedQuestions.length,
        ...updatePayload,
      });
    }
  } catch (persistErr) {
    console.warn('[Assessment] Could not persist completed assessment to Supabase:', persistErr);
  }

  res.status(200).json({ success: true, data: result });
});

/**
 * GET /api/assessment/history
 * Returns assessment history for authenticated user.
 */
export const getAssessmentHistory = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.userId) throw createError('Authentication required.', 401);

  try {
    const { data, error } = await supabaseAdmin
      .from('assessments')
      .select('id, created_at, judge_type, raw_score, total_questions, correct_answers, status, job_description')
      .eq('user_id', req.userId)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(20);

    if (!error && Array.isArray(data) && data.length > 0) {
      res.json({ success: true, data });
      return;
    }
  } catch (sbErr) {
    console.warn('[Assessment] Supabase query failed, falling back to local store:', sbErr);
  }

  // Fallback to local store
  const localHistory = getLocalAssessmentHistory(req.userId);
  res.json({ success: true, data: localHistory });
});

function scoreToGrade(score: number): string {
  if (score >= 97) return 'A+';
  if (score >= 93) return 'A';
  if (score >= 90) return 'A-';
  if (score >= 87) return 'B+';
  if (score >= 83) return 'B';
  if (score >= 80) return 'B-';
  if (score >= 77) return 'C+';
  if (score >= 73) return 'C';
  if (score >= 70) return 'C-';
  if (score >= 60) return 'D';
  return 'F';
}
