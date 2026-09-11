import db from '../../shared/config/database';
import { EmailService } from '../../shared/email/email.service';
import { OrderEmailData } from '../../shared/email/email.types';
import { OrderStatus } from './orders.types';
import { DeliveryOtpService } from './delivery-otp.service';

interface OrderEmailRow {
  id: number;
  user_id: number;
  subtotal: number;
  delivery_fee: number;
  discount: number;
  total: number;
  address: string;
  payment_method: 'upi' | 'cod';
  status_reason: string | null;
  created_at: Date;
  tracking_delivered_at: Date | null;
  route_eta_minutes: number | null;
  customer_name: string;
  customer_email: string;
  delivery_partner_name: string | null;
}

const ORDER_SELECT = `
  SELECT o.id, o.user_id, o.subtotal, o.delivery_fee, o.discount, o.total,
         o.address, o.payment_method, o.status_reason, o.created_at, o.tracking_delivered_at,
         o.route_eta_minutes,
         u.name AS customer_name, u.email AS customer_email,
         dp.name AS delivery_partner_name
  FROM orders o
  JOIN users u ON u.id = o.user_id
  LEFT JOIN users dp ON dp.id = o.delivery_partner_id
  WHERE o.id = $1
`;

/** Pulls a fully real snapshot of an order (items, customer, delivery
 *  partner, estimated ETA) straight from the DB for the email templates —
 *  never hardcoded or partially-guessed data. */
async function loadOrderEmailData(orderId: number): Promise<OrderEmailData | null> {
  const { rows } = await db.query<OrderEmailRow>(ORDER_SELECT, [orderId]);
  const o = rows[0];
  if (!o) return null;

  const { rows: items } = await db.query<{ name: string; quantity: number; price: number }>(
    `SELECT name, quantity, price FROM order_items WHERE order_id = $1 ORDER BY id ASC`,
    [orderId]
  );

  let estimatedDeliveryMinutes = o.route_eta_minutes;
  if (estimatedDeliveryMinutes === null) {
    const { rows: settings } = await db.query<{ value: string }>(
      `SELECT value FROM app_settings WHERE key = 'delivery_eta_minutes'`
    );
    estimatedDeliveryMinutes = settings[0]?.value ? Number(settings[0].value) : null;
  }

  return {
    orderId: o.id,
    userId: o.user_id,
    orderNumber: `ORD-${String(o.id).padStart(4, '0')}`,
    orderDate: o.created_at,
    customerName: o.customer_name,
    customerEmail: o.customer_email,
    items: items.map((i) => ({ name: i.name, quantity: i.quantity, price: i.price })),
    subtotal: o.subtotal,
    deliveryFee: o.delivery_fee,
    discount: o.discount,
    total: o.total,
    deliveryAddress: o.address,
    paymentMethod: o.payment_method,
    deliveryPartnerName: o.delivery_partner_name,
    estimatedDeliveryMinutes,
    statusReason: o.status_reason,
    deliveredAt: o.tracking_delivered_at,
  };
}

type TransitionEmail = 'order_accepted' | 'order_rejected' | 'order_cancelled' | 'out_for_delivery' | 'order_delivered' | null;

/**
 * Maps a status transition to an email type using MedPet's real order status
 * enum (pending -> confirmed -> shipped -> delivered, or -> cancelled at any
 * point — see orders.types.ts). There is no distinct "accepted" step separate
 * from 'confirmed', and no distinct "dispatched" step separate from 'shipped'
 * ("shipped" already means a delivery partner picked up and is en route, see
 * delivery.service.ts#accept) — so ORDER_ACCEPTED/OUT_FOR_DELIVERY map onto
 * those transitions. A cancellation from 'pending' (never accepted) is treated
 * as a rejection rather than a cancellation, since nothing was ever confirmed.
 */
const emailForTransition = (oldStatus: OrderStatus, newStatus: OrderStatus): TransitionEmail => {
  if (oldStatus === newStatus) return null;
  if (newStatus === 'confirmed' && oldStatus === 'pending') return 'order_accepted';
  if (newStatus === 'cancelled') return oldStatus === 'pending' ? 'order_rejected' : 'order_cancelled';
  if (newStatus === 'shipped') return 'out_for_delivery';
  if (newStatus === 'delivered') return 'order_delivered';
  return null;
};

export const OrderEmailService = {
  /** Call once an order's creation transaction has committed. Fire-and-forget. */
  async sendPlaced(orderId: number): Promise<void> {
    const data = await loadOrderEmailData(orderId);
    if (!data) return;
    await EmailService.sendOrderPlacedEmail(data);
  },

  /**
   * Call after any code path changes an order's status. Safe to call from
   * multiple services (delivery accept/markDelivered, admin PATCH status,
   * tracking dispatch/ping/setPhase) for the same transition — duplicate
   * sends are prevented by EmailService's (orderId, type) idempotency, not by
   * caller bookkeeping. Fire-and-forget.
   */
  async notifyStatusChange(orderId: number, oldStatus: OrderStatus, newStatus: OrderStatus): Promise<void> {
    const emailType = emailForTransition(oldStatus, newStatus);
    if (!emailType) return;
    const data = await loadOrderEmailData(orderId);
    if (!data) return;

    switch (emailType) {
      case 'order_accepted': return EmailService.sendOrderAcceptedEmail(data);
      case 'order_rejected': return EmailService.sendOrderRejectedEmail(data);
      case 'order_cancelled': return EmailService.sendOrderCancelledEmail(data);
      case 'out_for_delivery':
        // Issue the delivery-handoff OTP the moment the order goes out for
        // delivery — the customer needs it in hand before the partner arrives.
        // Never let an OTP hiccup block the out-for-delivery email itself.
        await DeliveryOtpService.issueAndSend(orderId).catch((err) =>
          console.error(`📧 Failed to issue delivery OTP for order ${orderId}:`, (err as Error).message)
        );
        return EmailService.sendOutForDeliveryEmail(data);
      case 'order_delivered': return EmailService.sendOrderDeliveredEmail(data);
    }
  },
};
