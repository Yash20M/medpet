import type { NavigatorScreenParams } from '@react-navigation/native';
import type { HealthTip } from '../data/premium';

// The five persistent bottom-tab destinations.
export type MainTabParamList = {
  Home: undefined;
  Categories: undefined;
  Cart: undefined;
  Orders: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  Onboarding: undefined;
  Main: NavigatorScreenParams<MainTabParamList> | undefined;
  // Tab routes are also listed here so screens that still type their navigation
  // prop against RootStackParamList keep compiling (they resolve at runtime).
  Home: undefined;
  Categories: undefined;
  Cart: undefined;
  Orders: undefined;
  Profile: undefined;
  // Stack-only (drill-down / modal) routes.
  Login: undefined;
  Signup: undefined;
  ProductList: { category?: string; title?: string } | undefined;
  ProductDetail: { productId: string };
  Checkout: undefined;
  Notifications: undefined;
  Wishlist: undefined;
  OrderDetail: { orderId: number };
  LiveTracking: { orderId: number };
  HealthTipArticle: { tipId: string; tip?: HealthTip };
  MyPets: undefined;
  AddPet: undefined;
  SupportTickets: undefined;
  NewSupportTicket: undefined;
  SupportTicketDetail: { ticketId: number; subject?: string };
};

// ─── Delivery-partner app (shown when the logged-in user's role is 'delivery') ──
export type DeliveryStackParamList = {
  DeliveryHome: undefined;
  DeliveryOrderDetail: { orderId: number };
  // Auth modal is reachable from the delivery stack too (e.g. after logout).
  Login: undefined;
};

// Kept as aliases so existing imports keep working.
export type AuthStackParamList = RootStackParamList;
export type AppStackParamList = RootStackParamList;
