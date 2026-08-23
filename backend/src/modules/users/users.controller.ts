import { Request, Response } from 'express';
import { UsersService } from './users.service';
import { CreateDeliveryPartnerDto } from './users.types';
import { sendSuccess, sendError } from '../../shared/utils/response';

const getStatus = (err: unknown): number =>
  typeof err === 'object' && err !== null && 'statusCode' in err
    ? (err as { statusCode: number }).statusCode : 500;

export const UsersController = {
  async listAdmin(_req: Request, res: Response): Promise<void> {
    const data = await UsersService.listAdmin();
    sendSuccess(res, { message: 'Users fetched.', data });
  },

  async getOneAdmin(req: Request, res: Response): Promise<void> {
    const result = await UsersService.getOneAdmin(Number(req.params.id));
    if (!result) { sendError(res, 'User not found.', 404); return; }
    sendSuccess(res, { message: 'User fetched.', data: result });
  },

  // ─── Delivery partners ─────────────────────────────────────────────────────
  async listDeliveryPartners(_req: Request, res: Response): Promise<void> {
    const data = await UsersService.listDeliveryPartners();
    sendSuccess(res, { message: 'Delivery partners fetched.', data });
  },

  async createDeliveryPartner(req: Request, res: Response): Promise<void> {
    try {
      const data = await UsersService.createDeliveryPartner(req.body as CreateDeliveryPartnerDto);
      sendSuccess(res, { message: 'Delivery partner invited.', data }, 201);
    } catch (err) {
      sendError(res, (err as Error).message, getStatus(err));
    }
  },

  async resendInvite(req: Request, res: Response): Promise<void> {
    try {
      const data = await UsersService.resendInvite(Number(req.params.id));
      sendSuccess(res, { message: 'Invite re-sent.', data });
    } catch (err) {
      sendError(res, (err as Error).message, getStatus(err));
    }
  },

  async setActive(req: Request, res: Response): Promise<void> {
    const data = await UsersService.setDeliveryPartnerActive(Number(req.params.id), Boolean(req.body.is_active));
    if (!data) { sendError(res, 'Delivery partner not found.', 404); return; }
    sendSuccess(res, { message: 'Delivery partner updated.', data });
  },
};
