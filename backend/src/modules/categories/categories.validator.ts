import { body, ValidationChain } from 'express-validator';

export const createCategoryValidator: ValidationChain[] = [
  body('name').trim().notEmpty().withMessage('Name is required.')
    .isLength({ max: 80 }).withMessage('Name too long.'),
  body('slug').optional().trim()
    .matches(/^[a-z0-9-]+$/).withMessage('Slug may only contain lowercase letters, numbers and hyphens.'),
  body('parent_id').optional({ nullable: true }).isInt().withMessage('parent_id must be an integer.'),
  body('sort_order').optional().isInt().withMessage('sort_order must be an integer.'),
];

export const updateCategoryValidator: ValidationChain[] = [
  body('name').optional().trim().isLength({ min: 1, max: 80 }).withMessage('Invalid name.'),
  body('parent_id').optional({ nullable: true }).isInt().withMessage('parent_id must be an integer.'),
  body('sort_order').optional().isInt().withMessage('sort_order must be an integer.'),
  body('is_active').optional().isBoolean().withMessage('is_active must be boolean.'),
];
