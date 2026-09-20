import { Router } from 'express';
import { authMiddleware, optionalAuthMiddleware } from '../middleware/authMiddleware';
import {
  generateAssessment,
  submitAssessment,
  getAssessmentHistory,
} from '../controllers/assessmentController';

const router = Router();

// POST /api/assessment/generate — auth optional (guests can try, not persisted)
router.post('/generate', optionalAuthMiddleware, generateAssessment);

// POST /api/assessment/submit — auth optional
router.post('/submit', optionalAuthMiddleware, submitAssessment);

// GET /api/assessment/history — auth required
router.get('/history', authMiddleware, getAssessmentHistory);

export default router;
