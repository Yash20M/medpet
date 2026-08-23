import { Router } from 'express';
import { UsersController } from './users.controller';
import { createDeliveryPartnerValidator, setActiveValidator } from './users.validator';
import { protect, adminOnly } from '../../shared/middleware/auth.middleware';
import validate from '../../shared/middleware/validate.middleware';

const router = Router();

router.use(protect, adminOnly);

// ─── Delivery partners ───────────────────────────────────────────────────────
router.get('/admin/delivery-partners', UsersController.listDeliveryPartners);
router.post('/admin/delivery-partners', createDeliveryPartnerValidator, validate, UsersController.createDeliveryPartner);
router.post('/admin/delivery-partners/:id/resend-invite', UsersController.resendInvite);
router.patch('/admin/delivery-partners/:id', setActiveValidator, validate, UsersController.setActive);

// ─── Customers / general users ───────────────────────────────────────────────
router.get('/admin/all', UsersController.listAdmin);
router.get('/admin/:id', UsersController.getOneAdmin);

export default router;
