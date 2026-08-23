import { Router } from 'express';
import { CategoriesController } from './categories.controller';
import { createCategoryValidator, updateCategoryValidator } from './categories.validator';
import { protect, adminOnly } from '../../shared/middleware/auth.middleware';
import validate from '../../shared/middleware/validate.middleware';

const router = Router();

// Public
router.get('/', CategoriesController.listPublic);

// Admin
router.get('/admin/all', protect, adminOnly, CategoriesController.listAdmin);
router.post('/', protect, adminOnly, createCategoryValidator, validate, CategoriesController.create);
router.patch('/:id', protect, adminOnly, updateCategoryValidator, validate, CategoriesController.update);
router.delete('/:id', protect, adminOnly, CategoriesController.remove);

export default router;
