import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { env } from './config/env';
import { errorHandler } from './middleware/errorHandler';
import resumeRoutes from './routes/resumeRoutes';
import assessmentRoutes from './routes/assessmentRoutes';
import interviewRoutes from './routes/interviewRoutes';
import { getMe, verifyToken } from './controllers/authController';

const app = express();

// ── Security Middleware ───────────────────────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || origin === env.CLIENT_ORIGIN || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'));
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })
);

// ── Rate Limiting ─────────────────────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests. Please try again later.' },
});

const aiLimiter = rateLimit({
  windowMs: 60 * 1000,       // 1 minute
  max: 10,                    // 10 AI calls per minute per IP
  message: { success: false, error: 'AI rate limit exceeded. Please wait a moment.' },
});

app.use(globalLimiter);

// ── Body Parsers ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Health Check ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    environment: env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

// ── Auth Endpoints ────────────────────────────────────────────────────────────
app.get('/api/auth/me', getMe);
app.post('/api/auth/verify', verifyToken);

// ── Feature Routes (AI-rate-limited) ─────────────────────────────────────────
app.use('/api/resume',     aiLimiter, resumeRoutes);
app.use('/api/assessment', aiLimiter, assessmentRoutes);
app.use('/api/interview',  aiLimiter, interviewRoutes);

// ── 404 Handler ───────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'Route not found.' });
});

// ── Global Error Handler ──────────────────────────────────────────────────────
app.use(errorHandler);

// ── Start Server ──────────────────────────────────────────────────────────────
app.listen(env.PORT, () => {
  console.log(`\n🚀 Ascend Server running on port ${env.PORT}`);
  console.log(`   Environment : ${env.NODE_ENV}`);
  console.log(`   CORS Origin : ${env.CLIENT_ORIGIN}`);
  console.log(`   Bedrock Model: ${env.BEDROCK_MODEL_ID}\n`);
});

export default app;
