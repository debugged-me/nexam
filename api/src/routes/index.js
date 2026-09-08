import { Router } from 'express';
import healthRouter from './health.js';
import authRouter from './auth.js';
import aiRouter from './ai.js';
import materialsRouter from './materials.js';
import examsRouter from './exams.js';
import scansRouter from './scans.js';
import analyticsRouter from './analytics.js';
import aiEvalRouter from './ai_eval.js';

const router = Router();

/**
 * All API routes are mounted under /api.
 * Add new route groups here: e.g. router.use('/subjects', subjectsRouter);
 */
router.use('/health', healthRouter);
router.use('/auth', authRouter);
router.use('/ai', aiRouter);
router.use('/materials', materialsRouter);
router.use('/exams', examsRouter);
router.use('/scans', scansRouter);
router.use('/analytics', analyticsRouter);
router.use('/ai-eval', aiEvalRouter);

export default router;
