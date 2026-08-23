import { Router } from 'express';
import { ProductsController } from './products.controller';
import { createProductValidator, updateProductValidator } from './products.validator';
import { protect, adminOnly } from '../../shared/middleware/auth.middleware';
import validate from '../../shared/middleware/validate.middleware';

const router = Router();

// Public
router.get('/', ProductsController.listPublic);
router.get('/admin/all', protect, adminOnly, ProductsController.listAdmin);
router.get('/admin/low-stock', protect, adminOnly, ProductsController.listLowStock);
router.get('/:id/related', ProductsController.getRelated);
router.get('/:id', ProductsController.getOne);

// Admin
router.post('/', protect, adminOnly, createProductValidator, validate, ProductsController.create);
router.patch('/:id', protect, adminOnly, updateProductValidator, validate, ProductsController.update);
router.delete('/:id', protect, adminOnly, ProductsController.remove);

export default router;
