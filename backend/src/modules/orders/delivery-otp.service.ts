import crypto from 'crypto';
import db from '../../shared/config/database';
import { EmailService } from '../../shared/email/email.service';

// Generous window for a same-day delivery window without forcing a re-issue.
const OTP_TTL_MS = 1000 * 60 * 60 * 6;

const hashOtp = (otp: string): string => crypto.createHash('sha256').update(otp).digest('hex');
const generateOtp = (): string => String(crypto.randomInt(100000, 1000000)); // 6 digits

export const DeliveryOtpService = {
  /**
   * Generate + persist a fresh delivery-handoff OTP for an order and email
   * the plaintext code to the customer — it is NEVER stored in plain text,
   * only its SHA-256 hash. Idempotent: if a still-valid OTP already exists
   * for this order this is a no-op, so every code path that can transition
   * an order to 'shipped' can call this safely without re-issuing/re-emailing.
   */
  async issueAndSend(orderId: number): Promise<void> {
    const { rows } = await db.query<{
      delivery_otp_expires_at: Date | null; user_id: number; customer_name: string; customer_email: string;
    }>(
      `SELECT o.delivery_otp_expires_at, o.user_id, u.name AS customer_name, u.email AS customer_email
       FROM orders o JOIN users u ON u.id = o.user_id WHERE o.id = $1`,
      [orderId]
    );
    const o = rows[0];
    if (!o) return;
    if (o.delivery_otp_expires_at && o.delivery_otp_expires_at.getTime() > Date.now()) return;

    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);
    await db.query(
      `UPDATE orders SET delivery_otp_hash = $1, delivery_otp_expires_at = $2 WHERE id = $3`,
      [hashOtp(otp), expiresAt, orderId]
    );

    await EmailService.sendOtpEmail(o.user_id, o.customer_name, o.customer_email, otp, Math.round(OTP_TTL_MS / 60_000));
  },

  /**
   * Verify a delivery partner's OTP entry. On success the OTP is cleared
   * (single-use) and this returns true; on a wrong or expired code the OTP
   * is left intact so the partner can retry, and this returns false.
   */
  async verify(orderId: number, otp: string): Promise<boolean> {
    const { rows } = await db.query<{ delivery_otp_hash: string | null; delivery_otp_expires_at: Date | null }>(
      `SELECT delivery_otp_hash, delivery_otp_expires_at FROM orders WHERE id = $1`,
      [orderId]
    );
    const o = rows[0];
    if (!o?.delivery_otp_hash || !o.delivery_otp_expires_at) return false;
    if (o.delivery_otp_expires_at.getTime() < Date.now()) return false;

    const matches = hashOtp(otp.trim()) === o.delivery_otp_hash;
    if (matches) {
      await db.query(`UPDATE orders SET delivery_otp_hash = NULL, delivery_otp_expires_at = NULL WHERE id = $1`, [orderId]);
    }
    return matches;
  },
};
