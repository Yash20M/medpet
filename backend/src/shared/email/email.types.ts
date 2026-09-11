export type EmailType =
  | 'order_placed'
  | 'order_accepted'
  | 'order_rejected'
  | 'order_cancelled'
  | 'order_dispatched'
  | 'out_for_delivery'
  | 'order_delivered'
  | 'password_reset'
  | 'otp';

export type EmailNotificationStatus = 'pending' | 'sending' | 'sent' | 'failed';

export interface EmailNotificationRow {
  id: number;
  user_id: number | null;
  order_id: number | null;
  type: EmailType;
  recipient: string;
  subject: string;
  status: EmailNotificationStatus;
  attempts: number;
  provider_message_id: string | null;
  error: string | null;
  sent_at: Date | null;
  failed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

/** A rendered email — subject + HTML + a plain-text fallback. */
export interface EmailBody {
  subject: string;
  html: string;
  text: string;
}

export interface OrderEmailItem {
  name: string;
  quantity: number;
  price: number;
}

/** Real order data used to render the order-lifecycle templates. Populated
 *  straight from the orders/order_items/users tables — never hardcoded. */
export interface OrderEmailData {
  orderId: number;
  userId: number;
  orderNumber: string;
  orderDate: Date;
  customerName: string;
  customerEmail: string;
  items: OrderEmailItem[];
  subtotal: number;
  deliveryFee: number;
  discount: number;
  total: number;
  deliveryAddress: string;
  paymentMethod: 'upi' | 'cod';
  deliveryPartnerName?: string | null;
  estimatedDeliveryMinutes?: number | null;
  statusReason?: string | null;
  deliveredAt?: Date | null;
}
