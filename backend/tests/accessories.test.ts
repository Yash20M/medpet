/**
 * ACCESSORIES: products flagged `is_accessory`, tagged with the pet types they suit.
 *
 * Covers: create/update with pet_types, validation, `?accessory=` and `?pet_type=` filters
 * (incl. "suits every pet" items and non-accessories never matching a pet filter),
 * inactive items hidden from the public list, related products preferring accessories,
 * and role guards. Cleans up after itself.
 *
 * Run:  npx ts-node -T tests/accessories.test.ts
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
const TAG = `AT${Date.now() % 100000}`;

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
  const adminId = await ensureUser('acc-test-admin@medpet.com', 'Acc Test Admin', 'admin');
  const custId = await ensureUser('acc-test-customer@medpet.com', 'Acc Test Customer', 'customer');
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
  const mk = (name: string, over: Record<string, unknown>) =>
    call('/api/products', adminTok, 'POST', { name: `${TAG} ${name}`, original_price: 300, discount_price: 200, ...over });

  const ids: number[] = [];
  const names = (r: { json: any }): string[] => (r.json.data ?? []).map((p: any) => p.name as string);
  const mine = (r: { json: any }): string[] => names(r).filter((n) => n.startsWith(TAG)).map((n) => n.slice(TAG.length + 1)).sort();

  try {
    console.log('\n1) Create accessories');
    const collar = await mk('Dog Collar', { is_accessory: true, pet_types: ['dog'] });
    ids.push(collar.json.data?.id);
    ok('create accessory → 201', collar.status === 201);
    ok('flag + pet_types stored', collar.json.data?.is_accessory === true && JSON.stringify(collar.json.data?.pet_types) === '["dog"]');
    const wand = await mk('Cat Wand', { is_accessory: true, pet_types: ['cat'] });
    const both = await mk('Dog Cat Bed', { is_accessory: true, pet_types: ['dog', 'cat', 'dog'] });
    const bottle = await mk('Travel Bottle', { is_accessory: true });
    const med = await mk('Dog Medicine', { pet_types: ['dog'] }); // NOT an accessory
    for (const r of [wand, both, bottle, med]) ids.push(r.json.data?.id);
    ok('duplicate pet types are collapsed', JSON.stringify(both.json.data?.pet_types) === '["dog","cat"]');
    ok('no pet_types → empty list (suits every pet)', JSON.stringify(bottle.json.data?.pet_types) === '[]');
    ok('regular product is not an accessory by default', med.json.data?.is_accessory === false);

    console.log('\n2) Validation');
    const badType = await mk('Bad', { is_accessory: true, pet_types: ['dragon'] });
    ok('unknown pet type → 422', badType.status === 422, JSON.stringify(badType.json.errors?.[0]?.message ?? ''));
    ok('pet_types not an array → 422', (await mk('Bad2', { pet_types: 'dog' })).status === 422);
    ok('is_accessory not boolean → 422', (await mk('Bad3', { is_accessory: 'maybe' })).status === 422);

    console.log('\n3) Filters');
    const onlyAcc = await call('/api/products?accessory=true&limit=100', null);
    ok('?accessory=true returns only accessories', mine(onlyAcc).join() === ['Cat Wand', 'Dog Cat Bed', 'Dog Collar', 'Travel Bottle'].join()
      && (onlyAcc.json.data ?? []).every((p: any) => p.is_accessory === true));
    const notAcc = await call('/api/products?accessory=false&limit=100', null);
    ok('?accessory=false returns no accessories', mine(notAcc).join() === 'Dog Medicine' && (notAcc.json.data ?? []).every((p: any) => p.is_accessory === false));
    const dog = await call('/api/products?pet_type=dog&limit=100', null);
    ok('?pet_type=dog → dog items + items for every pet', mine(dog).join() === ['Dog Cat Bed', 'Dog Collar', 'Travel Bottle'].join(), mine(dog).join(', '));
    ok('…and never a regular product (even tagged dog)', !mine(dog).includes('Dog Medicine'));
    const cat = await call('/api/products?pet_type=CAT&limit=100', null);
    ok('?pet_type= is case-insensitive', mine(cat).join() === ['Cat Wand', 'Dog Cat Bed', 'Travel Bottle'].join());
    const bird = await call('/api/products?pet_type=bird&limit=100', null);
    ok('pet with no specific accessories still gets the universal ones', mine(bird).join() === 'Travel Bottle');
    const fish = await call('/api/products?pet_type=fish&accessory=true&search=Travel&limit=100', null);
    ok('combines with search', mine(fish).join() === 'Travel Bottle');

    console.log('\n4) Update');
    const up = await call(`/api/products/${wand.json.data.id}`, adminTok, 'PATCH', { pet_types: ['cat', 'rabbit'] });
    ok('change pet types', up.status === 200 && JSON.stringify(up.json.data?.pet_types) === '["cat","rabbit"]');
    const keep = await call(`/api/products/${wand.json.data.id}`, adminTok, 'PATCH', { name: `${TAG} Cat Wand 2` });
    ok('editing other fields keeps pet types + flag', JSON.stringify(keep.json.data?.pet_types) === '["cat","rabbit"]' && keep.json.data?.is_accessory === true);
    const clr = await call(`/api/products/${wand.json.data.id}`, adminTok, 'PATCH', { pet_types: [] });
    ok('empty list = suits every pet', JSON.stringify(clr.json.data?.pet_types) === '[]');
    const unflag = await call(`/api/products/${med.json.data.id}`, adminTok, 'PATCH', { is_accessory: true });
    ok('a product can be turned into an accessory', unflag.json.data?.is_accessory === true);
    await call(`/api/products/${med.json.data.id}`, adminTok, 'PATCH', { is_accessory: false });

    console.log('\n5) Visibility');
    await call(`/api/products/${collar.json.data.id}`, adminTok, 'PATCH', { is_active: false });
    const hidden = await call('/api/products?accessory=true&pet_type=dog&limit=100', null);
    ok('inactive accessory hidden from the app', !mine(hidden).includes('Dog Collar'));
    const adminList = await call('/api/products/admin/all', adminTok);
    ok('…but visible to admin', names(adminList).includes(`${TAG} Dog Collar`));
    await call(`/api/products/${collar.json.data.id}`, adminTok, 'PATCH', { is_active: true });

    console.log('\n6) Related products');
    const rel = await call(`/api/products/${collar.json.data.id}/related?limit=5`, null);
    ok('an accessory\'s related list leads with accessories', (rel.json.data ?? []).length > 0 && (rel.json.data ?? []).slice(0, 3).every((p: any) => p.is_accessory === true));
    const relMed = await call(`/api/products/${med.json.data.id}/related?limit=5`, null);
    ok('a medicine\'s related list does not lead with accessories', (relMed.json.data ?? [])[0]?.is_accessory === false);

    console.log('\n7) Access control');
    ok('customer cannot create an accessory', (await call('/api/products', custTok, 'POST', { name: `${TAG} x`, original_price: 1, discount_price: 1, is_accessory: true })).status === 403);
    ok('customer cannot change pet types', (await call(`/api/products/${wand.json.data.id}`, custTok, 'PATCH', { pet_types: ['dog'] })).status === 403);
  } finally {
    await db.query('DELETE FROM products WHERE id = ANY($1::int[])', [ids.filter(Boolean)]);
    await db.query(`DELETE FROM products WHERE name LIKE $1`, [`${TAG}%`]);
    await db.query(`DELETE FROM users WHERE email IN ('acc-test-admin@medpet.com','acc-test-customer@medpet.com')`);
    server.close();
  }

  console.log(`\n${failed === 0 ? '✅' : '❌'} ${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
