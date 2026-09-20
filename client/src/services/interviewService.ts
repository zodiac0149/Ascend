import api from './apiConfig';
import type {
  InterviewQuestion,
  ConversationTurn,
  DemeanorTelemetry,
  InterviewFeedback,
  JudgeType,
  ResumeAnalysis,
} from '@/types/interview';

// ── Resume ─────────────────────────────────────────────────────────────────

export async function analyzeResume(
  file: File,
  jobDescription?: string,
  judgeType: JudgeType = 'hr'
): Promise<ResumeAnalysis> {
  const form = new FormData();
  form.append('resume', file);
  if (jobDescription) form.append('jobDescription', jobDescription);
  form.append('judgeType', judgeType);

  const res = await api.post<{ success: boolean; data: ResumeAnalysis }>(
    '/resume/analyze',
    form,
    { headers: { 'Content-Type': 'multipart/form-data' } }
  );
  return res.data.data!;
}

// ── Interview ───────────────────────────────────────────────────────────────

export interface StartInterviewResponse {
  sessionId: string;
  questions: InterviewQuestion[];
  firstQuestion: InterviewQuestion;
  audioDataUri?: string;
  totalQuestions: number;
}

export async function startInterview(payload: {
  resumeText: string;
  jobDescription: string;
  judgeType: JudgeType;
}): Promise<StartInterviewResponse> {
  const res = await api.post<{ success: boolean; data: StartInterviewResponse }>(
    '/interview/start',
    payload
  );
  return res.data.data!;
}

export interface AnswerResponse {
  evaluation?: string;
  nextQuestion?: InterviewQuestion;
  audioDataUri?: string;
  isComplete: boolean;
}

export async function submitAnswer(payload: {
  sessionId: string;
  questionIndex: number;
  question: string;
  answerText: string;
  conversationHistory: ConversationTurn[];
  judgeType: JudgeType;
  isLastQuestion: boolean;
  jobDescription: string;
}): Promise<AnswerResponse> {
  const res = await api.post<{ success: boolean; data: AnswerResponse }>(
    '/interview/answer',
    payload
  );
  return res.data.data!;
}

export async function completeInterview(payload: {
  sessionId: string;
  conversationHistory: ConversationTurn[];
  demeanorTelemetry: DemeanorTelemetry;
  judgeType: JudgeType;
  jobDescription: string;
  resumeText: string;
}): Promise<InterviewFeedback> {
  const res = await api.post<{ success: boolean; data: InterviewFeedback }>(
    '/interview/complete',
    payload
  );
  return res.data.data!;
}

export async function getInterviewHistory() {
  const res = await api.get('/interview/history');
  return res.data.data;
}

export async function getInterviewResult(sessionId: string) {
  const res = await api.get(`/interview/${sessionId}/result`);
  return res.data.data;
}
