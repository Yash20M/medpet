import {
  Product, Category, Offer, AdminUser,
  AdminOrder, Order, OrderStatus, AdminUserSummary, DashboardSummary,
  Coupon, AdminSupportTicket, AdminSupportTicketDetail, SupportTicketStatus, SupportMessage,
  AdminContent, HealthTip, Brand, Testimonial, Store,
  DeliveryPartner, CreateDeliveryPartnerResult,
} from './types';
import { ActiveDriver, AdminTrackingState, LivePhase, DeliveryAnalytics } from './liveTypes';

const BASE = (import.meta.env.VITE_API_URL as string) || 'http://localhost:5000/api';
/** Socket.IO origin (strip trailing /api). */
export const SOCKET_URL = BASE.replace(/\/api\/?$/, '');
const TOKEN_KEY = 'medpet_admin_token';

let token: string | null = localStorage.getItem(TOKEN_KEY);

export const setToken = (t: string | null): void => {
  token = t;
  if (t) localStorage.setItem(TOKEN_KEY, t);
  else localStorage.removeItem(TOKEN_KEY);
};
export const getToken = (): string | null => token;

interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(BASE + path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });
  const json = (await res.json().catch(() => ({}))) as ApiEnvelope<T> & { message?: string };
  if (!res.ok || json.success === false) {
    throw new Error(json.message || `Request failed (${res.status})`);
  }
  return json.data;
}

export const api = {
  // ─── Auth ───────────────────────────────────────────────
  async login(email: string, password: string): Promise<{ token: string; user: AdminUser }> {
    return request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
  },

  // ─── Categories ─────────────────────────────────────────
  categories: () => request<Category[]>('/categories/admin/all'),
  createCategory: (b: Partial<Category>) => request<Category>('/categories', { method: 'POST', body: JSON.stringify(b) }),
  updateCategory: (id: number, b: Partial<Category>) => request<Category>(`/categories/${id}`, { method: 'PATCH', body: JSON.stringify(b) }),
  deleteCategory: (id: number) => request<void>(`/categories/${id}`, { method: 'DELETE' }),

  // ─── Image upload (multipart) ───────────────────────────
  async uploadImage(file: File): Promise<string> {
    const fd = new FormData();
    fd.append('image', file);
    const res = await fetch(BASE + '/uploads', {
      method: 'POST',
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) }, // no Content-Type: let the browser set the multipart boundary
      body: fd,
    });
    const json = (await res.json().catch(() => ({}))) as ApiEnvelope<{ url: string }> & { message?: string };
    if (!res.ok || json.success === false) throw new Error(json.message || `Upload failed (${res.status})`);
    return json.data.url;
  },

  // ─── Products ───────────────────────────────────────────
  products: () => request<Product[]>('/products/admin/all'),
  createProduct: (b: Record<string, unknown>) => request<Product>('/products', { method: 'POST', body: JSON.stringify(b) }),
  updateProduct: (id: number, b: Record<string, unknown>) => request<Product>(`/products/${id}`, { method: 'PATCH', body: JSON.stringify(b) }),
  deleteProduct: (id: number) => request<void>(`/products/${id}`, { method: 'DELETE' }),
  lowStockProducts: () => request<Product[]>('/products/admin/low-stock'),

  // ─── Orders ─────────────────────────────────────────────
  orders: (status?: OrderStatus) => request<AdminOrder[]>(`/orders/admin/all${status ? `?status=${status}` : ''}`),
  updateOrderStatus: (id: number, status: OrderStatus) =>
    request<Order>(`/orders/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),

  // ─── Live delivery tracking ─────────────────────────────
  activeDrivers: () => request<ActiveDriver[]>('/drivers/active'),
  deliveryAnalytics: () => request<DeliveryAnalytics>('/drivers/analytics'),
  tracking: (id: number) => request<AdminTrackingState>(`/orders/${id}/tracking`),
  setTrackingPhase: (id: number, phase: LivePhase) =>
    request<AdminTrackingState>(`/orders/${id}/status`, { method: 'POST', body: JSON.stringify({ phase }) }),
  dispatchOrder: (id: number, driverId?: number) =>
    request<AdminTrackingState>(`/orders/${id}/dispatch`, { method: 'POST', body: JSON.stringify(driverId ? { driverId } : {}) }),

  // ─── Users ──────────────────────────────────────────────
  users: () => request<AdminUserSummary[]>('/users/admin/all'),
  userDetail: (id: number) => request<{ user: AdminUserSummary; orders: Order[] }>(`/users/admin/${id}`),

  // ─── Delivery partners ──────────────────────────────────
  deliveryPartners: () => request<DeliveryPartner[]>('/users/admin/delivery-partners'),
  createDeliveryPartner: (b: { name: string; email: string; phone?: string }) =>
    request<CreateDeliveryPartnerResult>('/users/admin/delivery-partners', { method: 'POST', body: JSON.stringify(b) }),
  resendDeliveryInvite: (id: number) =>
    request<CreateDeliveryPartnerResult>(`/users/admin/delivery-partners/${id}/resend-invite`, { method: 'POST' }),
  setDeliveryPartnerActive: (id: number, is_active: boolean) =>
    request<DeliveryPartner>(`/users/admin/delivery-partners/${id}`, { method: 'PATCH', body: JSON.stringify({ is_active }) }),

  // ─── Dashboard ──────────────────────────────────────────
  dashboard: () => request<DashboardSummary>('/dashboard/summary'),

  // ─── Offers ─────────────────────────────────────────────
  offers: () => request<Offer[]>('/offers/admin/all'),
  createOffer: (b: Partial<Offer>) => request<Offer>('/offers', { method: 'POST', body: JSON.stringify(b) }),
  updateOffer: (id: number, b: Partial<Offer>) => request<Offer>(`/offers/${id}`, { method: 'PATCH', body: JSON.stringify(b) }),
  deleteOffer: (id: number) => request<void>(`/offers/${id}`, { method: 'DELETE' }),

  // ─── Notifications ──────────────────────────────────────
  sendNotification: (b: { title: string; body?: string; type?: string; userId?: number | null }) =>
    request('/notifications', { method: 'POST', body: JSON.stringify(b) }),

  // ─── Coupons ─────────────────────────────────────────────
  coupons: () => request<Coupon[]>('/coupons/admin/all'),
  createCoupon: (b: Record<string, unknown>) => request<Coupon>('/coupons', { method: 'POST', body: JSON.stringify(b) }),
  updateCoupon: (id: number, b: Record<string, unknown>) => request<Coupon>(`/coupons/${id}`, { method: 'PATCH', body: JSON.stringify(b) }),
  deleteCoupon: (id: number) => request<void>(`/coupons/${id}`, { method: 'DELETE' }),

  // ─── Support ─────────────────────────────────────────────
  supportTickets: (status?: SupportTicketStatus) =>
    request<AdminSupportTicket[]>(`/support/admin/tickets${status ? `?status=${status}` : ''}`),
  supportTicket: (id: number) => request<AdminSupportTicketDetail>(`/support/admin/tickets/${id}`),
  sendSupportMessage: (id: number, body: string) =>
    request<SupportMessage>(`/support/admin/tickets/${id}/messages`, { method: 'POST', body: JSON.stringify({ body }) }),
  updateTicketStatus: (id: number, status: SupportTicketStatus) =>
    request(`/support/admin/tickets/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  markTicketRead: (id: number) => request(`/support/admin/tickets/${id}/read`, { method: 'PATCH' }),
  supportAdminStreamUrl: (): string => `${BASE}/support/admin/stream?token=${encodeURIComponent(token ?? '')}`,

  // ─── App content (mobile Home sections) ──────────────────
  content: () => request<AdminContent>('/content/admin/all'),
  createTip: (b: Record<string, unknown>) => request<HealthTip>('/content/tips', { method: 'POST', body: JSON.stringify(b) }),
  updateTip: (id: number, b: Record<string, unknown>) => request<HealthTip>(`/content/tips/${id}`, { method: 'PATCH', body: JSON.stringify(b) }),
  deleteTip: (id: number) => request<void>(`/content/tips/${id}`, { method: 'DELETE' }),
  createBrand: (b: Record<string, unknown>) => request<Brand>('/content/brands', { method: 'POST', body: JSON.stringify(b) }),
  updateBrand: (id: number, b: Record<string, unknown>) => request<Brand>(`/content/brands/${id}`, { method: 'PATCH', body: JSON.stringify(b) }),
  deleteBrand: (id: number) => request<void>(`/content/brands/${id}`, { method: 'DELETE' }),
  createTestimonial: (b: Record<string, unknown>) => request<Testimonial>('/content/testimonials', { method: 'POST', body: JSON.stringify(b) }),
  updateTestimonial: (id: number, b: Record<string, unknown>) => request<Testimonial>(`/content/testimonials/${id}`, { method: 'PATCH', body: JSON.stringify(b) }),
  deleteTestimonial: (id: number) => request<void>(`/content/testimonials/${id}`, { method: 'DELETE' }),
  createStore: (b: Record<string, unknown>) => request<Store>('/content/stores', { method: 'POST', body: JSON.stringify(b) }),
  updateStore: (id: number, b: Record<string, unknown>) => request<Store>(`/content/stores/${id}`, { method: 'PATCH', body: JSON.stringify(b) }),
  deleteStore: (id: number) => request<void>(`/content/stores/${id}`, { method: 'DELETE' }),
  updateAppSettings: (b: Record<string, string>) => request<Record<string, string>>('/content/settings', { method: 'PUT', body: JSON.stringify(b) }),
};
