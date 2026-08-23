import { Request, Response } from 'express';
import db from '../../shared/config/database';
import { CouponsService } from './coupons.service';
import { CreateCouponDto, UpdateCouponDto, CartItemInput } from './coupons.types';
import { sendSuccess, sendError } from '../../shared/utils/response';

const getStatus = (err: unknown): number =>
  typeof err === 'object' && err !== null && 'statusCode' in err
    ? (err as { statusCode: number }).statusCode : 500;

export const CouponsController = {
  // ─── Customer ────────────────────────────────────────────────────────────
  async eligible(req: Request, res: Response): Promise<void> {
    const items = (req.body.items ?? []) as CartItemInput[];
    const data = await CouponsService.listEligible(db, req.user!.id, items);
    sendSuccess(res, { message: 'Eligible coupons fetched.', data });
  },

  async validate(req: Request, res: Response): Promise<void> {
    try {
      const items = (req.body.items ?? []) as CartItemInput[];
      const data = await CouponsService.checkEligibility(db, req.user!.id, req.body.code as string, items);
      sendSuccess(res, { message: 'Coupon applied.', data });
    } catch (err) {
      sendError(res, (err as Error).message, getStatus(err));
    }
  },

  // ─── Admin ───────────────────────────────────────────────────────────────
  async listAdmin(_req: Request, res: Response): Promise<void> {
    const data = await CouponsService.list();
    sendSuccess(res, { message: 'Coupons fetched.', data });
  },

  async create(req: Request, res: Response): Promise<void> {
    try {
      const data = await CouponsService.create(req.body as CreateCouponDto);
      sendSuccess(res, { message: 'Coupon created.', data }, 201);
    } catch (err) {
      sendError(res, (err as Error).message, 400);
    }
  },

  async update(req: Request, res: Response): Promise<void> {
    const data = await CouponsService.update(Number(req.params.id), req.body as UpdateCouponDto);
    if (!data) { sendError(res, 'Coupon not found.', 404); return; }
    sendSuccess(res, { message: 'Coupon updated.', data });
  },

  async remove(req: Request, res: Response): Promise<void> {
    const ok = await CouponsService.remove(Number(req.params.id));
    if (!ok) { sendError(res, 'Coupon not found.', 404); return; }
    sendSuccess(res, { message: 'Coupon deleted.' });
  },
};
