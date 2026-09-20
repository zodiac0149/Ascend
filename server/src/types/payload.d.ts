// ============================================================
// Shared Payload TypeScript Declarations (Server ↔ Client contracts)
// ============================================================

export type JudgeType = 'technical' | 'hr';
export type SessionStatus = 'in_progress' | 'completed' | 'abandoned';

// ── Resume ───────────────────────────────────────────────────

export interface ResumeUploadPayload {
  file: Express.Multer.File;
  userId?: string;
}

export interface ResumeAnalysisResult {
  atsScore: number;              // 0-100
  keywordMatches: string[];
  missingKeywords: string[];
  formattingIssues: string[];
  summary: string;
  resumeText: string;
  resumeUrl?: string;
}

// ── Interview ─────────────────────────────────────────────────

export interface InterviewStartPayload {
  resumeText: string;
  jobDescription: string;
  judgeType: JudgeType;
  sessionId?: string;
}

export interface InterviewQuestion {
  index: number;
  question: string;
  context?: string;       // Optional follow-up context for AI judge
  category?: string;      // e.g., "System Design", "Behavioral"
}

export interface ConversationTurn {
  role: 'assistant' | 'user';
  content: string;
  questionIndex?: number;
  timestamp: string;
}

export interface AnswerSubmitPayload {
  sessionId: string;
  questionIndex: number;
  question: string;
  answerText: string;
  conversationHistory: ConversationTurn[];
  judgeType: JudgeType;
  isLastQuestion: boolean;
}

export interface AnswerEvaluationResult {
  nextQuestion?: InterviewQuestion;
  evaluation?: string;           // Brief AI assessment of the last answer
  isComplete: boolean;
}

export interface DemeanorTelemetry {
  eyeContactLossCount: number;
  poorPostureDuration: number;       // seconds
  postureAlertCount: number;
  gazeOffScreenDuration: number;     // seconds
  eyeContactPercent: number;         // 0-100
  totalDurationSeconds: number;
}

export interface InterviewCompletePayload {
  sessionId: string;
  conversationHistory: ConversationTurn[];
  demeanorTelemetry: DemeanorTelemetry;
  judgeType: JudgeType;
  jobDescription: string;
  resumeText: string;
}

export interface InterviewFeedback {
  contentScore: number;            // 0-100
  demeanorScore: number;           // 0-100
  overallScore: number;            // 0-100
  grade: string;                   // A+, A, B+, ...
  strengths: string[];
  areasOfImprovement: string[];
  detailedFeedback: string;
  eyeContactPercent: number;
  postureAlerts: number;
}

// ── Assessment (MCQ) ─────────────────────────────────────────

export interface MCQGeneratePayload {
  resumeText: string;
  jobDescription: string;
  judgeType: JudgeType;
  questionCount?: number;           // default: 10
}

export interface MCQQuestion {
  id: string;
  question: string;
  options: [string, string, string, string] | string[];
  correctIndex: number;             // 0-3
  correctAnswer?: string;
  correctOptionLetter?: string;
  explanation: string;
  category?: string;
}

export interface MCQSubmitPayload {
  assessmentId: string;
  questions: MCQQuestion[];
  userAnswers: Record<string, number>;   // questionId → selectedIndex
  judgeType: JudgeType;
  jobDescription: string;
}

export interface MCQResult {
  assessmentId: string;
  rawScore: number;                 // 0-100
  correctAnswers: number;
  totalQuestions: number;
  grade: string;
  perQuestionFeedback: Array<{
    questionId: string;
    questionText?: string;
    options?: string[];
    isCorrect: boolean;
    selectedIndex: number;
    correctIndex: number;
    explanation: string;
    category?: string;
  }>;
  llmFeedback: string;
  areasOfImprovement: string[];
}

// ── Generic API response wrapper ─────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
