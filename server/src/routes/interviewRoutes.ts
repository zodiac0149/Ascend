import { Router } from 'express';
import { authMiddleware, optionalAuthMiddleware } from '../middleware/authMiddleware';
import { uploadAudio } from '../middleware/uploadMiddleware';
import {
  startInterview,
  submitAnswer,
  completeInterview,
  getInterviewHistory,
  getInterviewResult,
  transcribeAudioController,
} from '../controllers/interviewController';

const router = Router();

// POST /api/interview/start — auth optional
router.post('/start', optionalAuthMiddleware, startInterview);

// POST /api/interview/answer — auth optional
router.post('/answer', optionalAuthMiddleware, submitAnswer);

// POST /api/interview/complete — auth optional
router.post('/complete', optionalAuthMiddleware, completeInterview);

// POST /api/interview/transcribe — audio STT transcription via Deepgram Nova-2
router.post('/transcribe', uploadAudio, optionalAuthMiddleware, transcribeAudioController);

// GET /api/interview/history — auth required
router.get('/history', authMiddleware, getInterviewHistory);

// GET /api/interview/:sessionId/result — auth required
router.get('/:sessionId/result', authMiddleware, getInterviewResult);

export default router;
