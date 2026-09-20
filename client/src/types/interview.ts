// ============================================================
// Frontend Interview TypeScript Types
// ============================================================

export type JudgeType = 'technical' | 'hr';

export interface InterviewQuestion {
  index: number;
  question: string;
  category?: string;
  context?: string;
}

export interface ConversationTurn {
  role: 'assistant' | 'user';
  content: string;
  questionIndex?: number;
  timestamp: string;
}

export interface DemeanorTelemetry {
  eyeContactLossCount: number;
  poorPostureDuration: number;        // seconds
  postureAlertCount: number;
  gazeOffScreenDuration: number;      // seconds
  eyeContactPercent: number;          // 0-100
  totalDurationSeconds: number;
}

export interface InterviewSession {
  sessionId: string;
  judgeType: JudgeType;
  jobDescription: string;
  resumeText: string;
  questions: InterviewQuestion[];
  currentQuestionIndex: number;
  conversationHistory: ConversationTurn[];
  demeanorTelemetry: DemeanorTelemetry;
  isAudioPlaying: boolean;
  isListening: boolean;
  transcript: string;                 // live STT transcript
  savedTranscript: string;            // committed answer text
  phase: InterviewPhase;
  startTime: number;                  // Date.now() at start
}

export type InterviewPhase =
  | 'idle'
  | 'initializing'
  | 'speaking'          // AI playing TTS audio
  | 'listening'         // User speaking, STT active
  | 'processing'        // Backend evaluating answer
  | 'completed';

export interface PostureAlert {
  id: string;
  type: 'eye_contact' | 'posture' | 'out_of_frame';
  message: string;
  timestamp: number;
}

export interface CVMetrics {
  isLookingAtCamera: boolean;
  isGoodPosture: boolean;
  isInFrame: boolean;
  eyeContactLossSeconds: number;
  postureAlertCount: number;
}

export interface InterviewFeedback {
  contentScore: number;
  demeanorScore: number;
  overallScore: number;
  grade: string;
  strengths: string[];
  areasOfImprovement: string[];
  detailedFeedback: string;
  eyeContactPercent: number;
  postureAlerts: number;
}

export interface InterviewHistoryItem {
  id: string;
  created_at: string;
  judge_type: JudgeType;
  overall_score: number;
  content_score: number;
  demeanor_score: number;
  status: string;
  job_description: string;
}

export interface ResumeAnalysis {
  atsScore: number;
  keywordMatches: string[];
  missingKeywords: string[];
  formattingIssues: string[];
  summary: string;
  resumeText: string;
  resumeUrl?: string;
}
