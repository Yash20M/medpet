import db from '../../shared/config/database';
import { PRODUCT_COLUMNS, toProduct } from '../products/products.service';
import { Product, ProductRow } from '../products/products.types';

export const WishlistService = {
  async list(userId: number): Promise<Product[]> {
    const { rows } = await db.query<ProductRow>(
      `SELECT ${PRODUCT_COLUMNS}
       FROM wishlist_items w
       JOIN products p ON p.id = w.product_id
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE w.user_id = $1
       ORDER BY w.created_at DESC`,
      [userId]
    );
    return rows.map(toProduct);
  },

  async add(userId: number, productId: number): Promise<Product> {
    const exists = await db.query('SELECT id FROM products WHERE id = $1', [productId]);
    if (exists.rows.length === 0) {
      throw Object.assign(new Error('Product not found.'), { statusCode: 404 });
    }
    await db.query(
      `INSERT INTO wishlist_items (user_id, product_id)
       VALUES ($1, $2) ON CONFLICT (user_id, product_id) DO NOTHING`,
      [userId, productId]
    );
    const { rows } = await db.query<ProductRow>(
      `SELECT ${PRODUCT_COLUMNS} FROM products p
       LEFT JOIN categories c ON c.id = p.category_id WHERE p.id = $1`,
      [productId]
    );
    return toProduct(rows[0]);
  },

  async remove(userId: number, productId: number): Promise<boolean> {
    const { rowCount } = await db.query(
      'DELETE FROM wishlist_items WHERE user_id = $1 AND product_id = $2',
      [userId, productId]
    );
    return (rowCount ?? 0) > 0;
  },
};
