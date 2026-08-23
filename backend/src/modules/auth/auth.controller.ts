import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto, UpdateProfileDto, ForgotPasswordDto, ResetPasswordDto } from './auth.types';
import { sendSuccess, sendError } from '../../shared/utils/response';

const getStatusCode = (err: unknown): number =>
  typeof err === 'object' && err !== null && 'statusCode' in err
    ? (err as { statusCode: number }).statusCode
    : 500;

export const AuthController = {
  async register(req: Request, res: Response): Promise<void> {
    try {
      const dto = req.body as RegisterDto;
      const payload = await AuthService.register(dto);
      sendSuccess(res, { message: 'Account created successfully.', data: payload }, 201);
    } catch (err) {
      sendError(res, (err as Error).message, getStatusCode(err));
    }
  },

  async login(req: Request, res: Response): Promise<void> {
    try {
      const dto = req.body as LoginDto;
      const payload = await AuthService.login(dto);
      sendSuccess(res, { message: 'Login successful.', data: payload });
    } catch (err) {
      sendError(res, (err as Error).message, getStatusCode(err));
    }
  },

  getProfile(req: Request, res: Response): void {
    sendSuccess(res, { message: 'Profile fetched.', data: req.user });
  },

  async updateProfile(req: Request, res: Response): Promise<void> {
    try {
      const dto = req.body as UpdateProfileDto;
      const updated = await AuthService.updateProfile(req.user!.id, dto);
      sendSuccess(res, { message: 'Profile updated.', data: updated });
    } catch (err) {
      sendError(res, (err as Error).message, getStatusCode(err));
    }
  },

  async forgotPassword(req: Request, res: Response): Promise<void> {
    try {
      const { email } = req.body as ForgotPasswordDto;
      await AuthService.requestPasswordReset(email);
      // Same response whether or not the email exists (no account enumeration).
      sendSuccess(res, { message: 'If that email is registered, a reset link has been sent.' });
    } catch (err) {
      sendError(res, (err as Error).message, getStatusCode(err));
    }
  },

  async resetPassword(req: Request, res: Response): Promise<void> {
    try {
      const { token, password } = req.body as ResetPasswordDto;
      await AuthService.resetPassword(token, password);
      sendSuccess(res, { message: 'Password updated. You can now log in.' });
    } catch (err) {
      sendError(res, (err as Error).message, getStatusCode(err));
    }
  },
};
