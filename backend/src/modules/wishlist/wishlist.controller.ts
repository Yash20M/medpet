import { Request, Response } from 'express';
import { WishlistService } from './wishlist.service';
import { sendSuccess, sendError } from '../../shared/utils/response';

const getStatus = (err: unknown): number =>
  typeof err === 'object' && err !== null && 'statusCode' in err
    ? (err as { statusCode: number }).statusCode : 500;

export const WishlistController = {
  async list(req: Request, res: Response): Promise<void> {
    sendSuccess(res, { message: 'Wishlist fetched.', data: await WishlistService.list(req.user!.id) });
  },

  async add(req: Request, res: Response): Promise<void> {
    try {
      const data = await WishlistService.add(req.user!.id, Number(req.body.productId));
      sendSuccess(res, { message: 'Added to wishlist.', data }, 201);
    } catch (err) {
      sendError(res, (err as Error).message, getStatus(err));
    }
  },

  async remove(req: Request, res: Response): Promise<void> {
    const ok = await WishlistService.remove(req.user!.id, Number(req.params.productId));
    if (!ok) { sendError(res, 'Item not in wishlist.', 404); return; }
    sendSuccess(res, { message: 'Removed from wishlist.' });
  },
};
