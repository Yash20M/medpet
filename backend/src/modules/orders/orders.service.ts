import db from '../../shared/config/database';
import { NotificationsService } from '../notifications/notifications.service';
import { CouponsService } from '../coupons';
import {
  Order, AdminOrder, OrderRow, OrderItemRow, OrderStatus, CreateOrderDto,
} from './orders.types';

const DELIVERY_FEE = 49;
const FREE_DELIVERY_OVER = 499;

// pg returns NUMERIC columns as strings to avoid float precision loss, so
// latitude/longitude arrive as strings. Normalise them to numbers (or null).
const toNum = (v: unknown): number | null =>
  v === null || v === undefined || v === '' ? null : Number(v);

export const attachItems = async (orders: OrderRow[]): Promise<Order[]> => {
  if (orders.length === 0) return [];
  const ids = orders.map((o) => o.id);
  const { rows: items } = await db.query<OrderItemRow>(
    `SELECT id, order_id, product_id, name, emoji, image_url, price, quantity
     FROM order_items WHERE order_id = ANY($1) ORDER BY id ASC`,
    [ids]
  );
  return orders.map((o) => {
    const orderItems = items.filter((i) => i.order_id === o.id);
    return {
      ...o,
      latitude: toNum(o.latitude),
      longitude: toNum(o.longitude),
      items: orderItems,
      item_count: orderItems.reduce((s, i) => s + i.quantity, 0),
    };
  });
};

export const OrdersService = {
  async create(userId: number, dto: CreateOrderDto): Promise<Order> {
    if (!dto.items?.length) {
      throw Object.assign(new Error('Order must contain at least one item.'), { statusCode: 400 });
    }

    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      const productIds = dto.items.map((i) => i.productId);
      const { rows: products } = await client.query<{
        id: number; name: string; emoji: string; image_url: string | null; discount_price: number;
      }>(
        `SELECT id, name, emoji, image_url, discount_price FROM products WHERE id = ANY($1) AND is_active = true`,
        [productIds]
      );
      const byId = new Map(products.map((p) => [p.id, p]));

      let subtotal = 0;
      const lines: { productId: number; name: string; emoji: string; image_url: string | null; price: number; quantity: number }[] = [];
      for (const item of dto.items) {
        const p = byId.get(item.productId);
        if (!p) throw Object.assign(new Error(`Product ${item.productId} not found.`), { statusCode: 404 });
        const quantity = Math.max(1, item.quantity);
        subtotal += p.discount_price * quantity;
        lines.push({ productId: p.id, name: p.name, emoji: p.emoji, image_url: p.image_url, price: p.discount_price, quantity });
      }

      const deliveryFee = subtotal >= FREE_DELIVERY_OVER ? 0 : DELIVERY_FEE;

      // Re-validate the coupon atomically inside this transaction (re-checks
      // usage limits etc. using the live transaction client, not a stale read).
      let discount = 0;
      let couponId: number | null = null;
      if (dto.couponCode) {
        const result = await CouponsService.checkEligibility(client, userId, dto.couponCode, dto.items);
        discount = result.discount;
        couponId = result.coupon.id;
      }

      const total = subtotal + deliveryFee - discount;

      const { rows: orderRows } = await client.query<OrderRow>(
        `INSERT INTO orders
           (user_id, status, subtotal, delivery_fee, total, address, contact_phone, payment_method,
            latitude, longitude, coupon_id, discount)
         VALUES ($1, 'pending', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING *`,
        [
          userId, subtotal, deliveryFee, total,
          dto.address ?? '', dto.contactPhone ?? '',
          dto.paymentMethod ?? 'cod',
          dto.latitude ?? null, dto.longitude ?? null,
          couponId, discount,
        ]
      );
      const order = orderRows[0];

      if (couponId) {
        await client.query(
          `INSERT INTO coupon_redemptions (coupon_id, user_id, order_id, discount_amount) VALUES ($1,$2,$3,$4)`,
          [couponId, userId, order.id, discount]
        );
        await client.query(`UPDATE coupons SET used_count = used_count + 1 WHERE id = $1`, [couponId]);
      }

      for (const line of lines) {
        await client.query(
          `INSERT INTO order_items (order_id, product_id, name, emoji, image_url, price, quantity)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [order.id, line.productId, line.name, line.emoji, line.image_url, line.price, line.quantity]
        );
        await client.query(
          `UPDATE products SET
             stock_quantity = GREATEST(stock_quantity - $1, 0),
             in_stock = (GREATEST(stock_quantity - $1, 0) > 0)
           WHERE id = $2`,
          [line.quantity, line.productId]
        );
      }

      await client.query('DELETE FROM cart_items WHERE user_id = $1 AND product_id = ANY($2)', [userId, productIds]);

      await client.query('COMMIT');

      await NotificationsService.create({
        userId,
        title: 'Order placed! 🐾',
        body: `Your order of ${lines.reduce((s, l) => s + l.quantity, 0)} item(s) for ₹${total} has been placed.`,
        type: 'order',
      });

      return (await attachItems([order]))[0];
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async listForUser(userId: number): Promise<Order[]> {
    const { rows } = await db.query<OrderRow>(
      `SELECT o.*, c.code AS coupon_code FROM orders o
       LEFT JOIN coupons c ON c.id = o.coupon_id
       WHERE o.user_id = $1 ORDER BY o.created_at DESC`,
      [userId]
    );
    return attachItems(rows);
  },

  async getOne(id: number, userId?: number): Promise<Order | null> {
    const { rows } = await db.query<OrderRow>(
      userId
        ? `SELECT o.*, c.code AS coupon_code FROM orders o
           LEFT JOIN coupons c ON c.id = o.coupon_id
           WHERE o.id = $1 AND o.user_id = $2`
        : `SELECT o.*, c.code AS coupon_code FROM orders o
           LEFT JOIN coupons c ON c.id = o.coupon_id
           WHERE o.id = $1`,
      userId ? [id, userId] : [id]
    );
    if (!rows[0]) return null;
    return (await attachItems(rows))[0];
  },

  async listAdmin(status?: OrderStatus): Promise<AdminOrder[]> {
    const { rows } = await db.query<OrderRow & { user_name: string; user_email: string; delivery_partner_name: string | null }>(
      `SELECT o.*, u.name AS user_name, u.email AS user_email,
              dp.name AS delivery_partner_name, c.code AS coupon_code
       FROM orders o JOIN users u ON u.id = o.user_id
       LEFT JOIN users dp ON dp.id = o.delivery_partner_id
       LEFT JOIN coupons c ON c.id = o.coupon_id
       ${status ? 'WHERE o.status = $1' : ''}
       ORDER BY o.created_at DESC`,
      status ? [status] : []
    );
    const withItems = await attachItems(rows);
    return withItems.map((o, i) => ({
      ...o,
      user_name: rows[i].user_name,
      user_email: rows[i].user_email,
      delivery_partner_name: rows[i].delivery_partner_name,
    }));
  },

  async updateStatus(id: number, status: OrderStatus): Promise<Order | null> {
    const { rows } = await db.query<OrderRow>(
      `UPDATE orders SET status = $1 WHERE id = $2 RETURNING *`,
      [status, id]
    );
    if (!rows[0]) return null;
    const order = (await attachItems(rows))[0];

    await NotificationsService.create({
      userId: order.user_id,
      title: `Order #${order.id} ${status}`,
      body: `Your order is now ${status}.`,
      type: 'order',
    });

    return order;
  },
};
