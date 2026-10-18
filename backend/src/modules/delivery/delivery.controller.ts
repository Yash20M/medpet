import { Request, Response } from 'express';
import { DeliveryService } from './delivery.service';
import { getDeliveryHistory } from './delivery.history';
import { sendSuccess, sendError } from '../../shared/utils/response';
import { emitToOrder, emitToAdmins } from '../../shared/realtime/io';

const getStatus = (err: unknown): number =>
  typeof err === 'object' && err !== null && 'statusCode' in err
    ? (err as { statusCode: number }).statusCode : 500;


const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
const int = (v: unknown): number | undefined => {
  const n = Number(v);
  return str(v) && Number.isFinite(n) ? n : undefined;
};

export const DeliveryController = {
  async summary(req: Request, res: Response): Promise<void> {
    const data = await DeliveryService.summary(req.user!.id);
    sendSuccess(res, { message: 'Summary fetched.', data });
  },

  /** The signed-in partner's accepted deliveries over a date range. */
  async history(req: Request, res: Response): Promise<void> {
    try {
      const data = await getDeliveryHistory({
        from: str(req.query.from), to: str(req.query.to),
        page: int(req.query.page), limit: int(req.query.limit),
        partnerId: req.user!.id,
      });
      sendSuccess(res, { message: 'Delivery history fetched.', data });
    } catch (err) {
      sendError(res, (err as Error).message, getStatus(err));
    }
  },

  /** Admin: accepted deliveries across all partners (or one, via ?partnerId=). */
  async adminHistory(req: Request, res: Response): Promise<void> {
    try {
      const data = await getDeliveryHistory({
        from: str(req.query.from), to: str(req.query.to),
        page: int(req.query.page), limit: int(req.query.limit),
        partnerId: int(req.query.partnerId) ?? null,
      });
      sendSuccess(res, { message: 'Delivery history fetched.', data });
    } catch (err) {
      sendError(res, (err as Error).message, getStatus(err));
    }
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
    const otp = typeof req.body?.otp === 'string' ? req.body.otp.trim() : '';
    if (!otp) {
      sendError(res, 'Ask the customer for their delivery OTP (sent by email) and enter it to confirm.', 400);
      return;
    }
    try {
      const orderId = Number(req.params.id);
      const data = await DeliveryService.markDelivered(req.user!.id, orderId, otp);

      // OTP-confirmed delivery doesn't flow through the GPS-ping pipeline (the
      // usual source of this event), so broadcast it here for the customer's
      // live tracking screen and the admin live map.
      const sc = { orderId, oldStatus: null, newStatus: 'delivered', timestamp: Date.now() };
      emitToOrder(orderId, 'tracking:status-change', sc);
      emitToAdmins('tracking:status-change', sc);

      sendSuccess(res, { message: 'Order marked delivered.', data });
    } catch (err) {
      sendError(res, (err as Error).message, getStatus(err));
    }
  },
};
