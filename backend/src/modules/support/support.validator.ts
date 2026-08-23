import { body, ValidationChain } from 'express-validator';

export const createTicketValidator: ValidationChain[] = [
  body('subject').trim().notEmpty().withMessage('Subject is required.').isLength({ max: 160 }),
  body('body').trim().notEmpty().withMessage('Message body is required.'),
];

export const createMessageValidator: ValidationChain[] = [
  body('body').trim().notEmpty().withMessage('Message body is required.'),
];

export const setStatusValidator: ValidationChain[] = [
  body('status').isIn(['open', 'pending', 'resolved', 'closed']).withMessage('Invalid status.'),
];
