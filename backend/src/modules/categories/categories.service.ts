import db from '../../shared/config/database';
import { Category, CreateCategoryDto, UpdateCategoryDto } from './categories.types';

const slugify = (s: string): string =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const COLS = 'id, name, slug, icon, image_url, parent_id, color, icon_bg, sort_order, is_active, created_at';
// Prefixed + joined variant so the admin list can show the parent category name.
const SELECT_WITH_PARENT = `
  SELECT c.id, c.name, c.slug, c.icon, c.image_url, c.parent_id,
         p.name AS parent_name, c.color, c.icon_bg, c.sort_order, c.is_active, c.created_at
  FROM categories c
  LEFT JOIN categories p ON p.id = c.parent_id
`;

export const CategoriesService = {
  async list(activeOnly: boolean): Promise<Category[]> {
    const where = activeOnly ? 'WHERE c.is_active = true' : '';
    const { rows } = await db.query<Category>(
      `${SELECT_WITH_PARENT} ${where}
       ORDER BY COALESCE(c.parent_id, c.id) ASC, c.parent_id NULLS FIRST, c.sort_order ASC, c.name ASC`
    );
    return rows;
  },

  async getById(id: number): Promise<Category | null> {
    const { rows } = await db.query<Category>(
      `${SELECT_WITH_PARENT} WHERE c.id = $1`,
      [id]
    );
    return rows[0] ?? null;
  },

  async create(dto: CreateCategoryDto): Promise<Category> {
    const slug = dto.slug?.trim() || slugify(dto.name);
    const { rows } = await db.query<{ id: number }>(
      `INSERT INTO categories (name, slug, icon, image_url, parent_id, color, icon_bg, sort_order)
       VALUES ($1, $2, COALESCE($3,'🐾'), $4, $5, COALESCE($6,'#FDE8EA'), COALESCE($7,'#F8B7BE'), COALESCE($8,0))
       RETURNING id`,
      [dto.name.trim(), slug, dto.icon, dto.image_url ?? null, dto.parent_id ?? null, dto.color, dto.icon_bg, dto.sort_order]
    );
    return (await this.getById(rows[0].id))!;
  },

  async update(id: number, dto: UpdateCategoryDto): Promise<Category | null> {
    // Guard against a category becoming its own parent.
    const parentId = dto.parent_id === id ? null : dto.parent_id;
    const { rows } = await db.query<{ id: number }>(
      `UPDATE categories SET
         name       = COALESCE($1, name),
         slug       = COALESCE($2, slug),
         icon       = COALESCE($3, icon),
         image_url  = COALESCE($4, image_url),
         parent_id  = $5,
         color      = COALESCE($6, color),
         icon_bg    = COALESCE($7, icon_bg),
         sort_order = COALESCE($8, sort_order),
         is_active  = COALESCE($9, is_active)
       WHERE id = $10
       RETURNING id`,
      [dto.name?.trim() ?? null, dto.slug?.trim() ?? null, dto.icon ?? null,
       dto.image_url ?? null, parentId ?? null, dto.color ?? null, dto.icon_bg ?? null, dto.sort_order ?? null,
       dto.is_active ?? null, id]
    );
    if (!rows[0]) return null;
    return this.getById(rows[0].id);
  },

  async remove(id: number): Promise<boolean> {
    const { rowCount } = await db.query('DELETE FROM categories WHERE id = $1', [id]);
    return (rowCount ?? 0) > 0;
  },
};
