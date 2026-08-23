import db from '../../shared/config/database';
import { ProductRow } from '../products/products.types';
import { PRODUCT_COLUMNS, toProduct } from '../products/products.service';
import {
  HealthTip, Brand, Testimonial, Store, HomeContent,
  CreateTipDto, UpdateTipDto, CreateBrandDto, UpdateBrandDto,
  CreateTestimonialDto, UpdateTestimonialDto, CreateStoreDto, UpdateStoreDto,
} from './content.types';

const TIP_COLS = 'id, title, teaser, icon, color_from, color_to, read_mins, sections, sort_order, is_active, created_at';
const BRAND_COLS = 'id, name, emoji, tint, sort_order, is_active, created_at';
const TESTIMONIAL_COLS = 'id, owner_name, pet_name, pet_emoji, rating, body, sort_order, is_active, created_at';
const STORE_COLS = 'id, name, area, distance_km, eta_mins, is_open, sort_order, is_active, created_at';

const activeWhere = (activeOnly: boolean): string => (activeOnly ? 'WHERE is_active = true' : '');

export const ContentService = {
  // ─── Aggregate payload for the app's Home screen ─────────────────────────
  async home(): Promise<HomeContent> {
    const [tips, brands, testimonials, stores, flash, settings] = await Promise.all([
      this.listTips(true),
      this.listBrands(true),
      this.listTestimonials(true),
      this.listStores(true),
      db.query<ProductRow>(
        `SELECT ${PRODUCT_COLUMNS} FROM products p
         LEFT JOIN categories c ON c.id = p.category_id
         WHERE p.is_active = true AND p.is_flash_sale = true
         ORDER BY p.created_at DESC LIMIT 10`
      ),
      this.getSettings(),
    ]);
    return {
      tips, brands, testimonials, stores,
      flash_products: flash.rows.map(toProduct),
      settings,
    };
  },

  // ─── Health tips ──────────────────────────────────────────────────────────
  async listTips(activeOnly = false): Promise<HealthTip[]> {
    const { rows } = await db.query<HealthTip>(
      `SELECT ${TIP_COLS} FROM health_tips ${activeWhere(activeOnly)} ORDER BY sort_order ASC, id ASC`
    );
    return rows;
  },

  async createTip(dto: CreateTipDto): Promise<HealthTip> {
    const { rows } = await db.query<HealthTip>(
      `INSERT INTO health_tips (title, teaser, icon, color_from, color_to, read_mins, sections, sort_order)
       VALUES ($1, COALESCE($2,''), COALESCE($3,'sunny'), COALESCE($4,'#FCD34D'), COALESCE($5,'#F59E0B'),
               COALESCE($6,3), COALESCE($7,'[]')::jsonb, COALESCE($8,0))
       RETURNING ${TIP_COLS}`,
      [dto.title.trim(), dto.teaser, dto.icon, dto.color_from, dto.color_to,
       dto.read_mins, dto.sections ? JSON.stringify(dto.sections) : null, dto.sort_order]
    );
    return rows[0];
  },

  async updateTip(id: number, dto: UpdateTipDto): Promise<HealthTip | null> {
    const { rows } = await db.query<HealthTip>(
      `UPDATE health_tips SET
         title      = COALESCE($1, title),
         teaser     = COALESCE($2, teaser),
         icon       = COALESCE($3, icon),
         color_from = COALESCE($4, color_from),
         color_to   = COALESCE($5, color_to),
         read_mins  = COALESCE($6, read_mins),
         sections   = COALESCE($7::jsonb, sections),
         sort_order = COALESCE($8, sort_order),
         is_active  = COALESCE($9, is_active)
       WHERE id = $10
       RETURNING ${TIP_COLS}`,
      [dto.title?.trim() ?? null, dto.teaser ?? null, dto.icon ?? null,
       dto.color_from ?? null, dto.color_to ?? null, dto.read_mins ?? null,
       dto.sections ? JSON.stringify(dto.sections) : null, dto.sort_order ?? null,
       dto.is_active ?? null, id]
    );
    return rows[0] ?? null;
  },

  async removeTip(id: number): Promise<boolean> {
    const { rowCount } = await db.query('DELETE FROM health_tips WHERE id = $1', [id]);
    return (rowCount ?? 0) > 0;
  },

  // ─── Brands ───────────────────────────────────────────────────────────────
  async listBrands(activeOnly = false): Promise<Brand[]> {
    const { rows } = await db.query<Brand>(
      `SELECT ${BRAND_COLS} FROM brands ${activeWhere(activeOnly)} ORDER BY sort_order ASC, id ASC`
    );
    return rows;
  },

  async createBrand(dto: CreateBrandDto): Promise<Brand> {
    const { rows } = await db.query<Brand>(
      `INSERT INTO brands (name, emoji, tint, sort_order)
       VALUES ($1, COALESCE($2,'🐾'), COALESCE($3,'#D1FAE5'), COALESCE($4,0))
       RETURNING ${BRAND_COLS}`,
      [dto.name.trim(), dto.emoji, dto.tint, dto.sort_order]
    );
    return rows[0];
  },

  async updateBrand(id: number, dto: UpdateBrandDto): Promise<Brand | null> {
    const { rows } = await db.query<Brand>(
      `UPDATE brands SET
         name       = COALESCE($1, name),
         emoji      = COALESCE($2, emoji),
         tint       = COALESCE($3, tint),
         sort_order = COALESCE($4, sort_order),
         is_active  = COALESCE($5, is_active)
       WHERE id = $6
       RETURNING ${BRAND_COLS}`,
      [dto.name?.trim() ?? null, dto.emoji ?? null, dto.tint ?? null,
       dto.sort_order ?? null, dto.is_active ?? null, id]
    );
    return rows[0] ?? null;
  },

  async removeBrand(id: number): Promise<boolean> {
    const { rowCount } = await db.query('DELETE FROM brands WHERE id = $1', [id]);
    return (rowCount ?? 0) > 0;
  },

  // ─── Testimonials ─────────────────────────────────────────────────────────
  async listTestimonials(activeOnly = false): Promise<Testimonial[]> {
    const { rows } = await db.query<Testimonial>(
      `SELECT ${TESTIMONIAL_COLS} FROM testimonials ${activeWhere(activeOnly)} ORDER BY sort_order ASC, id ASC`
    );
    return rows;
  },

  async createTestimonial(dto: CreateTestimonialDto): Promise<Testimonial> {
    const { rows } = await db.query<Testimonial>(
      `INSERT INTO testimonials (owner_name, pet_name, pet_emoji, rating, body, sort_order)
       VALUES ($1, COALESCE($2,''), COALESCE($3,'🐕'), COALESCE($4,5), $5, COALESCE($6,0))
       RETURNING ${TESTIMONIAL_COLS}`,
      [dto.owner_name.trim(), dto.pet_name, dto.pet_emoji, dto.rating, dto.body.trim(), dto.sort_order]
    );
    return rows[0];
  },

  async updateTestimonial(id: number, dto: UpdateTestimonialDto): Promise<Testimonial | null> {
    const { rows } = await db.query<Testimonial>(
      `UPDATE testimonials SET
         owner_name = COALESCE($1, owner_name),
         pet_name   = COALESCE($2, pet_name),
         pet_emoji  = COALESCE($3, pet_emoji),
         rating     = COALESCE($4, rating),
         body       = COALESCE($5, body),
         sort_order = COALESCE($6, sort_order),
         is_active  = COALESCE($7, is_active)
       WHERE id = $8
       RETURNING ${TESTIMONIAL_COLS}`,
      [dto.owner_name?.trim() ?? null, dto.pet_name ?? null, dto.pet_emoji ?? null,
       dto.rating ?? null, dto.body?.trim() ?? null, dto.sort_order ?? null,
       dto.is_active ?? null, id]
    );
    return rows[0] ?? null;
  },

  async removeTestimonial(id: number): Promise<boolean> {
    const { rowCount } = await db.query('DELETE FROM testimonials WHERE id = $1', [id]);
    return (rowCount ?? 0) > 0;
  },

  // ─── Stores ───────────────────────────────────────────────────────────────
  async listStores(activeOnly = false): Promise<Store[]> {
    const { rows } = await db.query<Store>(
      `SELECT ${STORE_COLS} FROM stores ${activeWhere(activeOnly)} ORDER BY sort_order ASC, id ASC`
    );
    return rows;
  },

  async createStore(dto: CreateStoreDto): Promise<Store> {
    const { rows } = await db.query<Store>(
      `INSERT INTO stores (name, area, distance_km, eta_mins, is_open, sort_order)
       VALUES ($1, COALESCE($2,''), COALESCE($3,1.0), COALESCE($4,20), COALESCE($5,true), COALESCE($6,0))
       RETURNING ${STORE_COLS}`,
      [dto.name.trim(), dto.area, dto.distance_km, dto.eta_mins, dto.is_open, dto.sort_order]
    );
    return rows[0];
  },

  async updateStore(id: number, dto: UpdateStoreDto): Promise<Store | null> {
    const { rows } = await db.query<Store>(
      `UPDATE stores SET
         name        = COALESCE($1, name),
         area        = COALESCE($2, area),
         distance_km = COALESCE($3, distance_km),
         eta_mins    = COALESCE($4, eta_mins),
         is_open     = COALESCE($5, is_open),
         sort_order  = COALESCE($6, sort_order),
         is_active   = COALESCE($7, is_active)
       WHERE id = $8
       RETURNING ${STORE_COLS}`,
      [dto.name?.trim() ?? null, dto.area ?? null, dto.distance_km ?? null,
       dto.eta_mins ?? null, dto.is_open ?? null, dto.sort_order ?? null,
       dto.is_active ?? null, id]
    );
    return rows[0] ?? null;
  },

  async removeStore(id: number): Promise<boolean> {
    const { rowCount } = await db.query('DELETE FROM stores WHERE id = $1', [id]);
    return (rowCount ?? 0) > 0;
  },

  // ─── Settings ─────────────────────────────────────────────────────────────
  async getSettings(): Promise<Record<string, string>> {
    const { rows } = await db.query<{ key: string; value: string }>('SELECT key, value FROM app_settings');
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  },

  async setSettings(entries: Record<string, string>): Promise<Record<string, string>> {
    for (const [key, value] of Object.entries(entries)) {
      await db.query(
        `INSERT INTO app_settings (key, value) VALUES ($1, $2)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`,
        [key, String(value)]
      );
    }
    return this.getSettings();
  },
};
