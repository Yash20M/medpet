export type OrderStatus = 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';

export type PaymentMethod = 'upi' | 'cod';

export interface OrderItemRow {
  id: number;
  order_id: number;
  product_id: number | null;
  name: string;
  emoji: string;
  image_url: string | null;
  price: number;
  quantity: number;
}

export interface OrderRow {
  id: number;
  user_id: number;
  status: OrderStatus;
  subtotal: number;
  delivery_fee: number;
  total: number;
  address: string;
  contact_phone: string;
  payment_method: PaymentMethod;
  latitude: number | null;
  longitude: number | null;
  coupon_id: number | null;
  discount: number;
  coupon_code?: string | null;
  delivery_partner_id: number | null;
  accepted_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface Order extends OrderRow {
  items: OrderItemRow[];
  item_count: number;
}

export interface AdminOrder extends Order {
  user_name: string;
  user_email: string;
  delivery_partner_name: string | null;
}

/** Order as seen by a delivery partner — customer name + phone, no email. */
export interface DeliveryOrder extends Order {
  user_name: string;
}

export interface CreateOrderDto {
  items: { productId: number; quantity: number }[];
  address?: string;
  contactPhone?: string;
  paymentMethod?: PaymentMethod;
  latitude?: number;
  longitude?: number;
  couponCode?: string;
}
