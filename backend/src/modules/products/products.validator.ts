import { body, ValidationChain } from 'express-validator';

export const createProductValidator: ValidationChain[] = [
  body('name').trim().notEmpty().withMessage('Name is required.')
    .isLength({ max: 160 }).withMessage('Name too long.'),
  body('original_price').isInt({ min: 0 }).withMessage('original_price must be a non-negative integer.'),
  body('discount_price').isInt({ min: 0 }).withMessage('discount_price must be a non-negative integer.')
    .custom((v, { req }) => Number(v) <= Number(req.body.original_price))
    .withMessage('discount_price cannot exceed original_price.'),
  body('category_id').optional({ nullable: true }).isInt().withMessage('category_id must be an integer.'),
  body('rating').optional().isFloat({ min: 0, max: 5 }).withMessage('rating must be 0–5.'),
  body('reviews_count').optional().isInt({ min: 0 }).withMessage('reviews_count must be a non-negative integer.'),
  body('stock_quantity').optional().isInt({ min: 0 }).withMessage('stock_quantity must be a non-negative integer.'),
  body('low_stock_threshold').optional().isInt({ min: 0 }).withMessage('low_stock_threshold must be a non-negative integer.'),
  body('in_stock').optional().isBoolean().withMessage('in_stock must be boolean.'),
  body('is_featured').optional().isBoolean().withMessage('is_featured must be boolean.'),
];

export const updateProductValidator: ValidationChain[] = [
  body('name').optional().trim().isLength({ min: 1, max: 160 }).withMessage('Invalid name.'),
  body('original_price').optional().isInt({ min: 0 }).withMessage('original_price must be a non-negative integer.'),
  body('discount_price').optional().isInt({ min: 0 }).withMessage('discount_price must be a non-negative integer.'),
  body('category_id').optional({ nullable: true }).isInt().withMessage('category_id must be an integer.'),
  body('rating').optional().isFloat({ min: 0, max: 5 }).withMessage('rating must be 0–5.'),
  body('stock_quantity').optional().isInt({ min: 0 }).withMessage('stock_quantity must be a non-negative integer.'),
  body('low_stock_threshold').optional().isInt({ min: 0 }).withMessage('low_stock_threshold must be a non-negative integer.'),
  body('in_stock').optional().isBoolean().withMessage('in_stock must be boolean.'),
  body('is_featured').optional().isBoolean().withMessage('is_featured must be boolean.'),
  body('is_active').optional().isBoolean().withMessage('is_active must be boolean.'),
];
