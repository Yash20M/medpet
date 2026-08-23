import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import db from '../config/database';
import { AuthUser } from '../../modules/auth/auth.types';
import { sendError } from '../utils/response';

interface JwtPayload {
  id: number;
}

export const protect = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    sendError(res, 'Access denied. No token provided.', 401);
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    const { id } = jwt.verify(token, process.env.JWT_SECRET as string) as JwtPayload;

    const { rows } = await db.query<AuthUser>(
      `SELECT id, name, email, phone, role, avatar_url, created_at
       FROM users WHERE id = $1 AND is_active = true`,
      [id]
    );

    if (rows.length === 0) {
      sendError(res, 'User not found or deactivated.', 401);
      return;
    }

    req.user = rows[0];
    next();
  } catch {
    sendError(res, 'Invalid or expired token.', 401);
  }
};

export const adminOnly = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (req.user?.role !== 'admin') {
    sendError(res, 'Admin access required.', 403);
    return;
  }
  next();
};

export const deliveryOnly = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (req.user?.role !== 'delivery') {
    sendError(res, 'Delivery partner access required.', 403);
    return;
  }
  next();
};
