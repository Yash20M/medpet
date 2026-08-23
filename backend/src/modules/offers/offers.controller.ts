import { Request, Response } from 'express';
import { OffersService } from './offers.service';
import { CreateOfferDto, UpdateOfferDto } from './offers.types';
import { sendSuccess, sendError } from '../../shared/utils/response';

export const OffersController = {
  async listPublic(_req: Request, res: Response): Promise<void> {
    sendSuccess(res, { message: 'Offers fetched.', data: await OffersService.list(true) });
  },

  async listAdmin(_req: Request, res: Response): Promise<void> {
    sendSuccess(res, { message: 'Offers fetched.', data: await OffersService.list(false) });
  },

  async create(req: Request, res: Response): Promise<void> {
    try {
      const data = await OffersService.create(req.body as CreateOfferDto);
      sendSuccess(res, { message: 'Offer created.', data }, 201);
    } catch (err) {
      sendError(res, (err as Error).message, 400);
    }
  },

  async update(req: Request, res: Response): Promise<void> {
    const data = await OffersService.update(Number(req.params.id), req.body as UpdateOfferDto);
    if (!data) { sendError(res, 'Offer not found.', 404); return; }
    sendSuccess(res, { message: 'Offer updated.', data });
  },

  async remove(req: Request, res: Response): Promise<void> {
    const ok = await OffersService.remove(Number(req.params.id));
    if (!ok) { sendError(res, 'Offer not found.', 404); return; }
    sendSuccess(res, { message: 'Offer deleted.' });
  },
};
