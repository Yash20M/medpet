/**
 * Delivery HISTORY (partner + admin): accepted deliveries over a date range.
 *
 * Seeds orders with controlled accepted_at timestamps for two partners, then checks
 * range filtering (incl. the IST day boundary), per-partner isolation, validation,
 * role guards, per-partner breakdown and pagination. Cleans up after itself.
 *
 * Run:  npx ts-node -T tests/history.test.ts
 */
import dotenv from 'dotenv';
dotenv.config();

import http from 'http';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import createApp from '../src/app';
import db from '../src/shared/config/database';

let passed = 0, failed = 0;
const ok = (n: string, c: boolean, extra = ''): void => {
  if (c) { passed++; console.log(`  ✓ ${n}${extra ? ` — ${extra}` : ''}`); }
  else { failed++; console.log(`  ✗ ${n}${extra ? ` — ${extra}` : ''}`); }
};

const SECRET = process.env.JWT_SECRET as string;
const MARK = 'HISTORY TEST';

const ymd = (d: Date): string => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d);
const daysAgoIst = (n: number): string => ymd(new Date(Date.now() - n * 86_400_000));

async function ensureUser(email: string, name: string, role: 'customer' | 'delivery' | 'admin'): Promise<number> {
  const ex = await db.query<{ id: number }>('SELECT id FROM users WHERE email=$1', [email]);
  if (ex.rows[0]) return ex.rows[0].id;
  const hash = await bcrypt.hash('test1234', 10);
  const { rows } = await db.query<{ id: number }>(
    `INSERT INTO users (name,email,password,role,phone,is_active) VALUES ($1,$2,$3,$4,'+91 90000 00000',true) RETURNING id`,
    [name, email, hash, role]
  );
  return rows[0].id;
}

async function seed(customerId: number, partnerId: number | null, status: string, total: number, pay: string, acceptedAtSql: string): Promise<number> {
  const { rows } = await db.query<{ id: number }>(
    `INSERT INTO orders (user_id,status,subtotal,delivery_fee,total,address,contact_phone,payment_method,delivery_partner_id,accepted_at,tracking_delivered_at)
     VALUES ($1,$2::varchar,$3,0,$3,$4,'+91 90000 00000',$5,$6,${acceptedAtSql},
             CASE WHEN $2::varchar = 'delivered' THEN ${acceptedAtSql} + interval '25 minutes' END) RETURNING id`,
    [customerId, status, total, `${MARK}\nSome street, Amravati`, pay, partnerId]
  );
  return rows[0].id;
}

async function api(url: string, path: string, tok: string): Promise<{ status: number; json: any }> {
  const r = await fetch(`${url}${path}`, { headers: { Authorization: `Bearer ${tok}` } });
  return { status: r.status, json: await r.json() };
}

async function run(): Promise<void> {
  const customerId = await ensureUser('hist-customer@medpet.com', 'History Customer', 'customer');
  const aId = await ensureUser('hist-partner-a@medpet.com', 'Partner A', 'delivery');
  const bId = await ensureUser('hist-partner-b@medpet.com', 'Partner B', 'delivery');
  const adminId = await ensureUser('hist-admin@medpet.com', 'History Admin', 'admin');

  await db.query(`DELETE FROM orders WHERE address LIKE $1`, [`${MARK}%`]);

  const today = `NOW()`;
  const twoDaysAgo = `(NOW() - interval '2 days')`;
  const fortyDaysAgo = `(NOW() - interval '40 days')`;
  // 2026-01-10 19:00 UTC == 2026-01-11 00:30 IST → must bucket on the 11th, not the 10th.
  const istEdge = `TIMESTAMPTZ '2026-01-10 19:00:00+00'`;

  const a1 = await seed(customerId, aId, 'delivered', 500, 'cod', twoDaysAgo);
  const a2 = await seed(customerId, aId, 'shipped', 300, 'upi', today);
  const a3 = await seed(customerId, aId, 'delivered', 999, 'cod', fortyDaysAgo);
  const b1 = await seed(customerId, bId, 'delivered', 700, 'upi', today);
  const edge = await seed(customerId, aId, 'delivered', 111, 'cod', istEdge);

  const server = http.createServer(createApp());
  await new Promise<void>((res) => server.listen(0, res));
  const url = `http://localhost:${(server.address() as import('net').AddressInfo).port}`;
  const tokA = jwt.sign({ id: aId }, SECRET);
  const tokB = jwt.sign({ id: bId }, SECRET);
  const tokAdmin = jwt.sign({ id: adminId }, SECRET);
  const tokCustomer = jwt.sign({ id: customerId }, SECRET);

  try {
    console.log('\n1) Partner history — default range (last 30 days)');
    const r1 = await api(url, '/api/delivery/history', tokA);
    const d1 = r1.json.data;
    ok('200 OK', r1.status === 200);
    const ids1: number[] = d1.orders.map((o: any) => o.id);
    ok('includes own recent orders', ids1.includes(a1) && ids1.includes(a2));
    ok('excludes order accepted 40 days ago', !ids1.includes(a3));
    ok("excludes another partner's order", !ids1.includes(b1));
    ok('summary: 2 accepted, 1 delivered, 1 active', d1.summary.accepted === 2 && d1.summary.delivered === 1 && d1.summary.active === 1, JSON.stringify(d1.summary));
    ok('summary: delivered value 500, COD collected 500', d1.summary.delivered_value === 500 && d1.summary.cod_collected === 500);
    ok('newest first', ids1[0] === a2);
    ok('delivered order carries delivered_at', !!d1.orders.find((o: any) => o.id === a1).delivered_at);
    ok('active order has no delivered_at', d1.orders.find((o: any) => o.id === a2).delivered_at === null);
    ok('by_partner is empty for the partner view', d1.by_partner.length === 0);
    ok('daily breakdown has 2 days', d1.daily.length === 2, d1.daily.map((d: any) => d.date).join(', '));

    console.log('\n2) Custom date range');
    const only2d = daysAgoIst(2);
    const r2 = await api(url, `/api/delivery/history?from=${only2d}&to=${only2d}`, tokA);
    ok('single-day range returns only that day', r2.json.data.orders.length === 1 && r2.json.data.orders[0].id === a1);
    const wide = await api(url, `/api/delivery/history?from=${daysAgoIst(60)}&to=${daysAgoIst(0)}`, tokA);
    ok('60-day range now includes the 40-day-old order', wide.json.data.orders.some((o: any) => o.id === a3));
    const none = await api(url, `/api/delivery/history?from=${daysAgoIst(200)}&to=${daysAgoIst(100)}`, tokA);
    ok('empty range → zero rows/summary', none.json.data.orders.length === 0 && none.json.data.summary.accepted === 0 && none.json.data.pagination.total_pages === 1);

    console.log('\n3) IST day boundary');
    const e10 = await api(url, '/api/delivery/history?from=2026-01-10&to=2026-01-10', tokA);
    const e11 = await api(url, '/api/delivery/history?from=2026-01-11&to=2026-01-11', tokA);
    ok('19:00 UTC is NOT on Jan 10 (IST)', !e10.json.data.orders.some((o: any) => o.id === edge));
    ok('19:00 UTC IS on Jan 11 (IST)', e11.json.data.orders.some((o: any) => o.id === edge));

    console.log('\n4) Validation');
    const bad1 = await api(url, '/api/delivery/history?from=nope&to=2026-01-01', tokA);
    ok('malformed date → 400', bad1.status === 400, bad1.json.message);
    const bad2 = await api(url, '/api/delivery/history?from=2026-02-30&to=2026-03-01', tokA);
    ok('impossible date (Feb 30) → 400', bad2.status === 400);
    const bad3 = await api(url, '/api/delivery/history?from=2026-03-02&to=2026-03-01', tokA);
    ok('from after to → 400', bad3.status === 400);
    const bad4 = await api(url, '/api/delivery/history?from=2020-01-01&to=2026-01-01', tokA);
    ok('range > 366 days → 400', bad4.status === 400);

    console.log('\n5) Access control');
    ok('customer blocked from partner history', (await api(url, '/api/delivery/history', tokCustomer)).status === 403);
    ok('partner blocked from admin history', (await api(url, '/api/delivery/admin/history', tokA)).status === 403);
    ok('admin blocked from partner history', (await api(url, '/api/delivery/history', tokAdmin)).status === 403);
    const anon = await fetch(`${url}/api/delivery/admin/history`);
    ok('anonymous → 401', anon.status === 401);
    const rB = await api(url, '/api/delivery/history', tokB);
    ok("partner B only sees B's order", rB.json.data.orders.length === 1 && rB.json.data.orders[0].id === b1);

    console.log('\n6) Admin history');
    const ad = await api(url, '/api/delivery/admin/history', tokAdmin);
    const ids = ad.json.data.orders.map((o: any) => o.id);
    ok('admin sees both partners', ids.includes(a1) && ids.includes(a2) && ids.includes(b1));
    ok('by_partner lists both with right counts',
      ad.json.data.by_partner.some((p: any) => p.partner_id === aId && p.accepted === 2 && p.delivered === 1) &&
      ad.json.data.by_partner.some((p: any) => p.partner_id === bId && p.accepted === 1 && p.delivered === 1));
    ok('rows carry partner_name + customer_name', ad.json.data.orders.every((o: any) => !!o.partner_name && !!o.customer_name));
    const adB = await api(url, `/api/delivery/admin/history?partnerId=${bId}`, tokAdmin);
    ok('partnerId filter narrows to that partner', adB.json.data.orders.length === 1 && adB.json.data.orders[0].partner_id === bId);

    console.log('\n7) Pagination');
    const p1 = await api(url, '/api/delivery/history?limit=1&page=1', tokA);
    const p2 = await api(url, '/api/delivery/history?limit=1&page=2', tokA);
    const p3 = await api(url, '/api/delivery/history?limit=1&page=3', tokA);
    ok('2 pages of 1', p1.json.data.pagination.total_pages === 2 && p1.json.data.orders.length === 1 && p2.json.data.orders.length === 1);
    ok('pages are different orders', p1.json.data.orders[0].id !== p2.json.data.orders[0].id);
    ok('page past the end → empty list', p3.json.data.orders.length === 0);
  } finally {
    await db.query(`DELETE FROM orders WHERE address LIKE $1`, [`${MARK}%`]);
    server.close();
  }

  console.log(`\n${failed === 0 ? '✅' : '❌'} ${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

run().catch((e) => { console.error(e); process.exit(1); });
