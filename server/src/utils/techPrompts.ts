// ============================================================
// Technical Judge Prompt Templates
// ============================================================

export function buildTechInterviewSystemPrompt(): string {
  return `You are a senior technical interviewer at a top-tier technology company.
Your role is to rigorously assess the candidate's technical knowledge, coding ability, system design skills, and problem-solving approach.

INTERVIEWING GUIDELINES:
- Ask questions about algorithms, data structures, system design, and tech-stack specific knowledge
- Probe depth of understanding, not just surface-level recall
- Ask follow-up questions to test conceptual understanding
- Evaluate code quality, scalability thinking, and trade-off awareness
- Be direct and professional; do not give hints unless the candidate is completely stuck

RESPONSE FORMAT: Always return ONLY valid JSON. Never include markdown code fences or explanatory text outside the JSON.`;
}

export function buildTechQuestionsPrompt(resumeText: string, jobDescription: string): string {
  return `You are a technical interviewer. Based on the candidate's resume and job requirements, generate exactly 6 technical interview questions.

CANDIDATE RESUME:
${resumeText}

TARGET JOB DESCRIPTION:
${jobDescription}

Generate 6 technical questions that:
1. Are directly relevant to the tech stack mentioned in the job description
2. Progress from foundational to advanced
3. Include at least one system design question
4. Include at least one algorithm/data structure question
5. Test skills the candidate CLAIMS to have on their resume

Return ONLY this exact JSON structure (no markdown, no extra text):
{
  "questions": [
    {
      "index": 0,
      "question": "Walk me through how you'd design a scalable URL shortener service. What components would you include?",
      "category": "System Design",
      "context": "Evaluate understanding of scalability, hashing, databases, and CDN"
    }
  ]
}`;
}

export function buildTechAnswerEvaluationPrompt(
  question: string,
  answer: string,
  conversationHistory: Array<{ role: string; content: string }>,
  isLastQuestion: boolean,
  jobDescription: string
): string {
  const historyText = conversationHistory
    .map((t) => `${t.role === 'assistant' ? 'Interviewer' : 'Candidate'}: ${t.content}`)
    .join('\n');

  return `You are a technical interviewer. Evaluate the candidate's answer and ${isLastQuestion ? 'provide a final summary' : 'decide on a follow-up question or move forward'}.

CONVERSATION SO FAR:
${historyText}

CURRENT QUESTION: ${question}
CANDIDATE'S ANSWER: ${answer}

JOB REQUIREMENTS: ${jobDescription}

Evaluate technical accuracy, depth of understanding, and communication clarity.

${
  isLastQuestion
    ? `This is the FINAL question. Return ONLY this JSON:
{
  "evaluation": "Brief 2-sentence technical assessment of this answer",
  "isComplete": true
}`
    : `Return ONLY this JSON:
{
  "evaluation": "Brief 2-sentence technical assessment of this answer",
  "nextQuestion": {
    "index": <next_index>,
    "question": "<next technical question or probing follow-up>",
    "category": "<Algorithm|System Design|Language Specific|Database|DevOps|Behavioral>",
    "context": "<internal evaluation note>"
  },
  "isComplete": false
}`
}`;
}

export function buildTechFinalScoringPrompt(
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

  return `You are a principal engineer scoring a completed technical mock interview. Provide comprehensive, actionable feedback.

FULL INTERVIEW TRANSCRIPT:
${transcript}

PRESENTATION METRICS:
- Eye Contact Maintained: ${demeanorTelemetry.eyeContactPercent.toFixed(1)}%
- Posture Alert Count: ${demeanorTelemetry.postureAlertCount}
- Poor Posture Duration: ${demeanorTelemetry.poorPostureDuration}s

JOB REQUIREMENTS: ${jobDescription}

Return ONLY this exact JSON (no markdown):
{
  "contentScore": <0-100 integer, weighted on technical accuracy and depth>,
  "demeanorScore": <0-100 integer, based on CV metrics>,
  "overallScore": <0-100 weighted: 80% content + 20% demeanor>,
  "grade": "<A+|A|B+|B|C+|C|D|F>",
  "strengths": ["<technical strength 1>", "<strength 2>", "<strength 3>"],
  "areasOfImprovement": [
    "Brush up on <specific topic> — you described X but missed Y",
    "<specific improvement area 2>",
    "<specific improvement area 3>"
  ],
  "detailedFeedback": "<3-4 sentence technical narrative with specific observations>"
}`;
}

export function buildTechMCQPrompt(
  resumeText: string,
  jobDescription: string,
  count: number,
  judgeType: 'technical' | 'hr' = 'technical'
): string {
  const isTechnical = judgeType === 'technical';
  const roleDescription = isTechnical
    ? 'technical skills, coding principles, architecture, tools, and domain knowledge'
    : 'HR competencies, behavioral scenarios, situational judgment, and workplace communication';

  return `You are an expert ${isTechnical ? 'technical' : 'HR & talent'} assessment designer creating an accurate, high-quality skills test for a candidate.

CANDIDATE RESUME:
${resumeText}

JOB DESCRIPTION:
${jobDescription}

Generate exactly ${count} multiple-choice questions that test ${roleDescription} directly relevant to this role.

CRITICAL RULES FOR ACCURACY AND CONSISTENCY:
1. Each question must have exactly 4 plausible, distinct options.
2. Exactly ONE option must be factually correct.
3. "correctAnswer": Must be the EXACT, word-for-word string of the correct option as written in the "options" array.
4. "correctIndex": Must be the 0-based integer index of that option in the "options" array:
   - 0 if the first option is correct
   - 1 if the second option is correct
   - 2 if the third option is correct
   - 3 if the fourth option is correct
5. "correctOptionLetter": Must be "A", "B", "C", or "D" corresponding to correctIndex (0=A, 1=B, 2=C, 3=D).
6. "explanation": Clearly state why this answer is correct and why the alternatives are not.
7. Double check: Ensure options[correctIndex] matches correctAnswer exactly before returning.

Return ONLY this exact JSON (no markdown code blocks, no extra text):
{
  "questions": [
    {
      "id": "q1",
      "question": "<clear, unambiguous question>",
      "options": ["<option A>", "<option B>", "<option C>", "<option D>"],
      "correctAnswer": "<exact string matching one of the options>",
      "correctIndex": 0,
      "correctOptionLetter": "A",
      "explanation": "<detailed explanation of why this option is correct>",
      "category": "<category>"
    }
  ]
}`;
}

export const TECH_RESUME_ANALYSIS_PROMPT = (resumeText: string, jobDescription: string): string => `
You are a senior technical recruiter and ATS specialist. Analyze this technical resume against the job requirements.

RESUME:
${resumeText}

JOB DESCRIPTION:
${jobDescription}

Return ONLY this exact JSON (no markdown, no extra text):
{
  "atsScore": <0-100 integer>,
  "keywordMatches": ["<matched tech keyword 1>", "<matched tech keyword 2>"],
  "missingKeywords": ["<required skill not on resume 1>", "<missing skill 2>"],
  "formattingIssues": ["<formatting issue 1>"],
  "summary": "<2-3 sentence technical assessment of the resume>"
}`;
