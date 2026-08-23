import { Router } from 'express';
import { body } from 'express-validator';
import { WishlistController } from './wishlist.controller';
import { protect } from '../../shared/middleware/auth.middleware';
import validate from '../../shared/middleware/validate.middleware';

const router = Router();

router.use(protect);

router.get('/', WishlistController.list);
router.post('/',
  body('productId').isInt().withMessage('productId must be an integer.'),
  validate,
  WishlistController.add
);
router.delete('/:productId', WishlistController.remove);

export default router;
