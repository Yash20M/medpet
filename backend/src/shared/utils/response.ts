import { Response } from 'express';
import { ApiResponse } from '../types/api.types';

export const sendSuccess = <T>(
  res: Response,
  data: Omit<ApiResponse<T>, 'success'>,
  status = 200
): Response =>
  res.status(status).json({ success: true, ...data });

export const sendError = (
  res: Response,
  message: string,
  status = 500
): Response =>
  res.status(status).json({ success: false, message });
