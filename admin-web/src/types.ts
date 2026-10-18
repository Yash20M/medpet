export interface Category {
  id: number;
  name: string;
  slug: string;
  icon: string;
  image_url: string | null;
  parent_id: number | null;
  parent_name: string | null;
  color: string;
  icon_bg: string;
  sort_order: number;
  is_active: boolean;
}

export interface ProductVariant {
  id: number;
  label: string;
  original_price: number;
  discount_price: number;
  stock_quantity: number;
  discount_percent: number;
}

export interface Product {
  id: number;
  name: string;
  brand: string;
  brand_id: number | null;
  description: string;
  emoji: string;
  image_url: string | null;
  /** Gallery (max 5); the first is the main image. */
  image_urls?: string[];
  manufacturer_details?: string;
  ingredients?: string;
  uses?: string;
  category_id: number | null;
  category_name: string | null;
  original_price: number;
  discount_price: number;
  discount_percent: number;
  rating: number;
  reviews_count: number;
  stock_quantity: number;
  low_stock_threshold: number;
  in_stock: boolean;
  is_featured: boolean;
  is_flash_sale: boolean;
  /** Pet accessory (collar, toy, bed…) rather than a medicine/food product. */
  is_accessory: boolean;
  /** Pet types an accessory suits (dog, cat…); empty = every pet. */
  pet_types: string[];
  /** Size options (10kg, 20kg…); empty = single-size product. */
  variants?: ProductVariant[];
  created_at: string;
}

export const PET_TYPE_OPTIONS: { value: string; label: string; emoji: string }[] = [
  { value: 'dog', label: 'Dogs', emoji: '🐕' },
  { value: 'cat', label: 'Cats', emoji: '🐈' },
  { value: 'bird', label: 'Birds', emoji: '🐦' },
  { value: 'fish', label: 'Fish', emoji: '🐟' },
  { value: 'rabbit', label: 'Rabbits', emoji: '🐇' },
  { value: 'horse', label: 'Horses', emoji: '🐎' },
  { value: 'reptile', label: 'Reptiles', emoji: '🦎' },
  { value: 'other', label: 'Other', emoji: '🐾' },
];

export const petTypesLabel = (types: string[]): string =>
  types.length === 0
    ? 'All pets'
    : types.map((t) => PET_TYPE_OPTIONS.find((o) => o.value === t)?.label ?? t).join(', ');

export type OrderStatus = 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';

export type PaymentMethod = 'upi' | 'cod';

export interface OrderItem {
  id: number;
  order_id: number;
  product_id: number | null;
  name: string;
  emoji: string;
  image_url: string | null;
  price: number;
  quantity: number;
}

export interface Order {
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
  coupon_code: string | null;
  created_at: string;
  updated_at: string;
  items: OrderItem[];
  item_count: number;
}

export interface AdminOrder extends Order {
  user_name: string;
  user_email: string;
  delivery_partner_name: string | null;
}

export type UserRole = 'customer' | 'admin' | 'delivery';

export interface AdminUserSummary {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  order_count: number;
  total_spent: number;
  wishlist_count: number;
}

export interface DeliveryPartner {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  is_active: boolean;
  created_at: string;
  invite_pending: boolean;
  active_deliveries: number;
  completed_deliveries: number;
}

export interface DeliveryHistoryOrder {
  id: number;
  status: string;
  total: number;
  payment_method: string;
  address: string;
  accepted_at: string;
  delivered_at: string | null;
  customer_name: string;
  partner_id: number;
  partner_name: string;
  item_count: number;
}

export interface DeliveryHistory {
  range: { from: string; to: string };
  summary: {
    accepted: number; delivered: number; active: number;
    total_value: number; delivered_value: number; cod_collected: number;
  };
  daily: { date: string; accepted: number; delivered: number; value: number }[];
  by_partner: { partner_id: number; partner_name: string; accepted: number; delivered: number; value: number }[];
  orders: DeliveryHistoryOrder[];
  pagination: { page: number; limit: number; total: number; total_pages: number };
}

export interface CreateDeliveryPartnerResult {
  partner: DeliveryPartner;
  emailDelivered: boolean;
  inviteUrl: string | null;
}

export interface DashboardSummary {
  total_users: number;
  total_orders: number;
  total_revenue: number;
  total_products: number;
  low_stock_count: number;
  orders_today: number;
  revenue_today: number;
  recent_orders: { id: number; user_name: string; status: string; total: number; created_at: string }[];
  top_products: { id: number; name: string; emoji: string; units_sold: number }[];
  orders_by_status: { status: string; count: number }[];
  revenue_series: { date: string; revenue: number; orders: number }[];
}

export interface Offer {
  id: number;
  title: string;
  subtitle: string;
  badge: string;
  code: string | null;
  emoji: string;
  color_from: string;
  color_to: string;
  sort_order: number;
  is_active: boolean;
}

export interface AdminUser {
  id: number;
  name: string;
  email: string;
  role: UserRole;
}

export type DiscountType = 'percent' | 'flat';
export type ConditionType = 'none' | 'first_order' | 'nth_order' | 'min_order_count';

export interface Coupon {
  id: number;
  code: string;
  title: string;
  description: string;
  discount_type: DiscountType;
  discount_value: number;
  max_discount_amount: number | null;
  min_order_value: number;
  condition_type: ConditionType;
  condition_value: number | null;
  user_id: number | null;
  show_on_ui: boolean;
  usage_limit: number | null;
  per_user_limit: number;
  used_count: number;
  valid_from: string | null;
  valid_until: string | null;
  is_active: boolean;
  category_ids: number[];
  product_ids: number[];
  redemption_count: number;
  created_at: string;
  updated_at: string;
}

export type SupportTicketStatus = 'open' | 'pending' | 'resolved' | 'closed';

export interface SupportMessage {
  id: number;
  ticket_id: number;
  sender_role: 'user' | 'admin';
  sender_id: number;
  body: string;
  is_read: boolean;
  created_at: string;
}

export interface AdminSupportTicket {
  id: number;
  user_id: number;
  user_name: string;
  user_email: string;
  subject: string;
  status: SupportTicketStatus;
  last_message: string | null;
  last_message_at: string | null;
  unread_count: number;
  created_at: string;
  updated_at: string;
}

export interface AdminSupportTicketDetail extends AdminSupportTicket {
  messages: SupportMessage[];
}

// ─── App content (mobile Home sections) ─────────────────────
export interface TipSection {
  heading: string;
  body: string;
}

export interface HealthTip {
  id: number;
  title: string;
  teaser: string;
  icon: string;
  color_from: string;
  color_to: string;
  read_mins: number;
  sections: TipSection[];
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export interface Brand {
  id: number;
  name: string;
  emoji: string;
  tint: string;
  image_url: string | null;
  sort_order: number;
  is_active: boolean;
  /** Active products using this brand. */
  product_count: number;
  /** All products (incl. inactive). */
  total_products?: number;
  created_at: string;
}

export interface Testimonial {
  id: number;
  owner_name: string;
  pet_name: string;
  pet_emoji: string;
  rating: number;
  body: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export interface Store {
  id: number;
  name: string;
  area: string;
  distance_km: string;
  eta_mins: number;
  is_open: boolean;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export interface AdminContent {
  tips: HealthTip[];
  brands: Brand[];
  testimonials: Testimonial[];
  stores: Store[];
  settings: Record<string, string>;
}
