import { body, ValidationChain } from 'express-validator';

export const createOfferValidator: ValidationChain[] = [
  body('title').trim().notEmpty().withMessage('Title is required.')
    .isLength({ max: 120 }).withMessage('Title too long.'),
  body('sort_order').optional().isInt().withMessage('sort_order must be an integer.'),
];

export const updateOfferValidator: ValidationChain[] = [
  body('title').optional().trim().isLength({ min: 1, max: 120 }).withMessage('Invalid title.'),
  body('sort_order').optional().isInt().withMessage('sort_order must be an integer.'),
  body('is_active').optional().isBoolean().withMessage('is_active must be boolean.'),
];
