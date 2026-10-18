/**
 * PRODUCT VARIANTS: size options (10kg / 20kg…) with their own price + stock.
 *
 * Covers: create/update with variants (id-preserving upsert, removal), product summary
 * (cheapest price, total stock), validation, order pricing + stock per variant,
 * and role guards. Cleans up after itself.
 *
 * Run:  npx ts-node -T tests/variants.test.ts
 */
import dotenv from 'dotenv';
dotenv.config();

import http from 'http';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import createApp from '../src/app';
import db from '../src/shared/config/database';
import { runMigrations } from '../src/shared/config/migrate';

let passed = 0, failed = 0;
const ok = (n: string, c: boolean, extra = ''): void => {
  if (c) { passed++; console.log(`  ✓ ${n}${extra ? ` — ${extra}` : ''}`); }
  else { failed++; console.log(`  ✗ ${n}${extra ? ` — ${extra}` : ''}`); }
};

const SECRET = process.env.JWT_SECRET as string;
const TAG = `VT${Date.now() % 100000}`;

async function ensureUser(email: string, name: string, role: 'customer' | 'admin'): Promise<number> {
  const ex = await db.query<{ id: number }>('SELECT id FROM users WHERE email=$1', [email]);
  if (ex.rows[0]) return ex.rows[0].id;
  const hash = await bcrypt.hash('test1234', 10);
  const { rows } = await db.query<{ id: number }>(
    `INSERT INTO users (name,email,password,role,phone,is_active) VALUES ($1,$2,$3,$4,'+91 90000 00000',true) RETURNING id`,
    [name, email, hash, role]
  );
  return rows[0].id;
}

async function main(): Promise<void> {
  await runMigrations();
  const adminId = await ensureUser('var-test-admin@medpet.com', 'Var Test Admin', 'admin');
  const custId = await ensureUser('var-test-customer@medpet.com', 'Var Test Customer', 'customer');
  const adminTok = jwt.sign({ id: adminId }, SECRET);
  const custTok = jwt.sign({ id: custId }, SECRET);

  const server = http.createServer(createApp());
  await new Promise<void>((r) => server.listen(0, r));
  const url = `http://localhost:${(server.address() as import('net').AddressInfo).port}`;
  const call = async (path: string, tok: string | null, method = 'GET', body?: unknown): Promise<{ status: number; json: any }> => {
    const r = await fetch(`${url}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: `Bearer ${tok}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: r.status, json: await r.json().catch(() => ({})) };
  };

  try {
    console.log('\n1) Create with variants');
    const v = (label: string, o: number, d: number, s: number) => ({ label, original_price: o, discount_price: d, stock_quantity: s });
    const p = await call('/api/products', adminTok, 'POST', {
      name: `${TAG} Dog Food`, original_price: 3100, discount_price: 2728,
      variants: [v('20kg', 3100, 2728, 5), v('10kg', 1599, 1423, 3), v('3kg', 629, 585, 0)],
    });
    ok('create → 201', p.status === 201, JSON.stringify(p.json).slice(0, 120));
    const vs = p.json.data?.variants ?? [];
    ok('3 variants returned in entered order', vs.map((x: any) => x.label).join() === '20kg,10kg,3kg');
    ok('variant discount_percent computed', vs[0]?.discount_percent === 12);
    ok('summary price = cheapest variant', p.json.data?.discount_price === 585 && p.json.data?.original_price === 629);
    ok('summary stock = total of variants', p.json.data?.stock_quantity === 8);

    console.log('\n2) Read back');
    const got = await call(`/api/products/${p.json.data.id}`, null);
    ok('detail includes variants', (got.json.data?.variants ?? []).length === 3);
    const list = await call(`/api/products?search=${TAG}`, null);
    ok('list includes variants', (list.json.data?.[0]?.variants ?? []).length === 3);

    console.log('\n3) Update (upsert by id)');
    const ten = vs.find((x: any) => x.label === '10kg');
    const up = await call(`/api/products/${p.json.data.id}`, adminTok, 'PATCH', {
      variants: [{ id: ten.id, ...v('10kg', 1599, 1399, 10) }, v('30kg', 4000, 3500, 2)],
    });
    const after = up.json.data?.variants ?? [];
    ok('kept variant keeps its id, new one added, others removed', after.length === 2 && after.some((x: any) => x.id === ten.id && x.discount_price === 1399) && after.some((x: any) => x.label === '30kg'));
    ok('summary refreshed', up.json.data?.discount_price === 1399 && up.json.data?.stock_quantity === 12);
    const noTouch = await call(`/api/products/${p.json.data.id}`, adminTok, 'PATCH', { name: `${TAG} Dog Food 2` });
    ok('editing other fields leaves variants alone', (noTouch.json.data?.variants ?? []).length === 2);

    console.log('\n4) Validation');
    const bad = (variants: unknown[]) => call('/api/products', adminTok, 'POST', { name: `${TAG} bad`, original_price: 1, discount_price: 1, variants });
    ok('discount above MRP rejected', (await bad([v('1kg', 100, 200, 1)])).status === 422);
    ok('missing label rejected', (await bad([v('', 100, 90, 1)])).status === 422);
    ok('duplicate sizes rejected', (await bad([v('1kg', 100, 90, 1), v('1KG', 100, 90, 1)])).status === 422);
    ok('negative stock rejected', (await bad([v('1kg', 100, 90, -1)])).status === 422);

    console.log('\n5) Ordering a size');
    const thirty = (up.json.data?.variants ?? []).find((x: any) => x.label === '30kg');
    const order = await call('/api/orders', custTok, 'POST', {
      items: [{ productId: p.json.data.id, variantId: thirty.id, quantity: 2 }], address: 'Test', paymentMethod: 'cod',
    });
    ok('order placed → 201', order.status === 201, JSON.stringify(order.json).slice(0, 150));
    const line = order.json.data?.items?.[0];
    ok('line priced at the variant price', line?.price === 3500 && order.json.data?.subtotal === 7000);
    ok('line name + label include the size', line?.name === `${TAG} Dog Food 2 (30kg)` && line?.variant_label === '30kg');
    const afterOrder = await call(`/api/products/${p.json.data.id}`, null);
    const t = (afterOrder.json.data?.variants ?? []).find((x: any) => x.id === thirty.id);
    ok('variant stock decremented', t?.stock_quantity === 0);
    ok('product stock decremented', afterOrder.json.data?.stock_quantity === 10);
    const wrong = await call('/api/orders', custTok, 'POST', { items: [{ productId: p.json.data.id, variantId: 999999999, quantity: 1 }], address: 'x' });
    ok('unknown size → 404', wrong.status === 404);

    console.log('\n6) Removing all variants');
    const clr = await call(`/api/products/${p.json.data.id}`, adminTok, 'PATCH', { variants: [] });
    ok('empty list removes them', (clr.json.data?.variants ?? []).length === 0);

    console.log('\n7) Access control');
    ok('customer cannot set variants', (await call(`/api/products/${p.json.data.id}`, custTok, 'PATCH', { variants: [] })).status === 403);

    console.log('\n8) Image gallery');
    const imgs = ['/uploads/a.png', '/uploads/b.png', '/uploads/c.png'];
    const gp = await call('/api/products', adminTok, 'POST', { name: `${TAG} Gallery`, original_price: 10, discount_price: 9, image_urls: imgs });
    ok('create with gallery', gp.status === 201 && JSON.stringify(gp.json.data?.image_urls) === JSON.stringify(imgs));
    ok('image_url = first image', gp.json.data?.image_url === imgs[0]);
    const reorder = await call(`/api/products/${gp.json.data.id}`, adminTok, 'PATCH', { image_urls: [imgs[2], imgs[1]] });
    ok('reorder/remove updates gallery + primary', JSON.stringify(reorder.json.data?.image_urls) === JSON.stringify([imgs[2], imgs[1]]) && reorder.json.data?.image_url === imgs[2]);
    const six = await call(`/api/products/${gp.json.data.id}`, adminTok, 'PATCH', { image_urls: ['1', '2', '3', '4', '5', '6'] });
    ok('more than 5 images rejected', six.status === 422);
    const none = await call(`/api/products/${gp.json.data.id}`, adminTok, 'PATCH', { image_urls: [] });
    ok('empty list clears images', (none.json.data?.image_urls ?? []).length === 0 && none.json.data?.image_url === null);

    console.log('\n9) Manufacturer / ingredients / uses');
    const dp = await call('/api/products', adminTok, 'POST', {
      name: `${TAG} Details`, original_price: 10, discount_price: 9,
      manufacturer_details: ' SKU: X1\nCountry of Origin: India ', ingredients: 'Real Chicken, Lamb', uses: 'Feed twice daily',
    });
    ok('create stores all three (trimmed, newlines kept)', dp.json.data?.manufacturer_details === 'SKU: X1\nCountry of Origin: India' && dp.json.data?.ingredients === 'Real Chicken, Lamb' && dp.json.data?.uses === 'Feed twice daily');
    const plain = await call('/api/products', adminTok, 'POST', { name: `${TAG} NoDetails`, original_price: 10, discount_price: 9 });
    ok('default to empty strings', plain.json.data?.manufacturer_details === '' && plain.json.data?.ingredients === '' && plain.json.data?.uses === '');
    const dup = await call(`/api/products/${dp.json.data.id}`, adminTok, 'PATCH', { uses: 'Once daily' });
    ok('update one field leaves the others', dup.json.data?.uses === 'Once daily' && dup.json.data?.ingredients === 'Real Chicken, Lamb');
    const dclr = await call(`/api/products/${dp.json.data.id}`, adminTok, 'PATCH', { ingredients: '' });
    ok('empty string clears a field', dclr.json.data?.ingredients === '' && dclr.json.data?.manufacturer_details !== '');
    ok('over-long text rejected', (await call(`/api/products/${dp.json.data.id}`, adminTok, 'PATCH', { uses: 'x'.repeat(4001) })).status === 422);
    const dget = await call(`/api/products/${dp.json.data.id}`, null);
    ok('public detail exposes the fields', dget.json.data?.manufacturer_details?.includes('India') === true);
  } finally {
    await db.query(`DELETE FROM orders WHERE id IN (SELECT order_id FROM order_items WHERE name LIKE $1)`, [`${TAG}%`]);
    await db.query(`DELETE FROM products WHERE name LIKE $1`, [`${TAG}%`]);
    await db.query(`DELETE FROM users WHERE email IN ('var-test-admin@medpet.com','var-test-customer@medpet.com')`);
    server.close();
  }
  console.log(`\n${failed === 0 ? '✅' : '❌'} ${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
