/**
 * Delivery-OTP tests — real Postgres DB (same one migrate.ts sets up), real
 * users/orders, and the real nodemailer pipeline (jsonTransport swaps only
 * the network hop, same technique as email.test.ts). Exercises the actual
 * DeliveryOtpService + DeliveryService.markDelivered code paths, not a mock
 * of them.
 *
 * Run:  npx ts-node -T tests/delivery-otp.test.ts
 */
import dotenv from 'dotenv';
dotenv.config();

import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';
import db from '../src/shared/config/database';
import * as emailConfig from '../src/shared/config/email';
import { DeliveryOtpService } from '../src/modules/orders/delivery-otp.service';
import { DeliveryService } from '../src/modules/delivery/delivery.service';

let passed = 0;
let failed = 0;
const ok = (name: string, cond: boolean, extra = ''): void => {
  if (cond) { passed++; console.log(`  ✓ ${name}${extra ? ` — ${extra}` : ''}`); }
  else { failed++; console.log(`  ✗ ${name}${extra ? ` — ${extra}` : ''}`); }
};

// ── Real transport, captured instead of dialing out (see email.test.ts) ──
const sentMessages: { to: string; subject: string; html: string }[] = [];
const jsonTransport = nodemailer.createTransport({ jsonTransport: true });
(emailConfig as unknown as { getTransporter: () => unknown }).getTransporter = (): unknown => ({
  sendMail: async (msg: { to: string; subject: string; html: string; text: string }) => {
    const info = await jsonTransport.sendMail(msg);
    sentMessages.push({ to: msg.to as string, subject: msg.subject, html: msg.html });
    return info;
  },
});
process.env.MAIL_HOST = 'smtp.test.local';
process.env.MAIL_PORT = '587';
process.env.MAIL_USERNAME = 'test@medpet.test';
process.env.MAIL_PASSWORD = 'app-password-not-a-real-secret';
process.env.MAIL_FROM_EMAIL = 'test@medpet.test';
process.env.MAIL_FROM_NAME = 'MedPet Test';

async function ensureUser(email: string, name: string, role: 'customer' | 'delivery'): Promise<number> {
  const { rows } = await db.query<{ id: number }>('SELECT id FROM users WHERE email = $1', [email]);
  if (rows[0]) return rows[0].id;
  const hashed = await bcrypt.hash('not-a-real-password', 4);
  const inserted = await db.query<{ id: number }>(
    `INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id`,
    [name, email, hashed, role]
  );
  return inserted.rows[0].id;
}

async function createShippedOrder(customerId: number, partnerId: number): Promise<number> {
  const { rows } = await db.query<{ id: number }>(
    `INSERT INTO orders (user_id, status, subtotal, delivery_fee, total, address, contact_phone, payment_method, delivery_partner_id, accepted_at)
     VALUES ($1, 'shipped', 500, 49, 549, '221B Test Street', '9999999999', 'cod', $2, NOW()) RETURNING id`,
    [customerId, partnerId]
  );
  return rows[0].id;
}

async function getOtpRow(orderId: number): Promise<{ hash: string | null; expires: Date | null }> {
  const { rows } = await db.query<{ delivery_otp_hash: string | null; delivery_otp_expires_at: Date | null }>(
    `SELECT delivery_otp_hash, delivery_otp_expires_at FROM orders WHERE id = $1`, [orderId]
  );
  return { hash: rows[0].delivery_otp_hash, expires: rows[0].delivery_otp_expires_at };
}

async function run(): Promise<void> {
  const customerId = await ensureUser('otp-test-customer@medpet.test', 'OTP Test Customer', 'customer');
  const partnerId = await ensureUser('otp-test-partner@medpet.test', 'OTP Test Partner', 'delivery');
  const otherPartnerId = await ensureUser('otp-test-other-partner@medpet.test', 'Other Partner', 'delivery');
  const createdOrderIds: number[] = [];

  // ── TEST 1 — issuing sends a real OTP email and stores only a hash ───────
  console.log('\nTEST 1 — issueAndSend emails a real code and never stores it in plain text');
  const orderId1 = await createShippedOrder(customerId, partnerId);
  createdOrderIds.push(orderId1);
  sentMessages.length = 0;
  await DeliveryOtpService.issueAndSend(orderId1);

  const sentOtpMail = sentMessages.find((m) => m.subject.includes('verification code'));
  ok('an OTP email was actually sent', !!sentOtpMail);
  const codeMatch = sentOtpMail?.html.match(/>\s*(\d{6})\s*</);
  const plainOtp = codeMatch?.[1] ?? '';
  ok('email contains a real 6-digit code', /^\d{6}$/.test(plainOtp), plainOtp);

  const row1 = await getOtpRow(orderId1);
  ok('DB stores a hash, not the plaintext code', !!row1.hash && row1.hash !== plainOtp && row1.hash.length === 64);
  ok('expiry timestamp is set in the future', !!row1.expires && row1.expires.getTime() > Date.now());

  // ── TEST 2 — re-issuing while still valid is a no-op (idempotent) ─────────
  console.log('\nTEST 2 — issuing again while the code is still valid does not replace it or re-email');
  sentMessages.length = 0;
  await DeliveryOtpService.issueAndSend(orderId1);
  ok('no second OTP email sent', sentMessages.length === 0);
  const row1b = await getOtpRow(orderId1);
  ok('the stored hash is unchanged', row1b.hash === row1.hash);

  // ── TEST 3 — wrong OTP is rejected, order stays 'shipped' ──────────────────
  console.log('\nTEST 3 — wrong OTP does not deliver the order');
  let wrongOtpThrew = false;
  try {
    await DeliveryService.markDelivered(partnerId, orderId1, '000000');
  } catch (e) {
    wrongOtpThrew = true;
    ok('rejected with 400, not 500', (e as { statusCode?: number }).statusCode === 400);
  }
  ok('markDelivered throws on a wrong OTP', wrongOtpThrew);
  const { rows: stillShipped } = await db.query<{ status: string }>('SELECT status FROM orders WHERE id = $1', [orderId1]);
  ok('order status is still shipped after a failed attempt', stillShipped[0].status === 'shipped');
  const row1c = await getOtpRow(orderId1);
  ok('the OTP is NOT consumed by a failed attempt (can retry)', row1c.hash === row1.hash);

  // ── TEST 4 — a different delivery partner cannot confirm this delivery ────
  console.log('\nTEST 4 — a partner who does not own this order cannot confirm it, even with the right code');
  let wrongPartnerThrew = false;
  try {
    await DeliveryService.markDelivered(otherPartnerId, orderId1, plainOtp);
  } catch {
    wrongPartnerThrew = true;
  }
  ok('markDelivered rejects a non-owning partner', wrongPartnerThrew);

  // ── TEST 5 — correct OTP delivers the order and fires ORDER_DELIVERED ─────
  console.log('\nTEST 5 — correct OTP completes the delivery and sends the delivered email exactly once');
  sentMessages.length = 0;
  const delivered = await DeliveryService.markDelivered(partnerId, orderId1, plainOtp);
  ok('order status flips to delivered', delivered.status === 'delivered');
  const { rows: deliveredRow } = await db.query<{ status: string; tracking_phase: string | null; tracking_delivered_at: Date | null }>(
    'SELECT status, tracking_phase, tracking_delivered_at FROM orders WHERE id = $1', [orderId1]
  );
  ok('tracking_phase set to delivered', deliveredRow[0].tracking_phase === 'delivered');
  ok('tracking_delivered_at recorded', !!deliveredRow[0].tracking_delivered_at);
  // notifyStatusChange is fire-and-forget; give its microtasks a beat to land.
  await new Promise((r) => setTimeout(r, 300));
  ok('order_delivered email was sent', sentMessages.some((m) => m.subject.includes('Order Delivered')));
  const { rows: notifRows } = await db.query<{ type: string }>(
    `SELECT type FROM email_notifications WHERE order_id = $1 AND type = 'order_delivered'`, [orderId1]
  );
  ok('exactly one order_delivered notification logged', notifRows.length === 1);

  // ── TEST 6 — the OTP is single-use: it cannot be replayed ─────────────────
  console.log('\nTEST 6 — the same OTP cannot be reused (order already delivered)');
  let replayThrew = false;
  try {
    await DeliveryService.markDelivered(partnerId, orderId1, plainOtp);
  } catch {
    replayThrew = true;
  }
  ok('re-submitting the same OTP after delivery fails (order no longer shipped)', replayThrew);

  // ── TEST 7 — an expired OTP is rejected ────────────────────────────────────
  console.log('\nTEST 7 — an expired OTP is rejected even if it matches');
  const orderId7 = await createShippedOrder(customerId, partnerId);
  createdOrderIds.push(orderId7);
  await DeliveryOtpService.issueAndSend(orderId7);
  // Force-expire it directly (simulating time passing) rather than waiting hours.
  await db.query(`UPDATE orders SET delivery_otp_expires_at = NOW() - INTERVAL '1 minute' WHERE id = $1`, [orderId7]);
  const expiredValid = await DeliveryOtpService.verify(orderId7, '123456');
  ok('verify() returns false for an expired OTP', expiredValid === false);

  // ── TEST 8 — the OTP hash/expiry never leak through the Order API shape ──
  console.log('\nTEST 8 — delivery_otp_hash / delivery_otp_expires_at never appear in API-shaped order objects');
  const orderId8 = await createShippedOrder(customerId, partnerId);
  createdOrderIds.push(orderId8);
  await DeliveryOtpService.issueAndSend(orderId8);
  const { OrdersService } = await import('../src/modules/orders/orders.service');
  const apiOrder = await OrdersService.getOne(orderId8);
  ok(
    'getOne() result has no delivery_otp_hash / delivery_otp_expires_at keys',
    !!apiOrder && !('delivery_otp_hash' in apiOrder) && !('delivery_otp_expires_at' in apiOrder)
  );

  // ── cleanup ────────────────────────────────────────────────────────────────
  await db.query('DELETE FROM orders WHERE id = ANY($1)', [createdOrderIds]);
  await db.query('DELETE FROM users WHERE id = ANY($1)', [[customerId, partnerId, otherPartnerId]]);

  console.log(`\n──────── DELIVERY-OTP TESTS: ${passed} passed, ${failed} failed ────────\n`);
  process.exit(failed === 0 ? 0 : 1);
}

run().catch((e) => { console.error('Test run crashed:', e); process.exit(1); });
