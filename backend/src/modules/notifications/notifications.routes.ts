import { Router } from 'express';
import { body } from 'express-validator';
import { NotificationsController } from './notifications.controller';
import { protect, adminOnly } from '../../shared/middleware/auth.middleware';
import validate from '../../shared/middleware/validate.middleware';

const router = Router();

// SSE stream — does its own token auth (header or ?token=), so no `protect` here.
router.get('/stream', NotificationsController.stream);

// Authenticated user routes
router.get('/', protect, NotificationsController.list);
router.patch('/read-all', protect, NotificationsController.markAllRead);
router.patch('/:id/read', protect, NotificationsController.markRead);

// Admin: create / broadcast a notification
router.post('/',
  protect, adminOnly,
  body('title').trim().notEmpty().withMessage('Title is required.'),
  body('userId').optional({ nullable: true }).isInt().withMessage('userId must be an integer.'),
  validate,
  NotificationsController.create
);

export default router;
