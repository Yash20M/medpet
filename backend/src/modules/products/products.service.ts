import db from '../../shared/config/database';
import {
  Product, ProductRow, ProductQuery, CreateProductDto, UpdateProductDto,
} from './products.types';

// Exported so wishlist/cart can hydrate full product objects.
export const PRODUCT_COLUMNS = `
  p.id, p.name, p.brand, p.description, p.emoji, p.image_url,
  p.category_id, c.name AS category_name, c.slug AS category_slug,
  p.original_price, p.discount_price, p.rating, p.reviews_count,
  p.stock_quantity, p.low_stock_threshold,
  p.in_stock, p.is_featured, p.is_flash_sale, p.is_active, p.created_at
`;

const SELECT = `
  SELECT ${PRODUCT_COLUMNS}
  FROM products p
  LEFT JOIN categories c ON c.id = p.category_id
`;

export const toProduct = (r: ProductRow): Product => {
  const { rating, is_active: _active, ...rest } = r;
  const discount_percent = r.original_price > 0
    ? Math.round(((r.original_price - r.discount_price) / r.original_price) * 100)
    : 0;
  return { ...rest, rating: Number(rating), discount_percent };
};

export const ProductsService = {
  async list(q: ProductQuery, activeOnly = true): Promise<{ items: Product[]; total: number }> {
    const conds: string[] = [];
    const params: unknown[] = [];

    if (activeOnly) conds.push('p.is_active = true');
    if (q.category) { params.push(q.category); conds.push(`c.slug = $${params.length}`); }
    if (q.featured) conds.push('p.is_featured = true');
    if (q.search) {
      params.push(`%${q.search}%`);
      conds.push(`(p.name ILIKE $${params.length} OR p.brand ILIKE $${params.length})`);
    }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

    const countRes = await db.query<{ count: string }>(
      `SELECT COUNT(*)::int AS count FROM products p LEFT JOIN categories c ON c.id = p.category_id ${where}`,
      params
    );
    const total = Number(countRes.rows[0]?.count ?? 0);

    const page = Math.max(1, q.page ?? 1);
    const limit = Math.min(100, Math.max(1, q.limit ?? 50));
    params.push(limit, (page - 1) * limit);

    const { rows } = await db.query<ProductRow>(
      `${SELECT} ${where} ORDER BY p.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    return { items: rows.map(toProduct), total };
  },

  async getById(id: number): Promise<Product | null> {
    const { rows } = await db.query<ProductRow>(`${SELECT} WHERE p.id = $1`, [id]);
    return rows[0] ? toProduct(rows[0]) : null;
  },

  /**
   * Recommended products for a given product: prefer same category, then fill
   * with other featured/active products. Excludes the product itself.
   */
  async getRelated(id: number, limit = 8): Promise<Product[]> {
    const { rows } = await db.query<ProductRow>(
      `${SELECT}
       WHERE p.is_active = true AND p.id <> $1
       ORDER BY
         (p.category_id = (SELECT category_id FROM products WHERE id = $1)) DESC,
         p.is_featured DESC,
         p.rating DESC,
         p.reviews_count DESC
       LIMIT $2`,
      [id, limit]
    );
    return rows.map(toProduct);
  },

  async create(dto: CreateProductDto): Promise<Product> {
    const { rows } = await db.query<{ id: number }>(
      `INSERT INTO products
         (name, brand, description, emoji, image_url, category_id,
          original_price, discount_price, rating, reviews_count,
          stock_quantity, low_stock_threshold, in_stock, is_featured, is_flash_sale)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,COALESCE($9,4.5),COALESCE($10,0),
               COALESCE($11,100),COALESCE($12,10),COALESCE($13,true),COALESCE($14,false),COALESCE($15,false))
       RETURNING id`,
      [dto.name.trim(), dto.brand ?? '', dto.description ?? '', dto.emoji ?? '💊',
       dto.image_url ?? null, dto.category_id ?? null, dto.original_price, dto.discount_price,
       dto.rating ?? null, dto.reviews_count ?? null, dto.stock_quantity ?? null,
       dto.low_stock_threshold ?? null, dto.in_stock ?? null, dto.is_featured ?? null,
       dto.is_flash_sale ?? null]
    );
    return (await this.getById(rows[0].id))!;
  },

  async update(id: number, dto: UpdateProductDto): Promise<Product | null> {
    const { rows } = await db.query<{ id: number }>(
      `UPDATE products SET
         name                = COALESCE($1, name),
         brand               = COALESCE($2, brand),
         description         = COALESCE($3, description),
         emoji               = COALESCE($4, emoji),
         image_url           = COALESCE($5, image_url),
         category_id         = COALESCE($6, category_id),
         original_price      = COALESCE($7, original_price),
         discount_price      = COALESCE($8, discount_price),
         rating              = COALESCE($9, rating),
         reviews_count       = COALESCE($10, reviews_count),
         stock_quantity      = COALESCE($11, stock_quantity),
         low_stock_threshold = COALESCE($12, low_stock_threshold),
         in_stock            = COALESCE($13, in_stock),
         is_featured         = COALESCE($14, is_featured),
         is_flash_sale       = COALESCE($15, is_flash_sale),
         is_active           = COALESCE($16, is_active)
       WHERE id = $17
       RETURNING id`,
      [dto.name?.trim() ?? null, dto.brand ?? null, dto.description ?? null, dto.emoji ?? null,
       dto.image_url ?? null, dto.category_id ?? null, dto.original_price ?? null,
       dto.discount_price ?? null, dto.rating ?? null, dto.reviews_count ?? null,
       dto.stock_quantity ?? null, dto.low_stock_threshold ?? null,
       dto.in_stock ?? null, dto.is_featured ?? null, dto.is_flash_sale ?? null,
       dto.is_active ?? null, id]
    );
    if (!rows[0]) return null;
    return this.getById(rows[0].id);
  },

  async remove(id: number): Promise<boolean> {
    const { rowCount } = await db.query('DELETE FROM products WHERE id = $1', [id]);
    return (rowCount ?? 0) > 0;
  },

  /** Used by orders on checkout — clamps at 0 and flips in_stock off when exhausted. */
  async decrementStock(id: number, quantity: number): Promise<void> {
    await db.query(
      `UPDATE products SET
         stock_quantity = GREATEST(stock_quantity - $1, 0),
         in_stock = (GREATEST(stock_quantity - $1, 0) > 0)
       WHERE id = $2`,
      [quantity, id]
    );
  },

  async listLowStock(): Promise<Product[]> {
    const { rows } = await db.query<ProductRow>(
      `${SELECT} WHERE p.is_active = true AND p.stock_quantity <= p.low_stock_threshold
       ORDER BY p.stock_quantity ASC`
    );
    return rows.map(toProduct);
  },
};
