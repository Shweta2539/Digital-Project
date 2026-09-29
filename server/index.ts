import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import morgan from 'morgan';

import scanRouter from './routes/scan';
import companiesRouter from './routes/companies';
import reportsRouter from './routes/reports';
import adminRouter from './routes/admin';

const app = express();
const PORT = parseInt(process.env.PORT || '5000', 10);

// ─── Security Middleware ────────────────────────────────────────────────────────

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  }),
);

// ─── Request Logging ────────────────────────────────────────────────────────────

app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// ─── Body Parsing ───────────────────────────────────────────────────────────────

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Rate Limiting ──────────────────────────────────────────────────────────────

// Strict limit on AI scan endpoint (12 req/min per IP)
const scanRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 12,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many scan requests. Maximum 12 scans per minute per IP. Please wait and try again.',
    code: 'RATE_LIMIT_EXCEEDED',
  },
});

// General API rate limiter (100 req/min)
const generalRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many requests. Please slow down.',
    code: 'RATE_LIMIT_EXCEEDED',
  },
});

app.use('/api/', generalRateLimiter);
app.use('/api/scan/analyze', scanRateLimiter);

// ─── Routes ─────────────────────────────────────────────────────────────────────

app.use('/api/scan', scanRouter);
app.use('/api/companies', companiesRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/admin', adminRouter);
app.use('/api/employer', adminRouter); // employer/verify route is in admin router

// ─── Health Check ───────────────────────────────────────────────────────────────

app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    service: 'VeriJob API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// ─── 404 Handler ────────────────────────────────────────────────────────────────

app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Endpoint not found.' });
});

// ─── Global Error Handler ────────────────────────────────────────────────────────

app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[Server Error]', err.message || err);

  const status = err.status || err.statusCode || 500;
  const message =
    process.env.NODE_ENV === 'production'
      ? 'An internal server error occurred.'
      : err.message || 'Unknown error';

  res.status(status).json({
    error: message,
    code: err.code || 'INTERNAL_ERROR',
  });
});

// ─── Start Server ────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`✅ VeriJob API Server running on http://localhost:${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   Gemini AI: ${process.env.GEMINI_API_KEY ? 'Configured ✓' : 'MISSING ✗'}`);
  console.log(`   Supabase: ${process.env.SUPABASE_URL ? 'Configured ✓' : 'MISSING ✗'}`);
});

export default app;
