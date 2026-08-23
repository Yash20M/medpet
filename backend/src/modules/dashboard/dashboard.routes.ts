import { Router } from 'express';
import { DashboardController } from './dashboard.controller';
import { protect, adminOnly } from '../../shared/middleware/auth.middleware';

const router = Router();

router.get('/summary', protect, adminOnly, DashboardController.summary);

export default router;
