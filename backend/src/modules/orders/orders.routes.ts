import { Router } from 'express';
import { OrdersController } from './orders.controller';
import { createOrderValidator, updateOrderStatusValidator } from './orders.validator';
import { protect, adminOnly } from '../../shared/middleware/auth.middleware';
import validate from '../../shared/middleware/validate.middleware';

const router = Router();

router.use(protect);

router.get('/admin/all', adminOnly, OrdersController.listAdmin);
router.patch('/:id/status', adminOnly, updateOrderStatusValidator, validate, OrdersController.updateStatus);

router.get('/', OrdersController.listMine);
router.post('/', createOrderValidator, validate, OrdersController.create);
router.get('/:id', OrdersController.getOne);

export default router;
