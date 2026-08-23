import { UserRole } from '../auth/auth.types';

export interface AdminUserSummary {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  role: UserRole;
  is_active: boolean;
  created_at: Date;
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
  created_at: Date;
  /** true until the partner sets a password via the invite link. */
  invite_pending: boolean;
  active_deliveries: number;
  completed_deliveries: number;
}

export interface CreateDeliveryPartnerDto {
  name: string;
  email: string;
  phone?: string;
}

export interface CreateDeliveryPartnerResult {
  partner: DeliveryPartner;
  /** Whether the invite email was actually sent (false in dev / no SMTP). */
  emailDelivered: boolean;
  /** The invite link — only returned when the email could not be sent, so the
   *  admin can share it manually. Null once email delivery is configured. */
  inviteUrl: string | null;
}
