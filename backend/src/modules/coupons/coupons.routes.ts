import { Router } from 'express';
import { CouponsController } from './coupons.controller';
import {
  createCouponValidator, updateCouponValidator, eligibleCouponValidator, validateCouponValidator,
} from './coupons.validator';
import { protect, adminOnly } from '../../shared/middleware/auth.middleware';
import validate from '../../shared/middleware/validate.middleware';

const router = Router();

router.use(protect);

// ─── Customer ────────────────────────────────────────────────────────────
router.post('/eligible', eligibleCouponValidator, validate, CouponsController.eligible);
router.post('/validate', validateCouponValidator, validate, CouponsController.validate);

// ─── Admin ───────────────────────────────────────────────────────────────
router.get('/admin/all', adminOnly, CouponsController.listAdmin);
router.post('/', adminOnly, createCouponValidator, validate, CouponsController.create);
router.patch('/:id', adminOnly, updateCouponValidator, validate, CouponsController.update);
router.delete('/:id', adminOnly, CouponsController.remove);

export default router;
