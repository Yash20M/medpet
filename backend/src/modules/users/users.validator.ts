import { body, ValidationChain } from 'express-validator';

export const createDeliveryPartnerValidator: ValidationChain[] = [
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required.')
    .isLength({ min: 2, max: 100 }).withMessage('Name must be 2–100 characters.'),
  body('email')
    .trim()
    .isEmail().withMessage('Valid email is required.')
    .normalizeEmail(),
  body('phone')
    .optional({ nullable: true, checkFalsy: true })
    .isMobilePhone('any').withMessage('Invalid phone number.'),
];

export const setActiveValidator: ValidationChain[] = [
  body('is_active').isBoolean().withMessage('is_active must be a boolean.'),
];
