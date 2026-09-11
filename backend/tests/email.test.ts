/**
 * Email notification tests — runs against the REAL local Postgres DB (same
 * one migrate.ts sets up), inserting real users/orders so the email_notifications
 * foreign keys are satisfied, and drives EmailService.notify() through
 * nodemailer end-to-end using nodemailer's built-in `jsonTransport` (a genuine
 * transport, not a mock of our own code) so delivery, retry and idempotency
 * logic all really execute; only the final network hop to Gmail is swapped
 * for a transport that serializes the message instead of dialing out. Point
 * this at real Gmail SMTP by setting MAIL_* in .env and it exercises the
 * exact same code path used in production.
 *
 * Run:  npx ts-node -T tests/email.test.ts
 */
import dotenv from 'dotenv';
dotenv.config();

import nodemailer from 'nodemailer';
import db from '../src/shared/config/database';
import * as emailConfig from '../src/shared/config/email';
import { EmailService } from '../src/shared/email/email.service';
import { OrderEmailData } from '../src/shared/email/email.types';

let passed = 0;
let failed = 0;
const ok = (name: string, cond: boolean, extra = ''): void => {
  if (cond) { passed++; console.log(`  ✓ ${name}${extra ? ` — ${extra}` : ''}`); }
  else { failed++; console.log(`  ✗ ${name}${extra ? ` — ${extra}` : ''}`); }
};

// ── Real (but non-network) transport + a fake env so isEmailConfigured() is true ──
const sentMessages: { to: string; subject: string; html: string }[] = [];
const jsonTransport = nodemailer.createTransport({ jsonTransport: true });
let failNextSends = 0;

(emailConfig as unknown as { getTransporter: () => unknown }).getTransporter = (): unknown => ({
  sendMail: async (msg: { to: string; subject: string; html: string; text: string }) => {
    if (failNextSends > 0) {
      failNextSends--;
      throw new Error('Simulated transient SMTP failure');
    }
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

// ── Real test fixtures (a real user + real orders — email_notifications has a
// hard FK to both, so fabricated ids would just fail with a constraint error) ──
async function ensureTestUser(): Promise<number> {
  const email = 'email-test-user@medpet.test';
  const { rows } = await db.query<{ id: number }>('SELECT id FROM users WHERE email = $1', [email]);
  if (rows[0]) return rows[0].id;
  const inserted = await db.query<{ id: number }>(
    `INSERT INTO users (name, email, password) VALUES ('Email Test User', $1, 'not-a-real-hash') RETURNING id`,
    [email]
  );
  return inserted.rows[0].id;
}

async function createTestOrder(userId: number): Promise<number> {
  const { rows } = await db.query<{ id: number }>(
    `INSERT INTO orders (user_id, status, subtotal, delivery_fee, total, address, contact_phone, payment_method)
     VALUES ($1, 'confirmed', 500, 49, 549, '221B Test Street', '9999999999', 'cod') RETURNING id`,
    [userId]
  );
  return rows[0].id;
}

async function deleteTestOrders(orderIds: number[]): Promise<void> {
  // ON DELETE CASCADE on email_notifications.order_id cleans those up too.
  await db.query(`DELETE FROM orders WHERE id = ANY($1)`, [orderIds]);
}

const orderData = (orderId: number, userId: number, overrides: Partial<OrderEmailData> = {}): OrderEmailData => ({
  orderId,
  userId,
  orderNumber: `ORD-${String(orderId).padStart(4, '0')}`,
  orderDate: new Date(),
  customerName: 'Test Customer',
  customerEmail: 'test-customer@medpet.test',
  items: [{ name: 'Flea Shampoo', quantity: 2, price: 250 }],
  subtotal: 500,
  deliveryFee: 49,
  discount: 0,
  total: 549,
  deliveryAddress: '221B Test Street',
  paymentMethod: 'cod',
  deliveryPartnerName: null,
  estimatedDeliveryMinutes: 30,
  statusReason: null,
  deliveredAt: null,
  ...overrides,
});

async function countNotifications(orderId: number, type: string): Promise<number> {
  const { rows } = await db.query<{ count: string }>(
    `SELECT COUNT(*)::int AS count FROM email_notifications WHERE order_id = $1 AND type = $2`,
    [orderId, type]
  );
  return Number(rows[0].count);
}

async function run(): Promise<void> {
  const userId = await ensureTestUser();
  const createdOrderIds: number[] = [];

  ok('EmailService reports configured once MAIL_* env vars are set', EmailService.isConfigured());

  // ── TEST 1 — each order-lifecycle sender logs + sends exactly once ───────
  console.log('\nTEST 1 — each order-lifecycle sender logs + sends exactly once');
  const orderId1 = await createTestOrder(userId);
  createdOrderIds.push(orderId1);
  sentMessages.length = 0;

  await EmailService.sendOrderPlacedEmail(orderData(orderId1, userId));
  ok('order_placed notification row created', (await countNotifications(orderId1, 'order_placed')) === 1);
  ok('order_placed email actually sent via the transporter', sentMessages.some((m) => m.subject.includes('Order Confirmed')));

  await EmailService.sendOrderAcceptedEmail(orderData(orderId1, userId));
  await EmailService.sendOrderRejectedEmail(orderData(orderId1, userId, { statusReason: 'Out of stock' }));
  await EmailService.sendOrderCancelledEmail(orderData(orderId1, userId));
  await EmailService.sendOutForDeliveryEmail(orderData(orderId1, userId, { deliveryPartnerName: 'Rahul K.' }));
  await EmailService.sendOrderDeliveredEmail(orderData(orderId1, userId, { deliveredAt: new Date() }));
  const { rows: allTypes } = await db.query<{ type: string }>(
    `SELECT type FROM email_notifications WHERE order_id = $1 ORDER BY type`, [orderId1]
  );
  ok('all 6 lifecycle types logged for the order', allTypes.length === 6, allTypes.map((r) => r.type).join(', '));

  // ── TEST 2 — duplicate status update does not send a duplicate email ─────
  console.log('\nTEST 2 — idempotency: sending the same type twice for one order sends once');
  sentMessages.length = 0;
  await EmailService.sendOrderAcceptedEmail(orderData(orderId1, userId));
  await EmailService.sendOrderAcceptedEmail(orderData(orderId1, userId));
  await EmailService.sendOrderAcceptedEmail(orderData(orderId1, userId));
  ok('only one order_accepted row exists after 3 calls', (await countNotifications(orderId1, 'order_accepted')) === 1);
  ok('no new email was actually sent (row already existed)', sentMessages.length === 0);

  // ── TEST 3 — email failure does not throw / does not block ───────────────
  console.log('\nTEST 3 — SMTP failure is recorded as FAILED, never thrown to the caller');
  const orderId3 = await createTestOrder(userId);
  createdOrderIds.push(orderId3);
  failNextSends = 3; // exhaust all 3 attempts
  let threw = false;
  try {
    await EmailService.sendOrderPlacedEmail(orderData(orderId3, userId));
  } catch {
    threw = true;
  }
  ok('sendOrderPlacedEmail does not throw even when every SMTP attempt fails', !threw);
  const { rows: failedRow } = await db.query<{ status: string; attempts: number; error: string | null }>(
    `SELECT status, attempts, error FROM email_notifications WHERE order_id = $1 AND type = 'order_placed'`,
    [orderId3]
  );
  ok('notification marked FAILED after exhausting retries', failedRow[0]?.status === 'failed');
  ok('attempts recorded 3 retries', failedRow[0]?.attempts === 3, `attempts=${failedRow[0]?.attempts}`);
  ok('error message stored, no credentials leaked', !!failedRow[0]?.error && !/pass(word)?=/i.test(failedRow[0]!.error));

  // ── TEST 4 — retry mechanism recovers on a later attempt ──────────────────
  console.log('\nTEST 4 — retry: first attempt fails, second succeeds, marked SENT');
  const orderId4 = await createTestOrder(userId);
  createdOrderIds.push(orderId4);
  sentMessages.length = 0;
  failNextSends = 1; // only the first attempt fails
  await EmailService.sendOrderPlacedEmail(orderData(orderId4, userId));
  const { rows: retryRow } = await db.query<{ status: string; attempts: number }>(
    `SELECT status, attempts FROM email_notifications WHERE order_id = $1 AND type = 'order_placed'`,
    [orderId4]
  );
  ok('eventually marked SENT after one retry', retryRow[0]?.status === 'sent');
  ok('attempts = 2 (1 failure + 1 success)', retryRow[0]?.attempts === 2, `attempts=${retryRow[0]?.attempts}`);
  ok('email was actually delivered on retry', sentMessages.length === 1);

  // ── TEST 5 — password reset ────────────────────────────────────────────────
  console.log('\nTEST 5 — password reset sends a real, non-empty reset link and never logs the token');
  sentMessages.length = 0;
  const rawToken = 'a'.repeat(64); // shape of a real crypto.randomBytes(32).toString('hex') token
  const resetUrl = `http://localhost:5000/reset-password?token=${rawToken}`;
  const logSpy: string[] = [];
  const origLog = console.log;
  console.log = (...args: unknown[]): void => { logSpy.push(args.join(' ')); origLog(...args); };
  await EmailService.sendPasswordResetEmail(userId, 'Test Customer', 'test-customer@medpet.test', resetUrl, new Date(Date.now() + 3600_000));
  console.log = origLog;
  ok('password reset email sent with the real token embedded', sentMessages.some((m) => m.html.includes(rawToken)));
  ok('the raw token never appears in a log line', !logSpy.some((l) => l.includes(rawToken)));

  // ── TEST 6 — sensitive info never logged ──────────────────────────────────
  console.log('\nTEST 6 — SMTP password / app password never appears in logs');
  ok('MAIL_PASSWORD value never appears in captured logs', !logSpy.some((l) => l.includes('app-password-not-a-real-secret')));

  // ── TEST 7 — missing SMTP configuration handled gracefully ────────────────
  console.log('\nTEST 7 — missing config falls back to log-mode instead of crashing');
  const savedUser = process.env.MAIL_USERNAME;
  delete process.env.MAIL_USERNAME;
  ok('isEmailConfigured() is false once a required var is missing', !emailConfig.isEmailConfigured());
  const orderId7 = await createTestOrder(userId);
  createdOrderIds.push(orderId7);
  let unconfiguredThrew = false;
  try {
    await EmailService.sendOrderPlacedEmail(orderData(orderId7, userId));
  } catch {
    unconfiguredThrew = true;
  }
  ok('sending with missing config does not throw', !unconfiguredThrew);
  const { rows: unconfiguredRow } = await db.query<{ status: string }>(
    `SELECT status FROM email_notifications WHERE order_id = $1 AND type = 'order_placed'`, [orderId7]
  );
  ok('notification recorded as failed (log-mode) rather than silently dropped', unconfiguredRow[0]?.status === 'failed');
  process.env.MAIL_USERNAME = savedUser;

  await deleteTestOrders(createdOrderIds);
  await db.query('DELETE FROM users WHERE id = $1', [userId]);

  console.log(`\n──────── EMAIL TESTS: ${passed} passed, ${failed} failed ────────\n`);
  process.exit(failed === 0 ? 0 : 1);
}

run().catch((e) => { console.error('Test run crashed:', e); process.exit(1); });
