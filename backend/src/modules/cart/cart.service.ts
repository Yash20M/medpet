import db from '../../shared/config/database';
import { PRODUCT_COLUMNS, toProduct } from '../products/products.service';
import { ProductRow } from '../products/products.types';
import { Cart } from './cart.types';

type CartRow = ProductRow & { quantity: number };

const ensureProduct = async (productId: number): Promise<void> => {
  const { rows } = await db.query('SELECT id FROM products WHERE id = $1', [productId]);
  if (rows.length === 0) {
    throw Object.assign(new Error('Product not found.'), { statusCode: 404 });
  }
};

export const CartService = {
  async get(userId: number): Promise<Cart> {
    const { rows } = await db.query<CartRow>(
      `SELECT ${PRODUCT_COLUMNS}, ci.quantity
       FROM cart_items ci
       JOIN products p ON p.id = ci.product_id
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE ci.user_id = $1
       ORDER BY ci.created_at ASC`,
      [userId]
    );
    const items = rows.map((r) => ({ product: toProduct(r), quantity: r.quantity }));
    const itemCount = items.reduce((s, i) => s + i.quantity, 0);
    const subtotal = items.reduce((s, i) => s + i.product.discount_price * i.quantity, 0);
    return { items, itemCount, subtotal };
  },

  async add(userId: number, productId: number, quantity = 1): Promise<Cart> {
    await ensureProduct(productId);
    await db.query(
      `INSERT INTO cart_items (user_id, product_id, quantity)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, product_id)
       DO UPDATE SET quantity = cart_items.quantity + EXCLUDED.quantity`,
      [userId, productId, Math.max(1, quantity)]
    );
    return this.get(userId);
  },

  async setQuantity(userId: number, productId: number, quantity: number): Promise<Cart> {
    if (quantity <= 0) {
      await db.query('DELETE FROM cart_items WHERE user_id = $1 AND product_id = $2', [userId, productId]);
    } else {
      await ensureProduct(productId);
      await db.query(
        `INSERT INTO cart_items (user_id, product_id, quantity)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, product_id) DO UPDATE SET quantity = EXCLUDED.quantity`,
        [userId, productId, quantity]
      );
    }
    return this.get(userId);
  },

  async remove(userId: number, productId: number): Promise<Cart> {
    await db.query('DELETE FROM cart_items WHERE user_id = $1 AND product_id = $2', [userId, productId]);
    return this.get(userId);
  },

  async clear(userId: number): Promise<Cart> {
    await db.query('DELETE FROM cart_items WHERE user_id = $1', [userId]);
    return this.get(userId);
  },
};
