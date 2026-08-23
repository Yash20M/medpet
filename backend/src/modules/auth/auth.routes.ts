import { Router } from 'express';
import { AuthController } from './auth.controller';
import {
  registerValidator, loginValidator, updateProfileValidator,
  forgotPasswordValidator, resetPasswordValidator,
} from './auth.validator';
import { protect } from '../../shared/middleware/auth.middleware';
import validate from '../../shared/middleware/validate.middleware';

const router = Router();

router.post('/register', registerValidator, validate, AuthController.register);
router.post('/login',    loginValidator,    validate, AuthController.login);
router.post('/forgot-password', forgotPasswordValidator, validate, AuthController.forgotPassword);
router.post('/reset-password',  resetPasswordValidator,  validate, AuthController.resetPassword);
router.get('/profile',   protect,                    AuthController.getProfile);
router.patch('/profile', protect, updateProfileValidator, validate, AuthController.updateProfile);

export default router;
