/**
 * Delivery-PARTNER end-to-end: the real rider journey.
 *   accept (auto-caches OSRM route) → live GPS over socket → customer tracks →
 *   auto-delivered at the drop → shows in the partner's completed list.
 *
 * Run:  npx ts-node -T tests/partner.test.ts
 */
import dotenv from 'dotenv';
dotenv.config();

import http from 'http';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { io as ioClient, Socket } from 'socket.io-client';
import createApp from '../src/app';
import { attachSockets } from '../src/shared/realtime/socket';
import { LatLng } from '../src/shared/config/amravati';
import db from '../src/shared/config/database';

let passed = 0, failed = 0;
const ok = (n: string, c: boolean, extra = ''): void => {
  if (c) { passed++; console.log(`  ✓ ${n}${extra ? ` — ${extra}` : ''}`); }
  else { failed++; console.log(`  ✗ ${n}${extra ? ` — ${extra}` : ''}`); }
};
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
const once = <T = any>(s: Socket, e: string, ms = 9000): Promise<T> =>
  new Promise((res, rej) => { const t = setTimeout(() => rej(new Error(`timeout ${e}`)), ms); s.once(e, (d: T) => { clearTimeout(t); res(d); }); });

const SECRET = process.env.JWT_SECRET as string;
const DROP: LatLng = { lat: 20.9155, lng: 77.7350 };

async function ensureUser(email: string, name: string, role: 'customer' | 'delivery'): Promise<number> {
  const ex = await db.query<{ id: number }>('SELECT id FROM users WHERE email=$1', [email]);
  if (ex.rows[0]) {
    if (role === 'delivery') await db.query(`UPDATE users SET vehicle_number='MH 27 PT 7777', vehicle_type='bike' WHERE id=$1`, [ex.rows[0].id]);
    return ex.rows[0].id;
  }
  const hash = await bcrypt.hash('test1234', 10);
  const { rows } = await db.query<{ id: number }>(
    `INSERT INTO users (name,email,password,role,phone,vehicle_number,vehicle_type,is_active)
     VALUES ($1,$2,$3,$4,$5,$6,$7,true) RETURNING id`,
    [name, email, hash, role, '+91 98888 12345', role === 'delivery' ? 'MH 27 PT 7777' : null, role === 'delivery' ? 'bike' : null]
  );
  return rows[0].id;
}

async function api(url: string, path: string, tok: string, method = 'GET', body?: unknown): Promise<any> {
  const r = await fetch(`${url}${path}`, {
    method, headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, json: await r.json() };
}

async function run(): Promise<void> {
  const customerId = await ensureUser('ptn-customer@medpet.com', 'Partner Test Customer', 'customer');
  const partnerId = await ensureUser('ptn-driver@medpet.com', 'Ravi (Partner)', 'delivery');

  // A fresh CONFIRMED, unassigned order — i.e. one waiting to be accepted.
  const { rows } = await db.query<{ id: number }>(
    `INSERT INTO orders (user_id,status,subtotal,delivery_fee,total,address,contact_phone,payment_method,latitude,longitude)
     VALUES ($1,'confirmed',599,0,599,'PARTNER TEST — Amravati','+91 97777 65432','cod',$2,$3) RETURNING id`,
    [customerId, DROP.lat, DROP.lng]
  );
  const orderId = rows[0].id;

  const server = http.createServer(createApp());
  attachSockets(server);
  await new Promise<void>((res) => server.listen(0, res));
  const port = (server.address() as import('net').AddressInfo).port;
  const url = `http://localhost:${port}`;
  const partnerTok = jwt.sign({ id: partnerId }, SECRET);
  const customerTok = jwt.sign({ id: customerId }, SECRET);

  // ── 1) Order is available to the partner ──────────────────────────────────
  console.log('\n1) Partner sees the order as available');
  const avail = await api(url, '/api/delivery/orders/available', partnerTok);
  ok('order appears in available list', avail.json.data.some((o: any) => o.id === orderId), `${avail.json.data.length} available`);

  // ── 2) Partner ACCEPTS → auto-dispatch caches the OSRM route ──────────────
  console.log('\n2) Partner accepts (auto-caches route)');
  const accept = await api(url, `/api/delivery/orders/${orderId}/accept`, partnerTok, 'POST');
  ok('accept succeeds, order is now shipped', accept.status === 200 && accept.json.data.status === 'shipped');

  const track1 = await api(url, `/api/orders/${orderId}/tracking`, partnerTok);
  const st = track1.json.data;
  ok('route was auto-cached on accept', (st.route?.polyline?.length ?? 0) > 10, `${st.route?.polyline?.length} pts, ${st.route?.distanceKm} km`);
  ok('this partner is the assigned driver', st.driver.id === partnerId);
  ok('driver vehicle details are present', !!st.driver.vehicleNumber && !!st.driver.vehicleType, `${st.driver.vehicleType} ${st.driver.vehicleNumber}`);
  ok('phase starts at preparing', st.phase === 'preparing');
  const poly: LatLng[] = st.route.polyline;

  // ── 3) Customer opens tracking; partner streams GPS over the socket ───────
  console.log('\n3) Partner streams live GPS → customer tracks in real time');
  const customer = ioClient(url, { auth: { token: customerTok }, transports: ['websocket'] });
  const driver = ioClient(url, { auth: { token: partnerTok }, transports: ['websocket'] });
  await Promise.all([once(customer, 'connect'), once(driver, 'connect')]);
  customer.emit('customer:subscribe', { orderId });
  await once(customer, 'subscribed');

  const locs: any[] = [];
  const phases: string[] = [];
  customer.on('tracking:location', (d) => locs.push(d));
  customer.on('tracking:status-change', (d) => phases.push(d.newStatus));

  const N = 6;
  const wps: LatLng[] = Array.from({ length: N }, (_, k) => poly[Math.round((k * (poly.length - 1)) / (N - 1))]);
  for (const wp of wps) {
    driver.emit('driver:location-update', { orderId, lat: wp.lat, lng: wp.lng, heading: 0, speed: 18, timestamp: Date.now() });
    await sleep(2200);
  }
  await sleep(400);

  ok('customer received live location events', locs.length >= N - 1, `${locs.length} events`);
  const etas = locs.map((l) => l.eta);
  ok('ETA counts down (last ≤ first)', etas[etas.length - 1] <= etas[0], `${etas[0]} → ${etas[etas.length - 1]} min`);
  ok('phases progressed to delivered', phases.includes('delivered'), phases.join(' → '));

  // ── 4) Order is delivered + shows in the partner's completed list ─────────
  console.log('\n4) Auto-delivered + reflected in partner dashboards');
  const track2 = await api(url, `/api/orders/${orderId}/tracking`, partnerTok);
  ok('order auto-delivered at the drop', track2.json.data.status === 'delivered' && track2.json.data.phase === 'delivered');

  const mine = await api(url, '/api/delivery/orders/mine?scope=completed', partnerTok);
  ok('appears in partner’s completed deliveries', mine.json.data.some((o: any) => o.id === orderId), `${mine.json.data.length} completed`);

  const summary = await api(url, '/api/delivery/summary', partnerTok);
  ok('partner summary counts the completed delivery', summary.json.data.completed_total >= 1, `completed_total=${summary.json.data.completed_total}`);

  // ── cleanup ───────────────────────────────────────────────────────────────
  customer.close(); driver.close();
  await db.query(`DELETE FROM orders WHERE address='PARTNER TEST — Amravati'`);
  await new Promise<void>((r) => server.close(() => r()));
  await db.pool.end();

  console.log(`\n──────── PARTNER FLOW: ${passed} passed, ${failed} failed ────────\n`);
  process.exit(failed === 0 ? 0 : 1);
}

run().catch((e) => { console.error('Partner test crashed:', e); process.exit(1); });
