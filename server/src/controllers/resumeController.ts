import type { Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/authMiddleware';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { extractTextFromPDF, truncateResumeText } from '../utils/pdfParser';
import { invokeAndParse } from '../services/bedrockService';
import { supabaseAdmin } from '../config/supabase';
import { HR_RESUME_ANALYSIS_PROMPT } from '../utils/hrPrompts';
import { TECH_RESUME_ANALYSIS_PROMPT } from '../utils/techPrompts';
import { buildHRInterviewSystemPrompt } from '../utils/hrPrompts';
import type { ResumeAnalysisResult } from '../types/payload.d';

/**
 * POST /api/resume/analyze
 * Accepts a PDF file upload, extracts text, runs ATS analysis via Bedrock,
 * optionally stores the file in Supabase Storage, and returns the analysis.
 * 
 * Available to both guests (no userId) and authenticated users.
 */
export const analyzeResume = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.file) {
    throw createError('No resume file uploaded.', 400);
  }

  const { jobDescription = '', judgeType = 'hr' } = req.body as {
    jobDescription?: string;
    judgeType?: 'technical' | 'hr';
  };

  // 1. Extract text from PDF
  const resumeText = await extractTextFromPDF(req.file.buffer);
  const truncatedText = truncateResumeText(resumeText);

  // 2. Build the appropriate analysis prompt
  const userPrompt =
    judgeType === 'technical'
      ? TECH_RESUME_ANALYSIS_PROMPT(truncatedText, jobDescription || 'General technical role')
      : HR_RESUME_ANALYSIS_PROMPT(truncatedText, jobDescription || 'General professional role');

  // 3. Query Bedrock
  const analysis = await invokeAndParse<{
    atsScore: number;
    keywordMatches: string[];
    missingKeywords: string[];
    formattingIssues: string[];
    summary: string;
  }>(buildHRInterviewSystemPrompt(), userPrompt, [], { temperature: 0.3 });

  let resumeUrl: string | undefined;

  // 4. Store PDF in Supabase Storage (only for authenticated users)
  if (req.userId) {
    const fileName = `${req.userId}/${Date.now()}_${req.file.originalname.replace(/[^a-z0-9._-]/gi, '_')}`;

    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from('resumes')
      .upload(fileName, req.file.buffer, {
        contentType: 'application/pdf',
        upsert: false,
      });

    if (!uploadError && uploadData) {
      const { data: urlData } = supabaseAdmin.storage.from('resumes').getPublicUrl(fileName);
      resumeUrl = urlData.publicUrl;
    }
  }

  const result: ResumeAnalysisResult = {
    atsScore: Math.min(100, Math.max(0, analysis.atsScore)),
    keywordMatches: analysis.keywordMatches ?? [],
    missingKeywords: analysis.missingKeywords ?? [],
    formattingIssues: analysis.formattingIssues ?? [],
    summary: analysis.summary ?? '',
    resumeText: truncatedText,
    resumeUrl,
  };

  res.status(200).json({ success: true, data: result });
});

/**
 * GET /api/resume/history
 * Returns stored resume analyses for the authenticated user.
 */
export const getResumeHistory = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.userId) throw createError('Authentication required.', 401);

  const { data, error } = await supabaseAdmin
    .from('assessments')
    .select('id, created_at, judge_type, raw_score, resume_url')
    .eq('user_id', req.userId)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) throw createError(error.message, 500);

  res.json({ success: true, data: data ?? [] });
});
