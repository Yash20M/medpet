import { Request, Response } from 'express';
import { ProductsService } from './products.service';
import { CreateProductDto, UpdateProductDto, ProductQuery } from './products.types';
import { sendSuccess, sendError } from '../../shared/utils/response';

const parseQuery = (req: Request): ProductQuery => ({
  category: req.query.category as string | undefined,
  featured: req.query.featured === 'true',
  accessory: req.query.accessory === 'true' ? true : req.query.accessory === 'false' ? false : undefined,
  petType: typeof req.query.pet_type === 'string' && req.query.pet_type ? req.query.pet_type.toLowerCase() : undefined,
  search: req.query.search as string | undefined,
  brandId: req.query.brand_id ? Number(req.query.brand_id) || undefined : undefined,
  brand: req.query.brand as string | undefined,
  page: req.query.page ? Number(req.query.page) : undefined,
  limit: req.query.limit ? Number(req.query.limit) : undefined,
});

export const ProductsController = {
  async listPublic(req: Request, res: Response): Promise<void> {
    const q = parseQuery(req);
    const { items, total } = await ProductsService.list(q, true);
    const limit = Math.min(100, Math.max(1, q.limit ?? 50));
    const page = Math.max(1, q.page ?? 1);
    res.json({
      success: true, message: 'Products fetched.', data: items,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  },

  async listAdmin(req: Request, res: Response): Promise<void> {
    const { items, total } = await ProductsService.list(parseQuery(req), false);
    res.json({ success: true, message: 'Products fetched.', data: items, total });
  },

  async listLowStock(_req: Request, res: Response): Promise<void> {
    const data = await ProductsService.listLowStock();
    sendSuccess(res, { message: 'Low-stock products fetched.', data });
  },

  async getOne(req: Request, res: Response): Promise<void> {
    const data = await ProductsService.getById(Number(req.params.id));
    if (!data) { sendError(res, 'Product not found.', 404); return; }
    sendSuccess(res, { message: 'Product fetched.', data });
  },

  async getRelated(req: Request, res: Response): Promise<void> {
    const limit = req.query.limit ? Number(req.query.limit) : 8;
    const data = await ProductsService.getRelated(Number(req.params.id), Math.min(20, Math.max(1, limit)));
    sendSuccess(res, { message: 'Related products fetched.', data });
  },

  async create(req: Request, res: Response): Promise<void> {
    try {
      const data = await ProductsService.create(req.body as CreateProductDto);
      sendSuccess(res, { message: 'Product created.', data }, 201);
    } catch (err) {
      sendError(res, (err as Error).message, (err as { statusCode?: number }).statusCode ?? 400);
    }
  },

  async update(req: Request, res: Response): Promise<void> {
    try {
      const data = await ProductsService.update(Number(req.params.id), req.body as UpdateProductDto);
      if (!data) { sendError(res, 'Product not found.', 404); return; }
      sendSuccess(res, { message: 'Product updated.', data });
    } catch (err) {
      sendError(res, (err as Error).message, (err as { statusCode?: number }).statusCode ?? 400);
    }
  },

  async remove(req: Request, res: Response): Promise<void> {
    const ok = await ProductsService.remove(Number(req.params.id));
    if (!ok) { sendError(res, 'Product not found.', 404); return; }
    sendSuccess(res, { message: 'Product deleted.' });
  },
};
