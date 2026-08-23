import { Request, Response } from 'express';
import { PetsService } from './pets.service';
import { CreatePetDto, UpdatePetDto } from './pets.types';
import { sendSuccess, sendError } from '../../shared/utils/response';

export const PetsController = {
  async list(req: Request, res: Response): Promise<void> {
    const data = await PetsService.listForUser(req.user!.id);
    sendSuccess(res, { message: 'Pets fetched.', data });
  },

  async getOne(req: Request, res: Response): Promise<void> {
    const data = await PetsService.getOne(Number(req.params.id), req.user!.id);
    if (!data) { sendError(res, 'Pet not found.', 404); return; }
    sendSuccess(res, { message: 'Pet fetched.', data });
  },

  async create(req: Request, res: Response): Promise<void> {
    const data = await PetsService.create(req.user!.id, req.body as CreatePetDto);
    sendSuccess(res, { message: 'Pet added.', data }, 201);
  },

  async update(req: Request, res: Response): Promise<void> {
    const data = await PetsService.update(Number(req.params.id), req.user!.id, req.body as UpdatePetDto);
    if (!data) { sendError(res, 'Pet not found.', 404); return; }
    sendSuccess(res, { message: 'Pet updated.', data });
  },

  async remove(req: Request, res: Response): Promise<void> {
    const ok = await PetsService.remove(Number(req.params.id), req.user!.id);
    if (!ok) { sendError(res, 'Pet not found.', 404); return; }
    sendSuccess(res, { message: 'Pet removed.' });
  },
};
