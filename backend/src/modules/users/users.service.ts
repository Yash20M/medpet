import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import db from '../../shared/config/database';
import {
  AdminUserSummary, DeliveryPartner, CreateDeliveryPartnerDto, CreateDeliveryPartnerResult,
} from './users.types';
import { Order } from '../orders/orders.types';
import { OrdersService } from '../orders/orders.service';
import { issueResetToken, buildResetUrl } from '../auth/auth.service';
import { Mailer } from '../../shared/utils/mailer';
import { invitePartnerEmail } from '../../shared/utils/emailTemplates';

// Columns + delivery stats for a single delivery partner.
const PARTNER_SELECT = `
  SELECT
    u.id, u.name, u.email, u.phone, u.is_active, u.created_at,
    (u.reset_token_hash IS NOT NULL) AS invite_pending,
    COUNT(*) FILTER (WHERE o.status = 'shipped')::int   AS active_deliveries,
    COUNT(*) FILTER (WHERE o.status = 'delivered')::int AS completed_deliveries
  FROM users u
  LEFT JOIN orders o ON o.delivery_partner_id = u.id
  WHERE u.role = 'delivery'
`;

export const UsersService = {
  async listAdmin(): Promise<AdminUserSummary[]> {
    const { rows } = await db.query<AdminUserSummary>(
      `SELECT
         u.id, u.name, u.email, u.phone, u.role, u.is_active, u.created_at,
         COUNT(DISTINCT o.id)::int AS order_count,
         COALESCE(SUM(DISTINCT o.total), 0)::int AS total_spent,
         (SELECT COUNT(*)::int FROM wishlist_items w WHERE w.user_id = u.id) AS wishlist_count
       FROM users u
       LEFT JOIN orders o ON o.user_id = u.id
       GROUP BY u.id
       ORDER BY u.created_at DESC`
    );
    return rows;
  },

  async getOneAdmin(id: number): Promise<{ user: AdminUserSummary; orders: Order[] } | null> {
    const { rows } = await db.query<AdminUserSummary>(
      `SELECT
         u.id, u.name, u.email, u.phone, u.role, u.is_active, u.created_at,
         COUNT(DISTINCT o.id)::int AS order_count,
         COALESCE(SUM(DISTINCT o.total), 0)::int AS total_spent,
         (SELECT COUNT(*)::int FROM wishlist_items w WHERE w.user_id = u.id) AS wishlist_count
       FROM users u
       LEFT JOIN orders o ON o.user_id = u.id
       WHERE u.id = $1
       GROUP BY u.id`,
      [id]
    );
    if (!rows[0]) return null;
    const orders = await OrdersService.listForUser(id);
    return { user: rows[0], orders };
  },

  // ─── Delivery partners ─────────────────────────────────────────────────────
  async listDeliveryPartners(): Promise<DeliveryPartner[]> {
    const { rows } = await db.query<DeliveryPartner>(
      `${PARTNER_SELECT} GROUP BY u.id ORDER BY u.created_at DESC`
    );
    return rows;
  },

  async getDeliveryPartner(id: number): Promise<DeliveryPartner | null> {
    const { rows } = await db.query<DeliveryPartner>(
      `${PARTNER_SELECT} AND u.id = $1 GROUP BY u.id`,
      [id]
    );
    return rows[0] ?? null;
  },

  /** Create a delivery-partner account and email them a set-password invite. */
  async createDeliveryPartner(dto: CreateDeliveryPartnerDto): Promise<CreateDeliveryPartnerResult> {
    const email = dto.email.toLowerCase().trim();

    const existing = await db.query<{ id: number }>('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      throw Object.assign(new Error('A user with this email already exists.'), { statusCode: 409 });
    }

    // Random unusable password until the partner sets their own via the invite link.
    const randomPassword = crypto.randomBytes(24).toString('hex');
    const hashed = await bcrypt.hash(randomPassword, 12);

    const { rows } = await db.query<{ id: number }>(
      `INSERT INTO users (name, email, password, phone, role, is_active)
       VALUES ($1, $2, $3, $4, 'delivery', true)
       RETURNING id`,
      [dto.name.trim(), email, hashed, dto.phone?.trim() || null]
    );
    const id = rows[0].id;

    const { emailDelivered, inviteUrl } = await this.sendInvite(id, dto.name.trim(), email);

    const partner = (await this.getDeliveryPartner(id))!;
    return { partner, emailDelivered, inviteUrl };
  },

  /** (Re)issue an invite token for a delivery partner and email the link. */
  async resendInvite(id: number): Promise<CreateDeliveryPartnerResult> {
    const { rows } = await db.query<{ id: number; name: string; email: string }>(
      `SELECT id, name, email FROM users WHERE id = $1 AND role = 'delivery'`,
      [id]
    );
    const user = rows[0];
    if (!user) throw Object.assign(new Error('Delivery partner not found.'), { statusCode: 404 });

    const { emailDelivered, inviteUrl } = await this.sendInvite(user.id, user.name, user.email);
    const partner = (await this.getDeliveryPartner(id))!;
    return { partner, emailDelivered, inviteUrl };
  },

  async setDeliveryPartnerActive(id: number, isActive: boolean): Promise<DeliveryPartner | null> {
    const { rowCount } = await db.query(
      `UPDATE users SET is_active = $1 WHERE id = $2 AND role = 'delivery'`,
      [isActive, id]
    );
    if (!rowCount) return null;
    return this.getDeliveryPartner(id);
  },

  // Issues a reset token, sends the invite email, and returns the link when the
  // email couldn't be delivered (so the admin UI can surface it).
  async sendInvite(userId: number, name: string, email: string): Promise<{ emailDelivered: boolean; inviteUrl: string | null }> {
    const raw = await issueResetToken(userId);
    const url = buildResetUrl(raw);
    const { delivered } = await Mailer.send({ to: email, ...invitePartnerEmail(name, url) });
    return { emailDelivered: delivered, inviteUrl: delivered ? null : url };
  },
};
