import db from '../../shared/config/database';
import {
  Product, ProductRow, ProductQuery, CreateProductDto, UpdateProductDto,
  ProductVariant, VariantInput,
} from './products.types';

// Exported so wishlist/cart can hydrate full product objects.
export const PRODUCT_COLUMNS = `
  p.id, p.name, p.brand, p.brand_id, p.description, p.emoji, p.image_url, p.image_urls, p.manufacturer_details, p.ingredients, p.uses,
  p.category_id, c.name AS category_name, c.slug AS category_slug,
  p.original_price, p.discount_price, p.rating, p.reviews_count,
  p.stock_quantity, p.low_stock_threshold,
  p.in_stock, p.is_featured, p.is_flash_sale, p.is_accessory, p.pet_types, p.is_active, p.created_at
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

const pct = (orig: number, disc: number): number => (orig > 0 ? Math.round(((orig - disc) / orig) * 100) : 0);

/** Loads size variants for the given products in one query and attaches them (empty list when none). */
export const attachVariants = async (products: Product[]): Promise<Product[]> => {
  if (products.length === 0) return products;
  const { rows } = await db.query<Omit<ProductVariant, 'discount_percent'>>(
    `SELECT id, product_id, label, original_price, discount_price, stock_quantity, sort_order
     FROM product_variants WHERE product_id = ANY($1) ORDER BY sort_order ASC, id ASC`,
    [products.map((p) => p.id)]
  );
  return products.map((p) => ({
    ...p,
    variants: rows.filter((v) => v.product_id === p.id)
      .map((v) => ({ ...v, discount_percent: pct(v.original_price, v.discount_price) })),
  }));
};

/**
 * Replace a product's variants with `input` (update by id, insert new, delete the rest) and
 * refresh the product summary: cheapest variant's prices, total stock, out of stock at 0.
 */
const saveVariants = async (productId: number, input: VariantInput[]): Promise<void> => {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    const { rows: existing } = await client.query<{ id: number }>('SELECT id FROM product_variants WHERE product_id = $1', [productId]);
    const owned = new Set(existing.map((r) => r.id));
    const keep: number[] = [];
    for (let i = 0; i < input.length; i++) {
      const v = input[i];
      const args = [v.label.trim(), v.original_price, v.discount_price, v.stock_quantity, i];
      if (v.id !== undefined && owned.has(Number(v.id))) {
        await client.query(
          `UPDATE product_variants SET label=$1, original_price=$2, discount_price=$3, stock_quantity=$4, sort_order=$5 WHERE id=$6`,
          [...args, v.id]
        );
        keep.push(Number(v.id));
      } else {
        const { rows } = await client.query<{ id: number }>(
          `INSERT INTO product_variants (label, original_price, discount_price, stock_quantity, sort_order, product_id)
           VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
          [...args, productId]
        );
        keep.push(rows[0].id);
      }
    }
    await client.query('DELETE FROM product_variants WHERE product_id = $1 AND id <> ALL($2::int[])', [productId, keep]);
    if (input.length > 0) {
      await client.query(
        `UPDATE products p SET
           original_price = c.original_price, discount_price = c.discount_price,
           stock_quantity = c.total, in_stock = (c.total > 0 AND p.in_stock)
         FROM (
           SELECT (SELECT original_price FROM product_variants WHERE product_id = $1 ORDER BY discount_price ASC, sort_order ASC LIMIT 1) AS original_price,
                  (SELECT MIN(discount_price) FROM product_variants WHERE product_id = $1) AS discount_price,
                  (SELECT COALESCE(SUM(stock_quantity), 0)::int FROM product_variants WHERE product_id = $1) AS total
         ) c
         WHERE p.id = $1`,
        [productId]
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

const uniq = (a: string[]): string[] => Array.from(new Set(a));

const httpError = (message: string, statusCode: number) => Object.assign(new Error(message), { statusCode });

/**
 * Decide the (brand_id, brand text) pair to store for a create/update.
 *  - `brand_id` given → must exist; the name is copied from the brand.
 *  - `brand_id: null` → brand cleared.
 *  - only legacy `brand` text → matched case-insensitively to a managed brand, or a new
 *    brand is created so product and brand lists never drift apart.
 *  - neither → `undefined` (leave untouched on update).
 */
async function resolveBrand(
  dto: { brand_id?: number | null; brand?: string }
): Promise<{ brand_id: number | null; brand: string } | undefined> {
  if (dto.brand_id === null) return { brand_id: null, brand: '' };
  if (dto.brand_id !== undefined) {
    const { rows } = await db.query<{ id: number; name: string }>('SELECT id, name FROM brands WHERE id = $1', [dto.brand_id]);
    if (!rows[0]) throw httpError('Selected brand does not exist.', 400);
    return { brand_id: rows[0].id, brand: rows[0].name };
  }
  const name = dto.brand?.trim();
  if (dto.brand === undefined) return undefined;
  if (!name) return { brand_id: null, brand: '' };
  const found = await db.query<{ id: number; name: string }>('SELECT id, name FROM brands WHERE LOWER(name) = LOWER($1) ORDER BY id LIMIT 1', [name]);
  if (found.rows[0]) return { brand_id: found.rows[0].id, brand: found.rows[0].name };
  const made = await db.query<{ id: number; name: string }>(
    `INSERT INTO brands (name, sort_order) VALUES ($1, 100) RETURNING id, name`, [name]
  );
  return { brand_id: made.rows[0].id, brand: made.rows[0].name };
}

export const ProductsService = {
  async list(q: ProductQuery, activeOnly = true): Promise<{ items: Product[]; total: number }> {
    const conds: string[] = [];
    const params: unknown[] = [];

    if (activeOnly) conds.push('p.is_active = true');
    if (q.category) { params.push(q.category); conds.push(`c.slug = $${params.length}`); }
    if (q.featured) conds.push('p.is_featured = true');
    if (q.accessory !== undefined) conds.push(`p.is_accessory = ${q.accessory ? 'true' : 'false'}`);
    if (q.petType) {
      params.push(q.petType);
      // Accessories tagged for this pet, or for every pet (empty list). Non-accessories never match.
      conds.push(`(p.is_accessory = true AND (cardinality(p.pet_types) = 0 OR $${params.length} = ANY(p.pet_types)))`);
    }
    if (q.brandId) { params.push(q.brandId); conds.push(`p.brand_id = $${params.length}`); }
    if (q.brand) { params.push(q.brand.trim()); conds.push(`LOWER(p.brand) = LOWER($${params.length})`); }
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
      `${SELECT} ${where} ORDER BY p.created_at DESC, p.id DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    return { items: await attachVariants(rows.map(toProduct)), total };
  },

  async getById(id: number): Promise<Product | null> {
    const { rows } = await db.query<ProductRow>(`${SELECT} WHERE p.id = $1`, [id]);
    return rows[0] ? (await attachVariants([toProduct(rows[0])]))[0] : null;
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
         (p.is_accessory = (SELECT is_accessory FROM products WHERE id = $1)) DESC,
         (p.category_id = (SELECT category_id FROM products WHERE id = $1)) DESC,
         p.is_featured DESC,
         p.rating DESC,
         p.reviews_count DESC
       LIMIT $2`,
      [id, limit]
    );
    return attachVariants(rows.map(toProduct));
  },

  async create(dto: CreateProductDto): Promise<Product> {
    const b = (await resolveBrand(dto)) ?? { brand_id: null, brand: '' };
    const { rows } = await db.query<{ id: number }>(
      `INSERT INTO products
         (name, brand, brand_id, description, emoji, image_url, category_id,
          original_price, discount_price, rating, reviews_count,
          stock_quantity, low_stock_threshold, in_stock, is_featured, is_flash_sale,
          is_accessory, pet_types, image_urls, manufacturer_details, ingredients, uses)
       VALUES ($1,$2,$3,$4,$5,COALESCE(($19::text[])[1], $6),$7,$8,$9,COALESCE($10,4.5),COALESCE($11,0),
               COALESCE($12,100),COALESCE($13,10),COALESCE($14,true),COALESCE($15,false),COALESCE($16,false),
               COALESCE($17,false), COALESCE($18::text[], '{}'), COALESCE($19::text[], '{}'),
               COALESCE($20,''), COALESCE($21,''), COALESCE($22,''))
       RETURNING id`,
      [dto.name.trim(), b.brand, b.brand_id, dto.description ?? '', dto.emoji ?? '💊',
       dto.image_url ?? null, dto.category_id ?? null, dto.original_price, dto.discount_price,
       dto.rating ?? null, dto.reviews_count ?? null, dto.stock_quantity ?? null,
       dto.low_stock_threshold ?? null, dto.in_stock ?? null, dto.is_featured ?? null,
       dto.is_flash_sale ?? null, dto.is_accessory ?? null, dto.pet_types ? uniq(dto.pet_types) : null,
       dto.image_urls ?? null, dto.manufacturer_details?.trim() ?? null, dto.ingredients?.trim() ?? null,
       dto.uses?.trim() ?? null]
    );
    if (dto.variants?.length) await saveVariants(rows[0].id, dto.variants);
    return (await this.getById(rows[0].id))!;
  },

  async update(id: number, dto: UpdateProductDto): Promise<Product | null> {
    // undefined = leave the brand alone; otherwise set both columns together.
    const b = await resolveBrand(dto);
    const { rows } = await db.query<{ id: number }>(
      `UPDATE products SET
         name                = COALESCE($1, name),
         brand               = CASE WHEN $18::boolean THEN $2 ELSE brand END,
         brand_id            = CASE WHEN $18::boolean THEN $19::int ELSE brand_id END,
         description         = COALESCE($3, description),
         emoji               = COALESCE($4, emoji),
         image_url           = CASE WHEN $22::text[] IS NOT NULL THEN ($22::text[])[1] ELSE COALESCE($5, image_url) END,
         image_urls          = COALESCE($22::text[], image_urls),
         manufacturer_details = COALESCE($23, manufacturer_details),
         ingredients         = COALESCE($24, ingredients),
         uses                = COALESCE($25, uses),
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
         is_active           = COALESCE($16, is_active),
         is_accessory        = COALESCE($20, is_accessory),
         pet_types           = COALESCE($21::text[], pet_types)
       WHERE id = $17
       RETURNING id`,
      [dto.name?.trim() ?? null, b?.brand ?? null, dto.description ?? null, dto.emoji ?? null,
       dto.image_url ?? null, dto.category_id ?? null, dto.original_price ?? null,
       dto.discount_price ?? null, dto.rating ?? null, dto.reviews_count ?? null,
       dto.stock_quantity ?? null, dto.low_stock_threshold ?? null,
       dto.in_stock ?? null, dto.is_featured ?? null, dto.is_flash_sale ?? null,
       dto.is_active ?? null, id, b !== undefined, b?.brand_id ?? null,
       dto.is_accessory ?? null, dto.pet_types ? uniq(dto.pet_types) : null, dto.image_urls ?? null,
       dto.manufacturer_details?.trim() ?? null, dto.ingredients?.trim() ?? null, dto.uses?.trim() ?? null]
    );
    if (!rows[0]) return null;
    if (dto.variants) await saveVariants(rows[0].id, dto.variants);
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
    return attachVariants(rows.map(toProduct));
  },
};
