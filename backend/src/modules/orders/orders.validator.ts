import { body, ValidationChain } from 'express-validator';

export const createOrderValidator: ValidationChain[] = [
  body('items').isArray({ min: 1 }).withMessage('items must be a non-empty array.'),
  body('items.*.productId').isInt().withMessage('productId must be an integer.'),
  body('items.*.quantity').isInt({ min: 1 }).withMessage('quantity must be a positive integer.'),
  body('address').optional().isString().isLength({ max: 500 }),
  body('contactPhone').optional().isString().isLength({ max: 20 }),
  body('paymentMethod').optional().isIn(['upi', 'cod']).withMessage('paymentMethod must be upi or cod.'),
  body('latitude').optional({ nullable: true }).isFloat({ min: -90, max: 90 }),
  body('longitude').optional({ nullable: true }).isFloat({ min: -180, max: 180 }),
];

export const updateOrderStatusValidator: ValidationChain[] = [
  body('status').isIn(['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'])
    .withMessage('Invalid status.'),
  body('reason').optional().isString().isLength({ max: 500 }),
];
