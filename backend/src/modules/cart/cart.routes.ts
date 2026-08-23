import { Router } from 'express';
import { body } from 'express-validator';
import { CartController } from './cart.controller';
import { protect } from '../../shared/middleware/auth.middleware';
import validate from '../../shared/middleware/validate.middleware';

const router = Router();

router.use(protect);

router.get('/', CartController.get);
router.post('/',
  body('productId').isInt().withMessage('productId must be an integer.'),
  body('quantity').optional().isInt({ min: 1 }).withMessage('quantity must be a positive integer.'),
  validate,
  CartController.add
);
router.patch('/:productId',
  body('quantity').isInt().withMessage('quantity must be an integer.'),
  validate,
  CartController.setQuantity
);
router.delete('/:productId', CartController.remove);
router.delete('/', CartController.clear);

export default router;
