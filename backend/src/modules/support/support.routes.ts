import { Router } from 'express';
import { SupportController } from './support.controller';
import { createTicketValidator, createMessageValidator, setStatusValidator } from './support.validator';
import { protect, adminOnly } from '../../shared/middleware/auth.middleware';
import validate from '../../shared/middleware/validate.middleware';

const router = Router();

// Registered before `protect` — EventSource can't set an Authorization header,
// so this route resolves the token from ?token= itself and checks the role.
router.get('/admin/stream', SupportController.adminStream);

router.use(protect);

// ─── Customer ────────────────────────────────────────────────────────────
router.get('/tickets', SupportController.listTickets);
router.post('/tickets', createTicketValidator, validate, SupportController.createTicket);
router.get('/tickets/:id', SupportController.getTicket);
router.post('/tickets/:id/messages', createMessageValidator, validate, SupportController.addMessage);
router.patch('/tickets/:id/read', SupportController.markRead);

// ─── Admin ───────────────────────────────────────────────────────────────
router.get('/admin/tickets', adminOnly, SupportController.adminListTickets);
router.get('/admin/tickets/:id', adminOnly, SupportController.adminGetTicket);
router.post('/admin/tickets/:id/messages', adminOnly, createMessageValidator, validate, SupportController.adminAddMessage);
router.patch('/admin/tickets/:id/status', adminOnly, setStatusValidator, validate, SupportController.adminSetStatus);
router.patch('/admin/tickets/:id/read', adminOnly, SupportController.adminMarkRead);

export default router;
