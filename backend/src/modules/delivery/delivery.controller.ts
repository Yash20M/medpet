import { Request, Response } from 'express';
import { DeliveryService } from './delivery.service';
import { sendSuccess, sendError } from '../../shared/utils/response';

const getStatus = (err: unknown): number =>
  typeof err === 'object' && err !== null && 'statusCode' in err
    ? (err as { statusCode: number }).statusCode : 500;

export const DeliveryController = {
  async summary(req: Request, res: Response): Promise<void> {
    const data = await DeliveryService.summary(req.user!.id);
    sendSuccess(res, { message: 'Summary fetched.', data });
  },

  async listAvailable(_req: Request, res: Response): Promise<void> {
    const data = await DeliveryService.listAvailable();
    sendSuccess(res, { message: 'Available orders fetched.', data });
  },

  async listMine(req: Request, res: Response): Promise<void> {
    const scope = (req.query.scope as 'active' | 'completed' | 'all') ?? 'all';
    const data = await DeliveryService.listMine(req.user!.id, scope);
    sendSuccess(res, { message: 'Deliveries fetched.', data });
  },

  async getOne(req: Request, res: Response): Promise<void> {
    const data = await DeliveryService.getOne(req.user!.id, Number(req.params.id));
    if (!data) { sendError(res, 'Order not found.', 404); return; }
    sendSuccess(res, { message: 'Order fetched.', data });
  },

  async accept(req: Request, res: Response): Promise<void> {
    try {
      const data = await DeliveryService.accept(req.user!.id, Number(req.params.id));
      sendSuccess(res, { message: 'Order accepted.', data });
    } catch (err) {
      sendError(res, (err as Error).message, getStatus(err));
    }
  },

  async markDelivered(req: Request, res: Response): Promise<void> {
    try {
      const data = await DeliveryService.markDelivered(req.user!.id, Number(req.params.id));
      sendSuccess(res, { message: 'Order marked delivered.', data });
    } catch (err) {
      sendError(res, (err as Error).message, getStatus(err));
    }
  },
};
