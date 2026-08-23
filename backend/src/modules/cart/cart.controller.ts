import { Request, Response } from 'express';
import { CartService } from './cart.service';
import { sendSuccess, sendError } from '../../shared/utils/response';

const getStatus = (err: unknown): number =>
  typeof err === 'object' && err !== null && 'statusCode' in err
    ? (err as { statusCode: number }).statusCode : 500;

export const CartController = {
  async get(req: Request, res: Response): Promise<void> {
    sendSuccess(res, { message: 'Cart fetched.', data: await CartService.get(req.user!.id) });
  },

  async add(req: Request, res: Response): Promise<void> {
    try {
      const data = await CartService.add(req.user!.id, Number(req.body.productId), Number(req.body.quantity ?? 1));
      sendSuccess(res, { message: 'Added to cart.', data }, 201);
    } catch (err) {
      sendError(res, (err as Error).message, getStatus(err));
    }
  },

  async setQuantity(req: Request, res: Response): Promise<void> {
    try {
      const data = await CartService.setQuantity(req.user!.id, Number(req.params.productId), Number(req.body.quantity));
      sendSuccess(res, { message: 'Cart updated.', data });
    } catch (err) {
      sendError(res, (err as Error).message, getStatus(err));
    }
  },

  async remove(req: Request, res: Response): Promise<void> {
    const data = await CartService.remove(req.user!.id, Number(req.params.productId));
    sendSuccess(res, { message: 'Item removed.', data });
  },

  async clear(req: Request, res: Response): Promise<void> {
    sendSuccess(res, { message: 'Cart cleared.', data: await CartService.clear(req.user!.id) });
  },
};
