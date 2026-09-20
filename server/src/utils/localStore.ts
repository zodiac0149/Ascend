import fs from 'fs';
import path from 'path';

const DATA_DIR = path.resolve(__dirname, '../../data');
const ASSESSMENTS_FILE = path.join(DATA_DIR, 'assessments.json');
const INTERVIEWS_FILE = path.join(DATA_DIR, 'interviews.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (err) {
    console.warn('[LocalStore] Could not create data directory:', err);
  }
}

function readJSON<T>(filePath: string): Record<string, T> {
  try {
    if (!fs.existsSync(filePath)) return {};
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as Record<string, T>;
  } catch (err) {
    console.warn(`[LocalStore] Failed to read ${filePath}:`, err);
    return {};
  }
}

function writeJSON<T>(filePath: string, data: Record<string, T>): void {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.warn(`[LocalStore] Failed to write ${filePath}:`, err);
  }
}

// ── Assessment Store ──────────────────────────────────────────────────────────

export interface StoredAssessmentRecord {
  id: string;
  user_id?: string | null;
  job_description: string;
  judge_type: string;
  resume_text?: string;
  questions: any[];
  user_answers?: Record<string, number>;
  raw_score?: number | null;
  total_questions: number;
  correct_answers?: number;
  llm_feedback?: any;
  status: string;
  created_at: string;
  completed_at?: string;
}

export function saveLocalAssessment(assessment: StoredAssessmentRecord): void {
  const store = readJSON<StoredAssessmentRecord>(ASSESSMENTS_FILE);
  store[assessment.id] = {
    ...store[assessment.id],
    ...assessment,
  };
  writeJSON(ASSESSMENTS_FILE, store);
}

export function getLocalAssessment(id: string): StoredAssessmentRecord | null {
  const store = readJSON<StoredAssessmentRecord>(ASSESSMENTS_FILE);
  return store[id] ?? null;
}

export function getLocalAssessmentHistory(userId?: string): StoredAssessmentRecord[] {
  const store = readJSON<StoredAssessmentRecord>(ASSESSMENTS_FILE);
  const list = Object.values(store);

  // If userId is provided, return items matching userId (or all if no userId)
  const filtered = userId
    ? list.filter((a) => a.user_id === userId || !a.user_id)
    : list;

  return filtered
    .filter((a) => a.status === 'completed')
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

// ── Interview Store ──────────────────────────────────────────────────────────

export interface StoredInterviewRecord {
  id: string;
  user_id?: string | null;
  job_description: string;
  judge_type: string;
  overall_score?: number | null;
  content_score?: number | null;
  demeanor_score?: number | null;
  status: string;
  created_at: string;
  completed_at?: string;
}

export function saveLocalInterview(interview: StoredInterviewRecord): void {
  const store = readJSON<StoredInterviewRecord>(INTERVIEWS_FILE);
  store[interview.id] = {
    ...store[interview.id],
    ...interview,
  };
  writeJSON(INTERVIEWS_FILE, store);
}

export function getLocalInterviewHistory(userId?: string): StoredInterviewRecord[] {
  const store = readJSON<StoredInterviewRecord>(INTERVIEWS_FILE);
  const list = Object.values(store);

  const filtered = userId
    ? list.filter((i) => i.user_id === userId || !i.user_id)
    : list;

  return filtered
    .filter((i) => i.status === 'completed')
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}
