import { Router } from 'express';
import { DeliveryController } from './delivery.controller';
import { protect, deliveryOnly } from '../../shared/middleware/auth.middleware';

const router = Router();

// Every delivery route requires an authenticated delivery-partner account.
router.use(protect, deliveryOnly);

router.get('/summary', DeliveryController.summary);
router.get('/orders/available', DeliveryController.listAvailable);
router.get('/orders/mine', DeliveryController.listMine);
router.get('/orders/:id', DeliveryController.getOne);
router.post('/orders/:id/accept', DeliveryController.accept);
router.post('/orders/:id/deliver', DeliveryController.markDelivered);

export default router;
