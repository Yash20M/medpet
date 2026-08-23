import { body, ValidationChain } from 'express-validator';

export const createTipValidator: ValidationChain[] = [
  body('title').trim().notEmpty().withMessage('Title is required.')
    .isLength({ max: 120 }).withMessage('Title too long.'),
  body('read_mins').optional().isInt({ min: 1, max: 60 }).withMessage('read_mins must be 1–60.'),
  body('sections').optional().isArray().withMessage('sections must be an array.'),
  body('sections.*.heading').optional().trim().notEmpty().withMessage('Section heading required.'),
  body('sections.*.body').optional().trim().notEmpty().withMessage('Section body required.'),
];

export const updateTipValidator: ValidationChain[] = [
  body('title').optional().trim().isLength({ min: 1, max: 120 }).withMessage('Invalid title.'),
  body('read_mins').optional().isInt({ min: 1, max: 60 }).withMessage('read_mins must be 1–60.'),
  body('sections').optional().isArray().withMessage('sections must be an array.'),
  body('is_active').optional().isBoolean().withMessage('is_active must be boolean.'),
];

export const createBrandValidator: ValidationChain[] = [
  body('name').trim().notEmpty().withMessage('Name is required.')
    .isLength({ max: 80 }).withMessage('Name too long.'),
];

export const updateBrandValidator: ValidationChain[] = [
  body('name').optional().trim().isLength({ min: 1, max: 80 }).withMessage('Invalid name.'),
  body('is_active').optional().isBoolean().withMessage('is_active must be boolean.'),
];

export const createTestimonialValidator: ValidationChain[] = [
  body('owner_name').trim().notEmpty().withMessage('Owner name is required.'),
  body('body').trim().notEmpty().withMessage('Review text is required.'),
  body('rating').optional().isInt({ min: 1, max: 5 }).withMessage('Rating must be 1–5.'),
];

export const updateTestimonialValidator: ValidationChain[] = [
  body('rating').optional().isInt({ min: 1, max: 5 }).withMessage('Rating must be 1–5.'),
  body('is_active').optional().isBoolean().withMessage('is_active must be boolean.'),
];

export const createStoreValidator: ValidationChain[] = [
  body('name').trim().notEmpty().withMessage('Name is required.'),
  body('distance_km').optional().isFloat({ min: 0 }).withMessage('distance_km must be positive.'),
  body('eta_mins').optional().isInt({ min: 1 }).withMessage('eta_mins must be positive.'),
];

export const updateStoreValidator: ValidationChain[] = [
  body('distance_km').optional().isFloat({ min: 0 }).withMessage('distance_km must be positive.'),
  body('eta_mins').optional().isInt({ min: 1 }).withMessage('eta_mins must be positive.'),
  body('is_active').optional().isBoolean().withMessage('is_active must be boolean.'),
  body('is_open').optional().isBoolean().withMessage('is_open must be boolean.'),
];
