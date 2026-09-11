import db from '../config/database';
import { getTransporter, isEmailConfigured, fromAddress } from '../config/email';
import { EmailBody, EmailType, OrderEmailData } from './email.types';
import { orderPlacedEmail } from './templates/order-placed.template';
import { orderAcceptedEmail } from './templates/order-accepted.template';
import { orderRejectedEmail } from './templates/order-rejected.template';
import { orderCancelledEmail } from './templates/order-cancelled.template';
import { orderDispatchedEmail } from './templates/order-dispatched.template';
import { outForDeliveryEmail } from './templates/out-for-delivery.template';
import { orderDeliveredEmail } from './templates/order-delivered.template';
import { passwordResetEmail } from './templates/password-reset.template';
import { otpEmail } from './templates/otp.template';

const MAX_ATTEMPTS = 3;
// Delay before attempt 2 and attempt 3 respectively.
const RETRY_DELAYS_MS = [2000, 6000];

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** Never log a full email address — mask the local part for privacy. */
const maskEmail = (email: string): string => {
  const at = email.indexOf('@');
  if (at <= 0) return '***';
  const user = email.slice(0, at);
  const domain = email.slice(at + 1);
  const masked = user.length <= 2 ? '*'.repeat(user.length) : `${user[0]}${'*'.repeat(user.length - 2)}${user[user.length - 1]}`;
  return `${masked}@${domain}`;
};

interface NotifyInput {
  type: EmailType;
  to: string;
  userId?: number | null;
  orderId?: number | null;
  body: EmailBody;
}

/** One raw SMTP attempt. Never throws — errors/credentials never leak to the caller. */
async function deliver(to: string, body: EmailBody): Promise<{ delivered: boolean; messageId?: string; error?: string }> {
  if (!isEmailConfigured()) {
    console.log(`📧 [email:log-mode] SMTP not configured — would send "${body.subject}" to ${maskEmail(to)}.`);
    return { delivered: false, error: 'SMTP not configured' };
  }
  try {
    const info = await getTransporter().sendMail({
      from: fromAddress(), to, subject: body.subject, html: body.html, text: body.text,
    });
    return { delivered: true, messageId: info.messageId };
  } catch (err) {
    // Strip anything resembling SMTP auth details from the message before it's ever logged/stored.
    const message = (err as Error).message.replace(/pass(word)?=\S+/gi, 'pass=***');
    return { delivered: false, error: message };
  }
}

export const EmailService = {
  isConfigured: isEmailConfigured,

  /** Low-level, non-transactional send (no DB log / idempotency / retry). */
  async sendEmail(to: string, body: EmailBody): Promise<{ delivered: boolean }> {
    const result = await deliver(to, body);
    if (!result.delivered) {
      console.error(`📧 [email] Failed to send "${body.subject}" to ${maskEmail(to)}: ${result.error}`);
    }
    return { delivered: result.delivered };
  },

  /**
   * Idempotent, retried send for a transactional notification. Order-tied
   * notifications are deduplicated by (orderId, type) via a DB unique
   * constraint, so calling this twice for the same order+type only ever
   * sends once — safe to call from multiple code paths.
   *
   * Fully self-contained background work: callers must NOT await this on a
   * request's hot path — fire-and-forget with `.catch(() => undefined)`, the
   * same pattern already used for route precomputation elsewhere in orders.
   */
  async notify(input: NotifyInput): Promise<void> {
    const notificationId = await this.createLog(input);
    if (notificationId === null) {
      console.log(`📧 [email] Skipped duplicate "${input.type}" for order ${input.orderId ?? '-'} — already sent.`);
      return;
    }

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      if (attempt > 1) await sleep(RETRY_DELAYS_MS[attempt - 2] ?? 6000);
      await this.markAttempt(notificationId);

      const result = await deliver(input.to, input.body);
      if (result.delivered) {
        await this.markSent(notificationId, result.messageId);
        console.log(`📧 [email] Sent "${input.type}" to ${maskEmail(input.to)} (order ${input.orderId ?? '-'}, attempt ${attempt}/${MAX_ATTEMPTS}).`);
        return;
      }

      console.warn(`📧 [email] Attempt ${attempt}/${MAX_ATTEMPTS} failed for "${input.type}" to ${maskEmail(input.to)}: ${result.error}`);
      if (attempt === MAX_ATTEMPTS) {
        await this.markFailed(notificationId, result.error ?? 'Unknown error');
      }
    }
  },

  /** Insert a pending log row. Returns null (skip sending) if this order+type
   *  was already logged — the idempotency guarantee lives in the unique index. */
  async createLog(input: NotifyInput): Promise<number | null> {
    if (input.orderId) {
      const { rows } = await db.query<{ id: number }>(
        `INSERT INTO email_notifications (user_id, order_id, type, recipient, subject, status)
         VALUES ($1, $2, $3, $4, $5, 'pending')
         ON CONFLICT (order_id, type) WHERE order_id IS NOT NULL DO NOTHING
         RETURNING id`,
        [input.userId ?? null, input.orderId, input.type, input.to, input.body.subject]
      );
      return rows[0]?.id ?? null;
    }
    const { rows } = await db.query<{ id: number }>(
      `INSERT INTO email_notifications (user_id, order_id, type, recipient, subject, status)
       VALUES ($1, NULL, $2, $3, $4, 'pending')
       RETURNING id`,
      [input.userId ?? null, input.type, input.to, input.body.subject]
    );
    return rows[0].id;
  },

  async markAttempt(id: number): Promise<void> {
    await db.query(`UPDATE email_notifications SET status = 'sending', attempts = attempts + 1 WHERE id = $1`, [id]);
  },
  async markSent(id: number, messageId?: string): Promise<void> {
    await db.query(
      `UPDATE email_notifications SET status = 'sent', sent_at = NOW(), provider_message_id = $2, error = NULL WHERE id = $1`,
      [id, messageId ?? null]
    );
  },
  async markFailed(id: number, error: string): Promise<void> {
    await db.query(
      `UPDATE email_notifications SET status = 'failed', failed_at = NOW(), error = $2 WHERE id = $1`,
      [id, error.slice(0, 500)]
    );
  },

  // ─── Order lifecycle ───────────────────────────────────────────────────────
  async sendOrderPlacedEmail(d: OrderEmailData): Promise<void> {
    await this.notify({ type: 'order_placed', to: d.customerEmail, userId: d.userId, orderId: d.orderId, body: orderPlacedEmail(d) });
  },
  async sendOrderAcceptedEmail(d: OrderEmailData): Promise<void> {
    await this.notify({ type: 'order_accepted', to: d.customerEmail, userId: d.userId, orderId: d.orderId, body: orderAcceptedEmail(d) });
  },
  async sendOrderRejectedEmail(d: OrderEmailData): Promise<void> {
    await this.notify({ type: 'order_rejected', to: d.customerEmail, userId: d.userId, orderId: d.orderId, body: orderRejectedEmail(d) });
  },
  async sendOrderCancelledEmail(d: OrderEmailData): Promise<void> {
    await this.notify({ type: 'order_cancelled', to: d.customerEmail, userId: d.userId, orderId: d.orderId, body: orderCancelledEmail(d) });
  },
  /** See order-dispatched.template.ts — not wired to a trigger today. */
  async sendOrderDispatchedEmail(d: OrderEmailData): Promise<void> {
    await this.notify({ type: 'order_dispatched', to: d.customerEmail, userId: d.userId, orderId: d.orderId, body: orderDispatchedEmail(d) });
  },
  async sendOutForDeliveryEmail(d: OrderEmailData): Promise<void> {
    await this.notify({ type: 'out_for_delivery', to: d.customerEmail, userId: d.userId, orderId: d.orderId, body: outForDeliveryEmail(d) });
  },
  async sendOrderDeliveredEmail(d: OrderEmailData): Promise<void> {
    await this.notify({ type: 'order_delivered', to: d.customerEmail, userId: d.userId, orderId: d.orderId, body: orderDeliveredEmail(d) });
  },

  // ─── Auth ──────────────────────────────────────────────────────────────────
  async sendPasswordResetEmail(userId: number, name: string, email: string, url: string, expiresAt: Date): Promise<void> {
    await this.notify({ type: 'password_reset', to: email, userId, body: passwordResetEmail(name, url, expiresAt) });
  },
  /** Delivery-handoff OTP — see modules/orders/delivery-otp.service.ts. */
  async sendOtpEmail(userId: number, name: string, email: string, code: string, expiresInMinutes: number): Promise<void> {
    await this.notify({ type: 'otp', to: email, userId, body: otpEmail(name, code, expiresInMinutes) });
  },
};
