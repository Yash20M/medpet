import { Router } from 'express';
import { DeliveryController } from './delivery.controller';
import { protect, deliveryOnly, adminOnly } from '../../shared/middleware/auth.middleware';

const router = Router();

// Admin-facing history across all partners (before the partner-only guard below).
router.get('/admin/history', protect, adminOnly, DeliveryController.adminHistory);

// Every other delivery route requires an authenticated delivery-partner account.
router.use(protect, deliveryOnly);

router.get('/summary', DeliveryController.summary);
router.get('/history', DeliveryController.history);
router.get('/orders/available', DeliveryController.listAvailable);
router.get('/orders/mine', DeliveryController.listMine);
router.get('/orders/:id', DeliveryController.getOne);
router.post('/orders/:id/accept', DeliveryController.accept);
router.post('/orders/:id/deliver', DeliveryController.markDelivered);

export default router;
