import db from '../../shared/config/database';
import { ProductRow } from '../products/products.types';
import { PRODUCT_COLUMNS, toProduct } from '../products/products.service';
import {
  HealthTip, Brand, Testimonial, Store, HomeContent,
  CreateTipDto, UpdateTipDto, CreateBrandDto, UpdateBrandDto,
  CreateTestimonialDto, UpdateTestimonialDto, CreateStoreDto, UpdateStoreDto,
} from './content.types';

const TIP_COLS = 'id, title, teaser, icon, color_from, color_to, read_mins, sections, sort_order, is_active, created_at';
const BRAND_COLS = `
  b.id, b.name, b.emoji, b.tint, b.image_url, b.sort_order, b.is_active, b.created_at,
  (SELECT COUNT(*)::int FROM products p WHERE p.brand_id = b.id AND p.is_active = true) AS product_count,
  (SELECT COUNT(*)::int FROM products p WHERE p.brand_id = b.id) AS total_products`;

const httpError = (message: string, statusCode: number) => Object.assign(new Error(message), { statusCode });
const TESTIMONIAL_COLS = 'id, owner_name, pet_name, pet_emoji, rating, body, sort_order, is_active, created_at';
const STORE_COLS = 'id, name, area, distance_km, eta_mins, is_open, sort_order, is_active, created_at';

const activeWhere = (activeOnly: boolean): string => (activeOnly ? 'WHERE is_active = true' : '');

export const ContentService = {
  // ─── Aggregate payload for the app's Home screen ─────────────────────────
  async home(): Promise<HomeContent> {
    const [tips, brands, testimonials, stores, flash, settings] = await Promise.all([
      this.listTips(true),
      this.listBrands(true, true),
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
  /**
   * @param activeOnly   hide deactivated brands (app / dropdown for new products)
   * @param withProducts only brands that have at least one active product (what the app shows)
   */
  async listBrands(activeOnly = false, withProducts = false): Promise<Brand[]> {
    const conds: string[] = [];
    if (activeOnly) conds.push('b.is_active = true');
    if (withProducts) conds.push('EXISTS (SELECT 1 FROM products p WHERE p.brand_id = b.id AND p.is_active = true)');
    const { rows } = await db.query<Brand>(
      `SELECT ${BRAND_COLS} FROM brands b ${conds.length ? `WHERE ${conds.join(' AND ')}` : ''}
       ORDER BY b.sort_order ASC, LOWER(b.name) ASC, b.id ASC`
    );
    return rows;
  },

  async getBrand(id: number): Promise<Brand | null> {
    const { rows } = await db.query<Brand>(`SELECT ${BRAND_COLS} FROM brands b WHERE b.id = $1`, [id]);
    return rows[0] ?? null;
  },

  /** Throws 409 if another brand already uses this name (case-insensitive). */
  async assertBrandNameFree(name: string, exceptId?: number): Promise<void> {
    const { rows } = await db.query<{ id: number }>(
      `SELECT id FROM brands WHERE LOWER(name) = LOWER($1) AND ($2::int IS NULL OR id <> $2)`,
      [name.trim(), exceptId ?? null]
    );
    if (rows.length > 0) throw httpError(`A brand named "${name.trim()}" already exists.`, 409);
  },

  async createBrand(dto: CreateBrandDto): Promise<Brand> {
    await this.assertBrandNameFree(dto.name);
    const { rows } = await db.query<{ id: number }>(
      `INSERT INTO brands (name, emoji, tint, image_url, sort_order)
       VALUES ($1, COALESCE($2,'🐾'), COALESCE($3,'#D1FAE5'), $4, COALESCE($5,0))
       RETURNING id`,
      [dto.name.trim(), dto.emoji, dto.tint, dto.image_url || null, dto.sort_order]
    );
    return (await this.getBrand(rows[0].id))!;
  },

  async updateBrand(id: number, dto: UpdateBrandDto): Promise<Brand | null> {
    if (dto.name !== undefined) await this.assertBrandNameFree(dto.name, id);
    // image_url: undefined = keep, '' / null = remove the logo, string = replace.
    const imageGiven = dto.image_url !== undefined;
    const { rows } = await db.query<{ id: number; name: string }>(
      `UPDATE brands SET
         name       = COALESCE($1, name),
         emoji      = COALESCE($2, emoji),
         tint       = COALESCE($3, tint),
         sort_order = COALESCE($4, sort_order),
         is_active  = COALESCE($5, is_active),
         image_url  = CASE WHEN $7::boolean THEN $8 ELSE image_url END
       WHERE id = $6
       RETURNING id, name`,
      [dto.name?.trim() ?? null, dto.emoji ?? null, dto.tint ?? null,
       dto.sort_order ?? null, dto.is_active ?? null, id, imageGiven, dto.image_url || null]
    );
    if (!rows[0]) return null;
    // Keep the denormalised product.brand text in step with a rename.
    if (dto.name !== undefined) {
      await db.query('UPDATE products SET brand = $1 WHERE brand_id = $2', [rows[0].name, id]);
    }
    return this.getBrand(id);
  },

  /** Refuses while products still use the brand — deactivate it instead. */
  async removeBrand(id: number): Promise<boolean> {
    const brand = await this.getBrand(id);
    if (!brand) return false;
    const n = brand.total_products ?? 0;
    if (n > 0) {
      throw httpError(
        `"${brand.name}" is used by ${n} product${n === 1 ? '' : 's'}. Move or delete them first, or deactivate the brand instead.`,
        409
      );
    }
    await db.query('DELETE FROM brands WHERE id = $1', [id]);
    return true;
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
