import { Router } from 'express';
import { uploadResume } from '../middleware/uploadMiddleware';
import { optionalAuthMiddleware } from '../middleware/authMiddleware';
import { analyzeResume, getResumeHistory } from '../controllers/resumeController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

// POST /api/resume/analyze — guest + auth
router.post('/analyze', optionalAuthMiddleware, uploadResume, analyzeResume);

// GET /api/resume/history — auth required
router.get('/history', authMiddleware, getResumeHistory);

export default router;
