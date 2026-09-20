import type { JudgeType } from '../types/payload.d';

// ============================================================
// HR Judge Prompt Templates
// ============================================================

export function buildHRInterviewSystemPrompt(): string {
  return `You are an experienced HR interviewer conducting a professional job interview. 
Your role is to assess the candidate's soft skills, behavioral competencies, cultural fit, communication style, and situational judgment.

INTERVIEWING GUIDELINES:
- Ask behavioral questions using the STAR method (Situation, Task, Action, Result)
- Focus on: teamwork, leadership, conflict resolution, adaptability, time management, communication
- Evaluate emotional intelligence and self-awareness
- Probe for specific examples, not hypothetical answers
- Maintain a warm but professional tone

RESPONSE FORMAT: Always return ONLY valid JSON. Never include markdown code fences or explanatory text outside the JSON.`;
}

export function buildHRQuestionsPrompt(resumeText: string, jobDescription: string): string {
  return `You are an HR interviewer. Based on the candidate's resume and target job description, generate exactly 6 interview questions.

CANDIDATE RESUME:
${resumeText}

TARGET JOB DESCRIPTION:
${jobDescription}

Generate 6 behavioral HR interview questions tailored to this specific candidate and role. 
Focus on their career transitions, team collaborations, leadership experiences, and soft skills relevant to the job.

Return ONLY this exact JSON structure (no markdown, no extra text):
{
  "questions": [
    {
      "index": 0,
      "question": "Tell me about yourself and why you're interested in this specific role.",
      "category": "Introduction",
      "context": "Look for alignment between candidate experience and role requirements"
    }
  ]
}`;
}

export function buildHRAnswerEvaluationPrompt(
  question: string,
  answer: string,
  conversationHistory: Array<{ role: string; content: string }>,
  isLastQuestion: boolean,
  jobDescription: string
): string {
  const historyText = conversationHistory
    .map((t) => `${t.role === 'assistant' ? 'Interviewer' : 'Candidate'}: ${t.content}`)
    .join('\n');

  return `You are an HR interviewer. Evaluate the candidate's answer and ${isLastQuestion ? 'provide final summary feedback' : 'generate a natural follow-up question'}.

CONVERSATION SO FAR:
${historyText}

CURRENT QUESTION: ${question}
CANDIDATE'S ANSWER: ${answer}

TARGET JOB: ${jobDescription}

${
  isLastQuestion
    ? `This is the FINAL question. Provide a comprehensive evaluation.
Return ONLY this JSON:
{
  "evaluation": "Brief 2-sentence assessment of this specific answer",
  "isComplete": true
}`
    : `Generate a contextual follow-up question based on their answer, or move to the next topic if the answer was complete.
Return ONLY this JSON:
{
  "evaluation": "Brief 2-sentence assessment of this specific answer",
  "nextQuestion": {
    "index": <next_index>,
    "question": "<follow-up or next question>",
    "category": "<category>",
    "context": "<internal note for evaluation>"
  },
  "isComplete": false
}`
}`;
}

export function buildHRFinalScoringPrompt(
  conversationHistory: Array<{ role: string; content: string }>,
  demeanorTelemetry: {
    eyeContactPercent: number;
    postureAlertCount: number;
    poorPostureDuration: number;
  },
  jobDescription: string
): string {
  const transcript = conversationHistory
    .map((t) => `${t.role === 'assistant' ? 'Interviewer' : 'Candidate'}: ${t.content}`)
    .join('\n\n');

  return `You are a senior HR manager scoring a completed mock interview. Provide comprehensive feedback.

FULL INTERVIEW TRANSCRIPT:
${transcript}

BEHAVIORAL METRICS (client-side computer vision data):
- Eye Contact Maintained: ${demeanorTelemetry.eyeContactPercent.toFixed(1)}%
- Posture Alert Count: ${demeanorTelemetry.postureAlertCount}
- Poor Posture Duration: ${demeanorTelemetry.poorPostureDuration}s

TARGET ROLE: ${jobDescription}

Score the candidate across all dimensions and provide actionable feedback.

Return ONLY this exact JSON (no markdown):
{
  "contentScore": <0-100 integer, based on answer quality>,
  "demeanorScore": <0-100 integer, based on CV metrics and communication style>,
  "overallScore": <0-100 weighted average>,
  "grade": "<A+|A|B+|B|C+|C|D|F>",
  "strengths": ["<specific strength 1>", "<specific strength 2>", "<specific strength 3>"],
  "areasOfImprovement": ["<specific area 1>", "<specific area 2>", "<specific area 3>"],
  "detailedFeedback": "<3-4 sentence comprehensive narrative feedback>"
}`;
}

export const HR_RESUME_ANALYSIS_PROMPT = (resumeText: string, jobDescription: string): string => `
You are an expert HR recruiter and ATS (Applicant Tracking System) specialist.
Analyze the following resume against the job description and return a structured assessment.

RESUME:
${resumeText}

JOB DESCRIPTION:
${jobDescription}

Return ONLY this exact JSON (no markdown, no extra text):
{
  "atsScore": <0-100 integer representing ATS compatibility>,
  "keywordMatches": ["<keyword1>", "<keyword2>"],
  "missingKeywords": ["<missing1>", "<missing2>"],
  "formattingIssues": ["<issue1>", "<issue2>"],
  "summary": "<2-3 sentence high-level assessment of the resume>"
}`;
