// ============================================================
// Frontend Assessment TypeScript Types
// ============================================================

export type JudgeType = 'technical' | 'hr';

export interface MCQOption {
  index: number;
  text: string;
}

export interface MCQQuestion {
  id: string;
  question: string;
  options: [string, string, string, string];
  category?: string;
}

export interface MCQQuestionWithAnswer extends MCQQuestion {
  correctIndex: number;
  explanation: string;
}

export interface AssessmentSession {
  assessmentId: string;
  questions: MCQQuestion[];
  totalQuestions: number;
  currentIndex: number;
  userAnswers: Record<string, number>;      // questionId → selectedOptionIndex
  hasReachedEnd: boolean;
  isSubmitting: boolean;
  isCompleted: boolean;
}

export interface PerQuestionFeedback {
  questionId: string;
  questionText?: string;
  options?: string[];
  isCorrect: boolean;
  selectedIndex: number;
  correctIndex: number;
  explanation: string;
  category?: string;
}

export interface AssessmentResult {
  assessmentId: string;
  rawScore: number;
  correctAnswers: number;
  totalQuestions: number;
  grade: string;
  perQuestionFeedback: PerQuestionFeedback[];
  llmFeedback: string;
  areasOfImprovement: string[];
}

export interface AssessmentHistoryItem {
  id: string;
  created_at: string;
  judge_type: JudgeType;
  raw_score: number;
  total_questions: number;
  correct_answers: number;
  status: string;
  job_description: string;
}
