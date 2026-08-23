import { Request, Response } from 'express';
import { ContentService } from './content.service';
import {
  CreateTipDto, UpdateTipDto, CreateBrandDto, UpdateBrandDto,
  CreateTestimonialDto, UpdateTestimonialDto, CreateStoreDto, UpdateStoreDto,
} from './content.types';
import { sendSuccess, sendError } from '../../shared/utils/response';

export const ContentController = {
  // Public — one aggregate payload for the app's Home screen.
  async home(_req: Request, res: Response): Promise<void> {
    sendSuccess(res, { message: 'Content fetched.', data: await ContentService.home() });
  },

  // Admin — everything including inactive rows, for the management UI.
  async adminAll(_req: Request, res: Response): Promise<void> {
    const [tips, brands, testimonials, stores, settings] = await Promise.all([
      ContentService.listTips(false),
      ContentService.listBrands(false),
      ContentService.listTestimonials(false),
      ContentService.listStores(false),
      ContentService.getSettings(),
    ]);
    sendSuccess(res, { message: 'Content fetched.', data: { tips, brands, testimonials, stores, settings } });
  },

  // ─── Tips ────────────────────────────────────────────────
  async createTip(req: Request, res: Response): Promise<void> {
    sendSuccess(res, { message: 'Tip created.', data: await ContentService.createTip(req.body as CreateTipDto) }, 201);
  },
  async updateTip(req: Request, res: Response): Promise<void> {
    const data = await ContentService.updateTip(Number(req.params.id), req.body as UpdateTipDto);
    if (!data) { sendError(res, 'Tip not found.', 404); return; }
    sendSuccess(res, { message: 'Tip updated.', data });
  },
  async removeTip(req: Request, res: Response): Promise<void> {
    if (!(await ContentService.removeTip(Number(req.params.id)))) { sendError(res, 'Tip not found.', 404); return; }
    sendSuccess(res, { message: 'Tip deleted.' });
  },

  // ─── Brands ──────────────────────────────────────────────
  async createBrand(req: Request, res: Response): Promise<void> {
    sendSuccess(res, { message: 'Brand created.', data: await ContentService.createBrand(req.body as CreateBrandDto) }, 201);
  },
  async updateBrand(req: Request, res: Response): Promise<void> {
    const data = await ContentService.updateBrand(Number(req.params.id), req.body as UpdateBrandDto);
    if (!data) { sendError(res, 'Brand not found.', 404); return; }
    sendSuccess(res, { message: 'Brand updated.', data });
  },
  async removeBrand(req: Request, res: Response): Promise<void> {
    if (!(await ContentService.removeBrand(Number(req.params.id)))) { sendError(res, 'Brand not found.', 404); return; }
    sendSuccess(res, { message: 'Brand deleted.' });
  },

  // ─── Testimonials ────────────────────────────────────────
  async createTestimonial(req: Request, res: Response): Promise<void> {
    sendSuccess(res, {
      message: 'Testimonial created.',
      data: await ContentService.createTestimonial(req.body as CreateTestimonialDto),
    }, 201);
  },
  async updateTestimonial(req: Request, res: Response): Promise<void> {
    const data = await ContentService.updateTestimonial(Number(req.params.id), req.body as UpdateTestimonialDto);
    if (!data) { sendError(res, 'Testimonial not found.', 404); return; }
    sendSuccess(res, { message: 'Testimonial updated.', data });
  },
  async removeTestimonial(req: Request, res: Response): Promise<void> {
    if (!(await ContentService.removeTestimonial(Number(req.params.id)))) { sendError(res, 'Testimonial not found.', 404); return; }
    sendSuccess(res, { message: 'Testimonial deleted.' });
  },

  // ─── Stores ──────────────────────────────────────────────
  async createStore(req: Request, res: Response): Promise<void> {
    sendSuccess(res, { message: 'Store created.', data: await ContentService.createStore(req.body as CreateStoreDto) }, 201);
  },
  async updateStore(req: Request, res: Response): Promise<void> {
    const data = await ContentService.updateStore(Number(req.params.id), req.body as UpdateStoreDto);
    if (!data) { sendError(res, 'Store not found.', 404); return; }
    sendSuccess(res, { message: 'Store updated.', data });
  },
  async removeStore(req: Request, res: Response): Promise<void> {
    if (!(await ContentService.removeStore(Number(req.params.id)))) { sendError(res, 'Store not found.', 404); return; }
    sendSuccess(res, { message: 'Store deleted.' });
  },

  // ─── Settings ────────────────────────────────────────────
  async updateSettings(req: Request, res: Response): Promise<void> {
    const entries = req.body as Record<string, string>;
    if (!entries || typeof entries !== 'object' || Array.isArray(entries)) {
      sendError(res, 'Body must be an object of key/value settings.', 400);
      return;
    }
    sendSuccess(res, { message: 'Settings updated.', data: await ContentService.setSettings(entries) });
  },
};
