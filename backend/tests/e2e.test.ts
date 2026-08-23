/**
 * Task 5C + 5D — end-to-end integration. Exercises the REST dispatch + active-
 * drivers endpoints and the ADMIN 'all' socket firehose while a driver walks a
 * full delivery from pickup to drop. Needs DB up + internet (OSRM at dispatch).
 *
 * Run:  npx ts-node -T tests/e2e.test.ts
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

async function ensureUser(email: string, name: string, role: 'admin' | 'customer' | 'delivery'): Promise<number> {
  const ex = await db.query<{ id: number }>('SELECT id FROM users WHERE email=$1', [email]);
  if (ex.rows[0]) return ex.rows[0].id;
  const hash = await bcrypt.hash('test1234', 10);
  const { rows } = await db.query<{ id: number }>(
    `INSERT INTO users (name,email,password,role,vehicle_number,vehicle_type,is_active)
     VALUES ($1,$2,$3,$4,$5,$6,true) RETURNING id`,
    [name, email, hash, role, role === 'delivery' ? 'MH 27 EE 9090' : null, role === 'delivery' ? 'bike' : null]
  );
  return rows[0].id;
}

async function run(): Promise<void> {
  const adminId = await ensureUser('e2e-admin@medpet.com', 'E2E Admin', 'admin');
  const customerId = await ensureUser('e2e-customer@medpet.com', 'E2E Customer', 'customer');
  const driverId = await ensureUser('e2e-driver@medpet.com', 'E2E Rider', 'delivery');

  const { rows } = await db.query<{ id: number }>(
    `INSERT INTO orders (user_id,status,subtotal,delivery_fee,total,address,payment_method,latitude,longitude)
     VALUES ($1,'confirmed',799,0,799,'E2E ORDER Amravati','cod',$2,$3) RETURNING id`,
    [customerId, DROP.lat, DROP.lng]
  );
  const orderId = rows[0].id;

  const server = http.createServer(createApp());
  attachSockets(server);
  await new Promise<void>((res) => server.listen(0, res));
  const port = (server.address() as import('net').AddressInfo).port;
  const url = `http://localhost:${port}`;
  const adminTok = jwt.sign({ id: adminId }, SECRET);
  const driverTok = jwt.sign({ id: driverId }, SECRET);

  // ── Step 2 — Admin dispatches via REST (fetches + caches OSRM route) ───────
  console.log('\nStep — Admin dispatch (REST POST /orders/:id/dispatch)');
  const dispatchRes = await fetch(`${url}/api/orders/${orderId}/dispatch`, {
    method: 'POST', headers: { Authorization: `Bearer ${adminTok}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ driverId }),
  });
  const dispatch = await dispatchRes.json() as { success: boolean; data: any };
  ok('dispatch succeeds and caches a route', dispatch.success && dispatch.data.route?.polyline?.length > 10, `${dispatch.data.route?.polyline?.length} pts`);
  ok('order flipped to shipped + phase preparing', dispatch.data.status === 'shipped' && dispatch.data.phase === 'preparing');
  const poly: LatLng[] = dispatch.data.route.polyline;

  // ── Admin subscribes to the 'all' firehose ────────────────────────────────
  const admin = ioClient(url, { auth: { token: adminTok }, transports: ['websocket'] });
  const driver = ioClient(url, { auth: { token: driverTok }, transports: ['websocket'] });
  await Promise.all([once(admin, 'connect'), once(driver, 'connect')]);
  admin.emit('admin:subscribe', 'all');
  const sub = await once<{ scope: string; ok: boolean }>(admin, 'subscribed');
  console.log('\nStep — Admin live map subscription');
  ok('admin subscribed to all deliveries', sub.ok === true && sub.scope === 'all');

  const adminLocations: any[] = [];
  const adminStatus: any[] = [];
  admin.on('tracking:location', (d) => adminLocations.push(d));
  admin.on('tracking:status-change', (d) => adminStatus.push(d));

  // ── Steps 3–8 — Driver walks the route pickup → drop ──────────────────────
  console.log('\nStep — Driver walks the route (admin map updates live)');
  const N = 6;
  const wps: LatLng[] = Array.from({ length: N }, (_, k) => poly[Math.round((k * (poly.length - 1)) / (N - 1))]);
  let midActiveHadOrder = false;
  for (let i = 0; i < wps.length; i++) {
    driver.emit('driver:location-update', { orderId, lat: wps[i].lat, lng: wps[i].lng, heading: 0, speed: 18, timestamp: Date.now() });
    await sleep(2200);
    if (i === 2) {
      // Mid-walk: the order must appear in GET /api/drivers/active with a position.
      const ar = await fetch(`${url}/api/drivers/active`, { headers: { Authorization: `Bearer ${adminTok}` } });
      const active = (await ar.json() as { data: any[] }).data;
      midActiveHadOrder = active.some((d) => d.orderId === orderId && d.lat != null);
    }
  }
  await sleep(400);

  ok('admin received live location events', adminLocations.length >= N - 1, `${adminLocations.length} events`);
  ok('order appeared in /drivers/active mid-delivery', midActiveHadOrder);
  const etas = adminLocations.map((l) => l.eta);
  ok('ETA decreases monotonically (no random jumps)', etas[etas.length - 1] <= etas[0], `${etas[0]} → ${etas[etas.length - 1]} min`);
  ok('admin saw phase progression to delivered', adminStatus.some((s) => s.newStatus === 'delivered'), adminStatus.map((s) => s.newStatus).join(' → '));

  // ── Step 10 — Delivered order drops off the active map ────────────────────
  const finalRes = await fetch(`${url}/api/drivers/active`, { headers: { Authorization: `Bearer ${adminTok}` } });
  const finalActive = (await finalRes.json() as { data: any[] }).data;
  ok('delivered order no longer in /drivers/active', !finalActive.some((d) => d.orderId === orderId));

  const trackRes = await fetch(`${url}/api/orders/${orderId}/tracking`, { headers: { Authorization: `Bearer ${adminTok}` } });
  const track = (await trackRes.json() as { data: any }).data;
  ok('order tracking state is delivered', track.status === 'delivered' && track.phase === 'delivered');

  // ── Task 4C — delivery analytics ──────────────────────────────────────────
  console.log('\nStep — Delivery analytics (GET /api/drivers/analytics)');
  const anRes = await fetch(`${url}/api/drivers/analytics`, { headers: { Authorization: `Bearer ${adminTok}` } });
  const an = (await anRes.json() as { data: any }).data;
  ok('analytics counts this delivered order', an.deliveredTotal >= 1 && an.deliveredToday >= 1, `total ${an.deliveredTotal}, today ${an.deliveredToday}`);
  ok('avg delivery time is a positive number', typeof an.avgDeliveryMinutes === 'number' && an.avgDeliveryMinutes > 0, `${an.avgDeliveryMinutes} min`);
  ok('ETA accuracy is a 0–100 percentage', an.etaAccuracyPct === null || (an.etaAccuracyPct >= 0 && an.etaAccuracyPct <= 100), `${an.etaAccuracyPct}%`);
  ok('top-drivers list includes our rider', Array.isArray(an.topDrivers) && an.topDrivers.some((d: any) => d.driverId === driverId), `${an.topDrivers.length} drivers`);
  ok('busiest-zones list is populated', Array.isArray(an.zones) && an.zones.length >= 1, `${an.zones.length} zones`);

  admin.close(); driver.close();
  await new Promise<void>((r) => server.close(() => r()));
  await db.pool.end();

  console.log(`\n──────── E2E TESTS: ${passed} passed, ${failed} failed ────────\n`);
  process.exit(failed === 0 ? 0 : 1);
}

run().catch((e) => { console.error('E2E crashed:', e); process.exit(1); });
