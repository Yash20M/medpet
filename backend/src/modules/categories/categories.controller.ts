import { Request, Response } from 'express';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto, UpdateCategoryDto } from './categories.types';
import { sendSuccess, sendError } from '../../shared/utils/response';

export const CategoriesController = {
  async listPublic(_req: Request, res: Response): Promise<void> {
    const data = await CategoriesService.list(true);
    sendSuccess(res, { message: 'Categories fetched.', data });
  },

  async listAdmin(_req: Request, res: Response): Promise<void> {
    const data = await CategoriesService.list(false);
    sendSuccess(res, { message: 'Categories fetched.', data });
  },

  async create(req: Request, res: Response): Promise<void> {
    try {
      const data = await CategoriesService.create(req.body as CreateCategoryDto);
      sendSuccess(res, { message: 'Category created.', data }, 201);
    } catch (err) {
      sendError(res, (err as Error).message, 400);
    }
  },

  async update(req: Request, res: Response): Promise<void> {
    const data = await CategoriesService.update(Number(req.params.id), req.body as UpdateCategoryDto);
    if (!data) { sendError(res, 'Category not found.', 404); return; }
    sendSuccess(res, { message: 'Category updated.', data });
  },

  async remove(req: Request, res: Response): Promise<void> {
    const ok = await CategoriesService.remove(Number(req.params.id));
    if (!ok) { sendError(res, 'Category not found.', 404); return; }
    sendSuccess(res, { message: 'Category deleted.' });
  },
};
