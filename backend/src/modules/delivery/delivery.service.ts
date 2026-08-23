import db from '../../shared/config/database';
import { NotificationsService } from '../notifications/notifications.service';
import { attachItems } from '../orders/orders.service';
import { OrderRow, DeliveryOrder } from '../orders/orders.types';
import { DeliverySummary } from './delivery.types';
import { TrackingService } from '../tracking/tracking.service';

type DeliveryOrderRow = OrderRow & { user_name: string };

const withCustomer = async (rows: DeliveryOrderRow[]): Promise<DeliveryOrder[]> => {
  const withItems = await attachItems(rows);
  return withItems.map((o, i) => ({ ...o, user_name: rows[i].user_name }));
};

const SELECT = `
  SELECT o.*, u.name AS user_name
  FROM orders o JOIN users u ON u.id = o.user_id
`;

export const DeliveryService = {
  /** Confirmed orders not yet claimed by any partner — oldest first (FIFO). */
  async listAvailable(): Promise<DeliveryOrder[]> {
    const { rows } = await db.query<DeliveryOrderRow>(
      `${SELECT} WHERE o.status = 'confirmed' AND o.delivery_partner_id IS NULL
       ORDER BY o.created_at ASC`
    );
    return withCustomer(rows);
  },

  /** Orders assigned to this partner. `scope`: active (out for delivery) or completed. */
  async listMine(partnerId: number, scope: 'active' | 'completed' | 'all' = 'all'): Promise<DeliveryOrder[]> {
    const statusFilter =
      scope === 'active' ? `AND o.status = 'shipped'`
      : scope === 'completed' ? `AND o.status = 'delivered'`
      : '';
    const { rows } = await db.query<DeliveryOrderRow>(
      `${SELECT} WHERE o.delivery_partner_id = $1 ${statusFilter}
       ORDER BY o.accepted_at DESC NULLS LAST, o.created_at DESC`,
      [partnerId]
    );
    return withCustomer(rows);
  },

  /** A single order visible to this partner (their own, or an available one). */
  async getOne(partnerId: number, orderId: number): Promise<DeliveryOrder | null> {
    const { rows } = await db.query<DeliveryOrderRow>(
      `${SELECT}
       WHERE o.id = $2
         AND (o.delivery_partner_id = $1
              OR (o.delivery_partner_id IS NULL AND o.status = 'confirmed'))`,
      [partnerId, orderId]
    );
    if (!rows[0]) return null;
    return (await withCustomer(rows))[0];
  },

  /**
   * Atomically claim an available order. The WHERE clause guarantees only one
   * partner can win the race — a second accept finds no matching row.
   */
  async accept(partnerId: number, orderId: number): Promise<DeliveryOrder> {
    const { rows } = await db.query<{ user_id: number }>(
      `UPDATE orders
       SET delivery_partner_id = $1, status = 'shipped', accepted_at = NOW()
       WHERE id = $2 AND delivery_partner_id IS NULL AND status = 'confirmed'
       RETURNING user_id`,
      [partnerId, orderId]
    );
    if (!rows[0]) {
      throw Object.assign(
        new Error('This order is no longer available — it may have been accepted by another partner.'),
        { statusCode: 409 }
      );
    }

    await NotificationsService.create({
      userId: rows[0].user_id,
      title: `Order #${orderId} is out for delivery 🚚`,
      body: 'A delivery partner has picked up your order and is on the way.',
      type: 'order',
    });

    // Cache the OSRM route now so live tracking works the moment the partner
    // opens the order. Best-effort — never fail the accept if routing is down.
    await TrackingService.dispatch(orderId, { driverId: partnerId }).catch((err) => {
      console.warn(`Route dispatch failed for order ${orderId}:`, (err as Error).message);
    });

    return (await this.getOne(partnerId, orderId))!;
  },

  /** Mark one of this partner's in-progress orders as delivered. */
  async markDelivered(partnerId: number, orderId: number): Promise<DeliveryOrder> {
    const { rows } = await db.query<{ user_id: number }>(
      `UPDATE orders SET status = 'delivered'
       WHERE id = $1 AND delivery_partner_id = $2 AND status = 'shipped'
       RETURNING user_id`,
      [orderId, partnerId]
    );
    if (!rows[0]) {
      throw Object.assign(
        new Error('Order not found or not currently out for delivery.'),
        { statusCode: 409 }
      );
    }

    await NotificationsService.create({
      userId: rows[0].user_id,
      title: `Order #${orderId} delivered ✅`,
      body: 'Your order has been delivered. Thank you for shopping with MedPet!',
      type: 'order',
    });

    return (await this.getOne(partnerId, orderId))!;
  },

  async summary(partnerId: number): Promise<DeliverySummary> {
    const { rows } = await db.query<{
      available: string; active: string; completed_today: string; completed_total: string;
    }>(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'confirmed' AND delivery_partner_id IS NULL) AS available,
         COUNT(*) FILTER (WHERE delivery_partner_id = $1 AND status = 'shipped')       AS active,
         COUNT(*) FILTER (WHERE delivery_partner_id = $1 AND status = 'delivered'
                          AND updated_at::date = CURRENT_DATE)                          AS completed_today,
         COUNT(*) FILTER (WHERE delivery_partner_id = $1 AND status = 'delivered')      AS completed_total
       FROM orders`,
      [partnerId]
    );
    const r = rows[0];
    return {
      available: Number(r.available),
      active: Number(r.active),
      completed_today: Number(r.completed_today),
      completed_total: Number(r.completed_total),
    };
  },
};
