import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import * as SecureStore from 'expo-secure-store';
import { AuthPayload, User } from '../types/auth.types';

// Inlined at bundle time from application/.env (EXPO_PUBLIC_API_URL). Falls back
// to the dev PC's LAN IP for local testing on the same Wi-Fi.
export const BASE_URL = (
  process.env.EXPO_PUBLIC_API_URL || 'http://192.168.31.244:5000/api'
).replace(/\/+$/, '');

interface ApiSuccess<T> {
  success: true;
  message: string;
  data: T;
}

const instance: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  // Free-tier hosts sleep when idle; the first request can take ~50s to wake them.
  timeout: 60_000,
  headers: { 'Content-Type': 'application/json' },
});

instance.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = await SecureStore.getItemAsync('authToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export interface ApiError extends Error {
  status?: number;
}

instance.interceptors.response.use(
  (res) => res.data,
  (err) => {
    const message: string =
      err.response?.data?.message ?? err.message ?? 'Something went wrong.';
    const apiError: ApiError = new Error(message);
    apiError.status = err.response?.status;
    return Promise.reject(apiError);
  }
);

export const authAPI = {
  register: (data: { name: string; email: string; password: string; phone?: string }) =>
    instance.post<unknown, ApiSuccess<AuthPayload>>('/auth/register', data),

  login: (data: { email: string; password: string }) =>
    instance.post<unknown, ApiSuccess<AuthPayload>>('/auth/login', data),

  getProfile: () =>
    instance.get<unknown, ApiSuccess<User>>('/auth/profile'),

  updateProfile: (data: { name?: string; phone?: string }) =>
    instance.patch<unknown, ApiSuccess<User>>('/auth/profile', data),

  forgotPassword: (email: string) =>
    instance.post<unknown, ApiSuccess<null>>('/auth/forgot-password', { email }),
};

// ─── Backend resource shapes ─────────────────────────────────────────────────
export interface ApiProduct {
  id: number;
  name: string;
  brand: string;
  description: string;
  emoji: string;
  image_url: string | null;
  category_id: number | null;
  category_name: string | null;
  category_slug: string | null;
  original_price: number;
  discount_price: number;
  discount_percent: number;
  rating: number;
  reviews_count: number;
  stock_quantity: number;
  low_stock_threshold: number;
  in_stock: boolean;
  is_featured: boolean;
  created_at: string;
}

export interface ApiCategory {
  id: number;
  name: string;
  slug: string;
  icon: string;
  image_url: string | null;
  parent_id: number | null;
  color: string;
  icon_bg: string;
  sort_order: number;
  is_active: boolean;
}

export interface ApiOffer {
  id: number;
  title: string;
  subtitle: string;
  badge: string;
  code: string | null;
  emoji: string;
  color_from: string;
  color_to: string;
  sort_order: number;
}

export type OrderStatus = 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';

export type PaymentMethod = 'upi' | 'cod';

export interface CheckoutDetails {
  address: string;
  contactPhone?: string;
  paymentMethod: PaymentMethod;
  latitude?: number | null;
  longitude?: number | null;
  couponCode?: string;
}

export interface ApiOrderItem {
  id: number;
  order_id: number;
  product_id: number | null;
  name: string;
  emoji: string;
  image_url: string | null;
  price: number;
  quantity: number;
}

export interface ApiOrder {
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
  created_at: string;
  updated_at: string;
  items: ApiOrderItem[];
  item_count: number;
}

export interface ApiPet {
  id: number;
  user_id: number;
  name: string;
  type: string;
  breed: string;
  gender: string;
  age_years: number | null;
  weight_kg: number | null;
  avatar_url: string | null;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface PetDraftPayload {
  name: string;
  type: string;
  breed?: string;
  gender?: string;
  age_years?: number | null;
  weight_kg?: number | null;
  avatar_url?: string | null;
  notes?: string;
}

export interface ApiNotification {
  id: number;
  user_id: number | null;
  title: string;
  body: string;
  type: string;
  is_read: boolean;
  created_at: string;
}

type NotificationsResponse = ApiSuccess<ApiNotification[]> & { unread: number };

export type DiscountType = 'percent' | 'flat';

export interface ApiCoupon {
  id: number;
  code: string;
  title: string;
  description: string;
  discount_type: DiscountType;
  discount_value: number;
  max_discount_amount: number | null;
  min_order_value: number;
  show_on_ui: boolean;
}

export interface ApiCouponEligibility {
  coupon: ApiCoupon;
  discount: number;
  qualifying_product_ids: number[];
}

export type SupportTicketStatus = 'open' | 'pending' | 'resolved' | 'closed';

export interface ApiSupportTicket {
  id: number;
  user_id: number;
  subject: string;
  status: SupportTicketStatus;
  last_message: string | null;
  last_message_at: string | null;
  unread_count: number;
  created_at: string;
  updated_at: string;
}

export interface ApiSupportMessage {
  id: number;
  ticket_id: number;
  sender_role: 'user' | 'admin';
  sender_id: number;
  body: string;
  is_read: boolean;
  created_at: string;
}

export const productAPI = {
  list: (params?: { category?: string; featured?: boolean; search?: string }) =>
    instance.get<unknown, ApiSuccess<ApiProduct[]>>('/products', { params }),
  get: (id: string | number) =>
    instance.get<unknown, ApiSuccess<ApiProduct>>(`/products/${id}`),
};

export const categoryAPI = {
  list: () => instance.get<unknown, ApiSuccess<ApiCategory[]>>('/categories'),
};

export const offerAPI = {
  list: () => instance.get<unknown, ApiSuccess<ApiOffer[]>>('/offers'),
};

// Server-side cart (used once the user is authenticated; guest cart stays local).
export const cartAPI = {
  get: () => instance.get('/cart'),
  add: (productId: number, quantity = 1) =>
    instance.post('/cart', { productId, quantity }),
  setQuantity: (productId: number, quantity: number) =>
    instance.patch(`/cart/${productId}`, { quantity }),
  remove: (productId: number) => instance.delete(`/cart/${productId}`),
  clear: () => instance.delete('/cart'),
};

export const wishlistAPI = {
  list: () => instance.get<unknown, ApiSuccess<ApiProduct[]>>('/wishlist'),
  add: (productId: number) => instance.post('/wishlist', { productId }),
  remove: (productId: number) => instance.delete(`/wishlist/${productId}`),
};

export const orderAPI = {
  create: (items: { productId: number; quantity: number }[], details?: CheckoutDetails) =>
    instance.post<unknown, ApiSuccess<ApiOrder>>('/orders', { items, ...details }),
  list: () => instance.get<unknown, ApiSuccess<ApiOrder[]>>('/orders'),
  get: (id: number) => instance.get<unknown, ApiSuccess<ApiOrder>>(`/orders/${id}`),
};

// ─── Delivery partner ────────────────────────────────────────────────────────
export interface ApiDeliveryOrder extends ApiOrder {
  user_name: string;
  accepted_at: string | null;
  delivery_partner_id: number | null;
}

export interface DeliverySummary {
  available: number;
  active: number;
  completed_today: number;
  completed_total: number;
}

export type DeliveryScope = 'active' | 'completed' | 'all';

export const deliveryAPI = {
  summary: () => instance.get<unknown, ApiSuccess<DeliverySummary>>('/delivery/summary'),
  available: () => instance.get<unknown, ApiSuccess<ApiDeliveryOrder[]>>('/delivery/orders/available'),
  mine: (scope: DeliveryScope = 'all') =>
    instance.get<unknown, ApiSuccess<ApiDeliveryOrder[]>>('/delivery/orders/mine', { params: { scope } }),
  get: (id: number) => instance.get<unknown, ApiSuccess<ApiDeliveryOrder>>(`/delivery/orders/${id}`),
  accept: (id: number) => instance.post<unknown, ApiSuccess<ApiDeliveryOrder>>(`/delivery/orders/${id}/accept`),
  deliver: (id: number, otp: string) =>
    instance.post<unknown, ApiSuccess<ApiDeliveryOrder>>(`/delivery/orders/${id}/deliver`, { otp }),
};

export const petAPI = {
  list: () => instance.get<unknown, ApiSuccess<ApiPet[]>>('/pets'),
  get: (id: number) => instance.get<unknown, ApiSuccess<ApiPet>>(`/pets/${id}`),
  create: (data: PetDraftPayload) => instance.post<unknown, ApiSuccess<ApiPet>>('/pets', data),
  update: (id: number, data: Partial<PetDraftPayload>) =>
    instance.patch<unknown, ApiSuccess<ApiPet>>(`/pets/${id}`, data),
  remove: (id: number) => instance.delete(`/pets/${id}`),
};

export const recommendationAPI = {
  related: (productId: string | number, limit = 8) =>
    instance.get<unknown, ApiSuccess<ApiProduct[]>>(`/products/${productId}/related`, { params: { limit } }),
};

export const notificationAPI = {
  list: () => instance.get<unknown, NotificationsResponse>('/notifications'),
  markRead: (id: number) => instance.patch(`/notifications/${id}/read`),
  markAllRead: () => instance.patch('/notifications/read-all'),
};

/** SSE stream URL — token goes in the query string (EventSource can't set headers). */
export const notificationStreamUrl = (token: string): string =>
  `${BASE_URL}/notifications/stream?token=${encodeURIComponent(token)}`;

// ─── Real-time delivery tracking ────────────────────────────────────────────
/** Socket.IO server origin (strip the trailing /api from the REST base). */
export const SOCKET_URL = BASE_URL.replace(/\/api\/?$/, '');

export type LivePhase = 'preparing' | 'picked' | 'on_the_way' | 'nearby' | 'delivered';

export interface LatLng { lat: number; lng: number; }

/** Full tracking state from GET /orders/:id/tracking (socket-disconnect fallback). */
export interface TrackingState {
  orderId: number;
  orderNumber: string;
  status: OrderStatus;
  phase: LivePhase | null;
  pickup: LatLng | null;
  drop: LatLng | null;
  driver: {
    id: number | null;
    name: string | null;
    phone: string | null;
    vehicleNumber: string | null;
    vehicleType: string | null;
    location: (LatLng & { heading: number; speed: number; updatedAt: string | null }) | null;
  };
  route: { polyline: LatLng[]; distanceKm: number; estimatedMinutes: number } | null;
  tracking: {
    startedAt: string | null;
    deliveredAt: string | null;
    lastPingAt: string | null;
    etaMinutes: number | null;
    distanceRemainingKm: number | null;
    progress: number;
  };
}

/** `tracking:location` socket payload. */
export interface LocationBroadcast {
  orderId: number;
  lat: number;
  lng: number;
  heading: number;
  speed: number;
  eta: number;
  distanceRemaining: number;
  progress: number;
  phase: LivePhase;
  status: OrderStatus;
  timestamp: number;
}

export interface StatusChange {
  orderId: number;
  oldStatus: LivePhase | null;
  newStatus: LivePhase;
  timestamp: number;
}

export const trackingAPI = {
  get: (id: number) => instance.get<unknown, ApiSuccess<TrackingState>>(`/orders/${id}/tracking`),
  route: (id: number) =>
    instance.get<unknown, ApiSuccess<{ polyline: LatLng[]; distanceKm: number; estimatedMinutes: number }>>(`/orders/${id}/route`),
  // Manual phase push (admin or the assigned driver): e.g. driver taps "Picked up".
  setPhase: (id: number, phase: LivePhase) =>
    instance.post<unknown, ApiSuccess<TrackingState>>(`/orders/${id}/status`, { phase }),
  // REST GPS ping (background-location task / socket-outage fallback).
  ping: (id: number, coords: { lat: number; lng: number; heading?: number; speed?: number; timestamp?: number }) =>
    instance.post<unknown, ApiSuccess<{ processed: boolean }>>(`/orders/${id}/ping`, coords),
};

export const couponAPI = {
  eligible: (items: { productId: number; quantity: number }[]) =>
    instance.post<unknown, ApiSuccess<ApiCouponEligibility[]>>('/coupons/eligible', { items }),
  validate: (code: string, items: { productId: number; quantity: number }[]) =>
    instance.post<unknown, ApiSuccess<ApiCouponEligibility>>('/coupons/validate', { code, items }),
};

// ─── App content (admin-managed Home sections) ──────────────────────────────
export interface ApiTipSection {
  heading: string;
  body: string;
}

export interface ApiHealthTip {
  id: number;
  title: string;
  teaser: string;
  icon: string;
  color_from: string;
  color_to: string;
  read_mins: number;
  sections: ApiTipSection[];
  sort_order: number;
}

export interface ApiBrand {
  id: number;
  name: string;
  emoji: string;
  tint: string;
}

export interface ApiTestimonial {
  id: number;
  owner_name: string;
  pet_name: string;
  pet_emoji: string;
  rating: number;
  body: string;
}

export interface ApiStore {
  id: number;
  name: string;
  area: string;
  distance_km: string;
  eta_mins: number;
  is_open: boolean;
}

export interface ApiHomeContent {
  tips: ApiHealthTip[];
  brands: ApiBrand[];
  testimonials: ApiTestimonial[];
  stores: ApiStore[];
  flash_products: ApiProduct[];
  settings: Record<string, string>;
}

export const contentAPI = {
  home: () => instance.get<unknown, ApiSuccess<ApiHomeContent>>('/content/home'),
};

export const supportAPI = {
  listTickets: () => instance.get<unknown, ApiSuccess<ApiSupportTicket[]>>('/support/tickets'),
  createTicket: (subject: string, body: string) =>
    instance.post<unknown, ApiSuccess<{ ticket: ApiSupportTicket; message: ApiSupportMessage }>>('/support/tickets', { subject, body }),
  getTicket: (id: number) =>
    instance.get<unknown, ApiSuccess<ApiSupportTicket & { messages: ApiSupportMessage[] }>>(`/support/tickets/${id}`),
  sendMessage: (id: number, body: string) =>
    instance.post<unknown, ApiSuccess<ApiSupportMessage>>(`/support/tickets/${id}/messages`, { body }),
  markRead: (id: number) => instance.patch(`/support/tickets/${id}/read`),
};

export default instance;
