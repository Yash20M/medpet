import { Router } from 'express';
import { OffersController } from './offers.controller';
import { createOfferValidator, updateOfferValidator } from './offers.validator';
import { protect, adminOnly } from '../../shared/middleware/auth.middleware';
import validate from '../../shared/middleware/validate.middleware';

const router = Router();

router.get('/', OffersController.listPublic);
router.get('/admin/all', protect, adminOnly, OffersController.listAdmin);
router.post('/', protect, adminOnly, createOfferValidator, validate, OffersController.create);
router.patch('/:id', protect, adminOnly, updateOfferValidator, validate, OffersController.update);
router.delete('/:id', protect, adminOnly, OffersController.remove);

export default router;
