import { Router } from 'express';
import { ContentController } from './content.controller';
import {
  createTipValidator, updateTipValidator,
  createBrandValidator, updateBrandValidator,
  createTestimonialValidator, updateTestimonialValidator,
  createStoreValidator, updateStoreValidator,
} from './content.validator';
import { protect, adminOnly } from '../../shared/middleware/auth.middleware';
import validate from '../../shared/middleware/validate.middleware';

const router = Router();

// Public — consumed by the mobile app's Home screen.
router.get('/home', ContentController.home);

// Admin management.
router.use(protect, adminOnly);

router.get('/admin/all', ContentController.adminAll);

router.post('/tips', createTipValidator, validate, ContentController.createTip);
router.patch('/tips/:id', updateTipValidator, validate, ContentController.updateTip);
router.delete('/tips/:id', ContentController.removeTip);

router.post('/brands', createBrandValidator, validate, ContentController.createBrand);
router.patch('/brands/:id', updateBrandValidator, validate, ContentController.updateBrand);
router.delete('/brands/:id', ContentController.removeBrand);

router.post('/testimonials', createTestimonialValidator, validate, ContentController.createTestimonial);
router.patch('/testimonials/:id', updateTestimonialValidator, validate, ContentController.updateTestimonial);
router.delete('/testimonials/:id', ContentController.removeTestimonial);

router.post('/stores', createStoreValidator, validate, ContentController.createStore);
router.patch('/stores/:id', updateStoreValidator, validate, ContentController.updateStore);
router.delete('/stores/:id', ContentController.removeStore);

router.put('/settings', ContentController.updateSettings);

export default router;
