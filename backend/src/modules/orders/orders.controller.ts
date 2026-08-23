import { Request, Response } from 'express';
import { OrdersService } from './orders.service';
import { CreateOrderDto, OrderStatus } from './orders.types';
import { sendSuccess, sendError } from '../../shared/utils/response';

const getStatus = (err: unknown): number =>
  typeof err === 'object' && err !== null && 'statusCode' in err
    ? (err as { statusCode: number }).statusCode : 500;

export const OrdersController = {
  async create(req: Request, res: Response): Promise<void> {
    try {
      const data = await OrdersService.create(req.user!.id, req.body as CreateOrderDto);
      sendSuccess(res, { message: 'Order placed.', data }, 201);
    } catch (err) {
      sendError(res, (err as Error).message, getStatus(err));
    }
  },

  async listMine(req: Request, res: Response): Promise<void> {
    const data = await OrdersService.listForUser(req.user!.id);
    sendSuccess(res, { message: 'Orders fetched.', data });
  },

  async getOne(req: Request, res: Response): Promise<void> {
    const isAdmin = req.user!.role === 'admin';
    const data = await OrdersService.getOne(Number(req.params.id), isAdmin ? undefined : req.user!.id);
    if (!data) { sendError(res, 'Order not found.', 404); return; }
    sendSuccess(res, { message: 'Order fetched.', data });
  },

  async listAdmin(req: Request, res: Response): Promise<void> {
    const data = await OrdersService.listAdmin(req.query.status as OrderStatus | undefined);
    sendSuccess(res, { message: 'Orders fetched.', data });
  },

  async updateStatus(req: Request, res: Response): Promise<void> {
    const data = await OrdersService.updateStatus(Number(req.params.id), req.body.status as OrderStatus);
    if (!data) { sendError(res, 'Order not found.', 404); return; }
    sendSuccess(res, { message: 'Order status updated.', data });
  },
};
