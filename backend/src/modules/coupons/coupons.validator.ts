import { body, ValidationChain } from 'express-validator';

export const createCouponValidator: ValidationChain[] = [
  body('code').trim().notEmpty().withMessage('Code is required.').isLength({ max: 40 }),
  body('title').trim().notEmpty().withMessage('Title is required.').isLength({ max: 120 }),
  body('discount_type').isIn(['percent', 'flat']).withMessage('discount_type must be percent or flat.'),
  body('discount_value').isFloat({ min: 0 }).withMessage('discount_value must be a positive number.'),
  body('max_discount_amount').optional({ nullable: true }).isInt({ min: 0 }),
  body('min_order_value').optional({ nullable: true }).isInt({ min: 0 }),
  body('condition_type').optional().isIn(['none', 'first_order', 'nth_order', 'min_order_count']),
  body('condition_value').optional({ nullable: true }).isInt({ min: 1 }),
  body('user_id').optional({ nullable: true }).isInt(),
  body('show_on_ui').optional().isBoolean(),
  body('usage_limit').optional({ nullable: true }).isInt({ min: 1 }),
  body('per_user_limit').optional({ nullable: true }).isInt({ min: 1 }),
  body('is_active').optional().isBoolean(),
  body('category_ids').optional().isArray(),
  body('product_ids').optional().isArray(),
];

export const updateCouponValidator: ValidationChain[] = [
  body('code').optional().trim().isLength({ min: 1, max: 40 }),
  body('title').optional().trim().isLength({ min: 1, max: 120 }),
  body('discount_type').optional().isIn(['percent', 'flat']),
  body('discount_value').optional().isFloat({ min: 0 }),
  body('condition_type').optional().isIn(['none', 'first_order', 'nth_order', 'min_order_count']),
  body('show_on_ui').optional().isBoolean(),
  body('is_active').optional().isBoolean(),
  body('category_ids').optional().isArray(),
  body('product_ids').optional().isArray(),
];

export const eligibleCouponValidator: ValidationChain[] = [
  body('items').isArray().withMessage('items must be an array.'),
  body('items.*.productId').isInt().withMessage('productId must be an integer.'),
  body('items.*.quantity').isInt({ min: 1 }).withMessage('quantity must be a positive integer.'),
];

export const validateCouponValidator: ValidationChain[] = [
  body('code').trim().notEmpty().withMessage('code is required.'),
  ...eligibleCouponValidator,
];
