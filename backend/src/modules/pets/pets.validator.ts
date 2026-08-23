import { body, ValidationChain } from 'express-validator';

const PET_TYPES = ['dog', 'cat', 'bird', 'fish', 'rabbit', 'horse', 'reptile', 'other'];
const GENDERS = ['male', 'female', 'unknown'];

export const createPetValidator: ValidationChain[] = [
  body('name').isString().trim().isLength({ min: 1, max: 80 }).withMessage('Pet name is required.'),
  body('type').isIn(PET_TYPES).withMessage('Invalid pet type.'),
  body('breed').optional().isString().isLength({ max: 80 }),
  body('gender').optional().isIn(GENDERS),
  body('age_years').optional({ nullable: true }).isFloat({ min: 0, max: 100 }),
  body('weight_kg').optional({ nullable: true }).isFloat({ min: 0, max: 2000 }),
  body('avatar_url').optional({ nullable: true }).isString(),
  body('notes').optional().isString().isLength({ max: 1000 }),
];

export const updatePetValidator: ValidationChain[] = [
  body('name').optional().isString().trim().isLength({ min: 1, max: 80 }),
  body('type').optional().isIn(PET_TYPES),
  body('breed').optional().isString().isLength({ max: 80 }),
  body('gender').optional().isIn(GENDERS),
  body('age_years').optional({ nullable: true }).isFloat({ min: 0, max: 100 }),
  body('weight_kg').optional({ nullable: true }).isFloat({ min: 0, max: 2000 }),
  body('avatar_url').optional({ nullable: true }).isString(),
  body('notes').optional().isString().isLength({ max: 1000 }),
];
