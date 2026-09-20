import api from './apiConfig';
import type { JudgeType, MCQQuestion, AssessmentResult } from '@/types/assessment';

export interface GenerateAssessmentResponse {
  assessmentId: string;
  questions: MCQQuestion[];
  totalQuestions: number;
}

export async function generateAssessment(payload: {
  resumeText: string;
  jobDescription: string;
  judgeType: JudgeType;
  questionCount?: number;
}): Promise<GenerateAssessmentResponse> {
  const res = await api.post<{ success: boolean; data: GenerateAssessmentResponse }>(
    '/assessment/generate',
    payload
  );
  return res.data.data!;
}

export async function submitAssessment(payload: {
  assessmentId: string;
  questions: MCQQuestion[];
  userAnswers: Record<string, number>;
  judgeType: JudgeType;
  jobDescription: string;
}): Promise<AssessmentResult> {
  const res = await api.post<{ success: boolean; data: AssessmentResult }>(
    '/assessment/submit',
    payload
  );
  return res.data.data!;
}

export async function getAssessmentHistory() {
  const res = await api.get('/assessment/history');
  return res.data.data;
}
