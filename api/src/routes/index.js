import { Router } from 'express';
import healthRouter from './health.js';
import authRouter from './auth.js';
import aiRouter from './ai.js';
import materialsRouter from './materials.js';

const router = Router();

/**
 * All API routes are mounted under /api.
 * Add new route groups here: e.g. router.use('/subjects', subjectsRouter);
 */
router.use('/health', healthRouter);
router.use('/auth', authRouter);
router.use('/ai', aiRouter);
router.use('/materials', materialsRouter);

export default router;
