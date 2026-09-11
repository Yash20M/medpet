/**
 * Task 5A TEST 2/3/5 + end-to-end walk. Boots the real app + Socket.IO server
 * in-process, then drives it with a socket.io-client just like the driver &
 * customer apps would. Needs the DB up and internet (OSRM at dispatch).
 *
 * Run:  npx ts-node -T tests/socket.test.ts
 */
import dotenv from 'dotenv';
dotenv.config();

import http from 'http';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { io as ioClient, Socket } from 'socket.io-client';
import createApp from '../src/app';
import { attachSockets } from '../src/shared/realtime/socket';
import { TrackingService } from '../src/modules/tracking/tracking.service';
import { STORE_LOCATION, LatLng } from '../src/shared/config/amravati';
import db from '../src/shared/config/database';

let passed = 0, failed = 0;
const ok = (name: string, cond: boolean, extra = ''): void => {
  if (cond) { passed++; console.log(`  ✓ ${name}${extra ? ` — ${extra}` : ''}`); }
  else { failed++; console.log(`  ✗ ${name}${extra ? ` — ${extra}` : ''}`); }
};
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
const once = <T = any>(sock: Socket, event: string, ms = 9000): Promise<T> =>
  new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout waiting for ${event}`)), ms);
    sock.once(event, (d: T) => { clearTimeout(t); resolve(d); });
  });

const SECRET = process.env.JWT_SECRET as string;
const DROP: LatLng = { lat: 20.9155, lng: 77.7350 };

async function ensureUser(email: string, name: string, role: 'customer' | 'delivery', veh?: [string, string]): Promise<number> {
  const ex = await db.query<{ id: number }>('SELECT id FROM users WHERE email=$1', [email]);
  if (ex.rows[0]) return ex.rows[0].id;
  const hash = await bcrypt.hash('test1234', 10);
  const { rows } = await db.query<{ id: number }>(
    `INSERT INTO users (name,email,password,role,vehicle_number,vehicle_type,is_active)
     VALUES ($1,$2,$3,$4,$5,$6,true) RETURNING id`,
    [name, email, hash, role, veh?.[0] ?? null, veh?.[1] ?? null]
  );
  return rows[0].id;
}

async function resetOrder(orderId: number, driverId: number): Promise<void> {
  await db.query(
    `UPDATE orders SET status='shipped', delivery_partner_id=$2, driver_lat=NULL, driver_lng=NULL,
       driver_location_at=NULL, tracking_phase='preparing', tracking_last_ping_at=NULL,
       tracking_delivered_at=NULL, tracking_progress=0 WHERE id=$1`,
    [orderId, driverId]
  );
}

async function run(): Promise<void> {
  const customerId = await ensureUser('test-customer@medpet.com', 'Test Customer', 'customer');
  const driverId = await ensureUser('test-driver@medpet.com', 'Test Driver', 'delivery', ['MH 27 TE 5555', 'scooter']);

  // Fresh order each run.
  const { rows: orows } = await db.query<{ id: number }>(
    `INSERT INTO orders (user_id,status,subtotal,delivery_fee,total,address,payment_method,latitude,longitude)
     VALUES ($1,'confirmed',499,0,499,'TEST ORDER Amravati','cod',$2,$3) RETURNING id`,
    [customerId, DROP.lat, DROP.lng]
  );
  const orderId = orows[0].id;

  const state = await TrackingService.dispatch(orderId, { driverId, pickup: STORE_LOCATION, drop: DROP });
  const poly = state.route!.polyline;

  // Boot server on an ephemeral port.
  const server = http.createServer(createApp());
  attachSockets(server);
  await new Promise<void>((res) => server.listen(0, res));
  const port = (server.address() as import('net').AddressInfo).port;
  const url = `http://localhost:${port}`;

  const customerTok = jwt.sign({ id: customerId }, SECRET);
  const driverTok = jwt.sign({ id: driverId }, SECRET);
  const customer = ioClient(url, { auth: { token: customerTok }, transports: ['websocket'] });
  const driver = ioClient(url, { auth: { token: driverTok }, transports: ['websocket'] });

  await Promise.all([once(customer, 'connect'), once(driver, 'connect')]);

  // ── TEST 2 — connection + subscribe ──────────────────────────────────────
  console.log('\nTEST 2 — Socket connection & subscribe');
  ok('customer socket connected', customer.connected);
  ok('driver socket connected', driver.connected);
  customer.emit('customer:subscribe', { orderId });
  const sub = await once<{ orderId: number; ok: boolean }>(customer, 'subscribed');
  ok('server acknowledges subscription', sub.ok === true && sub.orderId === orderId);

  // ── TEST 5 — rate limiting (10 pings in ~1s → ≤2 processed) ───────────────
  console.log('\nTEST 5 — Rate limiting / debounce');
  await resetOrder(orderId, driverId);
  let processedCount = 0;
  const ackHandler = (a: { processed: boolean }): void => { if (a.processed) processedCount++; };
  driver.on('tracking:ack', ackHandler);
  const start = poly[0];
  for (let i = 0; i < 10; i++) {
    driver.emit('driver:location-update', { orderId, lat: start.lat, lng: start.lng, heading: 0, speed: 12, timestamp: Date.now() });
    await sleep(90);
  }
  await sleep(600);
  driver.off('tracking:ack', ackHandler);
  ok('only 1–2 of 10 rapid pings processed (debounce works)', processedCount >= 1 && processedCount <= 2, `${processedCount} processed`);

  // ── TEST 3 + end-to-end walk ─────────────────────────────────────────────
  console.log('\nTEST 3 — Location pipeline + live broadcast (walking the route)');
  await resetOrder(orderId, driverId);
  await sleep(2100); // clear the debounce window from TEST 5

  const locations: any[] = [];
  const statusChanges: any[] = [];
  const etaUpdates: any[] = [];
  customer.on('tracking:location', (d) => locations.push(d));
  customer.on('tracking:status-change', (d) => statusChanges.push(d));
  customer.on('tracking:eta-update', (d) => etaUpdates.push(d));

  const N = 8;
  const waypoints: LatLng[] = Array.from({ length: N }, (_, k) => poly[Math.round((k * (poly.length - 1)) / (N - 1))]);
  let prev: LatLng | null = null;
  for (const wp of waypoints) {
    const heading = 0;
    driver.emit('driver:location-update', { orderId, lat: wp.lat, lng: wp.lng, heading, speed: 18, timestamp: Date.now() });
    prev = wp;
    await sleep(2200); // > debounce so each processes
  }
  await sleep(500);

  ok('customer received live location events', locations.length >= N - 1, `${locations.length} events`);
  ok('every ETA is a finite number in 0–40 min', locations.every((l) => Number.isFinite(l.eta) && l.eta >= 0 && l.eta <= 40));
  const progresses = locations.map((l) => l.progress);
  const monotonic = progresses.every((p, i) => i === 0 || p >= progresses[i - 1] - 0.02);
  ok('progress is monotonically non-decreasing', monotonic, `${(progresses[0] * 100).toFixed(0)}% → ${(progresses[progresses.length - 1] * 100).toFixed(0)}%`);
  const etas = locations.map((l) => l.eta);
  ok('ETA does not jump up randomly (last ≤ first)', etas[etas.length - 1] <= etas[0], `${etas[0]} → ${etas[etas.length - 1]} min`);
  ok('status auto-advanced (picked/on_the_way/nearby seen)', statusChanges.some((s) => ['picked', 'on_the_way', 'nearby'].includes(s.newStatus)), statusChanges.map((s) => s.newStatus).join(' → '));
  // GPS proximity now caps out at 'nearby' — completing the delivery requires
  // the customer's OTP (DeliveryOtpService / DeliveryService.markDelivered),
  // covered end-to-end in tests/partner.test.ts and tests/delivery-otp.test.ts.
  ok('final phase reached nearby (reached the drop, not yet OTP-confirmed)', locations[locations.length - 1]?.phase === 'nearby' || statusChanges.some((s) => s.newStatus === 'nearby'));
  ok('GPS proximity alone never auto-completes the delivery', !statusChanges.some((s) => s.newStatus === 'delivered'));
  ok('eta-update events were emitted', etaUpdates.length >= N - 1, `${etaUpdates.length} events`);

  // ── Fallback REST endpoint ───────────────────────────────────────────────
  console.log('\nTEST — REST fallback (GET /api/orders/:id/tracking)');
  const res = await fetch(`${url}/api/orders/${orderId}/tracking`, { headers: { Authorization: `Bearer ${customerTok}` } });
  const body = await res.json() as { success: boolean; data?: any };
  ok('REST tracking fallback returns state', res.status === 200 && body.success === true);
  ok('REST state shows delivered driver position', !!body.data?.driver?.location);

  // ── REST ping endpoint (background-location / socket-outage fallback) ─────
  console.log('\nTEST — REST ping endpoint (POST /orders/:id/ping)');
  await resetOrder(orderId, driverId);
  await sleep(2100); // clear debounce window
  const gotLoc = new Promise<any>((resolve) => customer.once('tracking:location', resolve));
  const mid = poly[Math.floor(poly.length / 2)];
  const pingRes = await fetch(`${url}/api/orders/${orderId}/ping`, {
    method: 'POST', headers: { Authorization: `Bearer ${driverTok}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ lat: mid.lat, lng: mid.lng, heading: 90, speed: 20, timestamp: Date.now() }),
  });
  const pingBody = await pingRes.json() as { data?: { processed?: boolean } };
  ok('REST ping is processed', pingRes.status === 200 && pingBody.data?.processed === true);
  const locEvt = await Promise.race([gotLoc, sleep(4000).then(() => null)]);
  ok('REST ping broadcasts tracking:location to subscribers', !!locEvt);

  customer.close();
  driver.close();
  await new Promise<void>((r) => server.close(() => r()));
  await db.pool.end();

  console.log(`\n──────── SOCKET TESTS: ${passed} passed, ${failed} failed ────────\n`);
  process.exit(failed === 0 ? 0 : 1);
}

run().catch((e) => { console.error('Test run crashed:', e); process.exit(1); });
