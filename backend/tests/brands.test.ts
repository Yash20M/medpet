/**
 * BRANDS end-to-end: managed brands, product ↔ brand linking, brand filter, app visibility.
 *
 * Covers: startup backfill, create/duplicate/validation, product create/update with
 * `brand_id` (dropdown) and legacy `brand` text, `?brand_id=` / `?brand=` filtering,
 * rename → product text sync, delete protection, what the PUBLIC app endpoints expose,
 * and role guards. Cleans up after itself.
 *
 * Run:  npx ts-node -T tests/brands.test.ts
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
const TAG = `BT${Date.now() % 100000}`;

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
  const adminId = await ensureUser('brands-test-admin@medpet.com', 'Brands Test Admin', 'admin');
  const custId = await ensureUser('brands-test-customer@medpet.com', 'Brands Test Customer', 'customer');
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
  const mkProduct = (over: Record<string, unknown>) =>
    call('/api/products', adminTok, 'POST', { name: `${TAG} Prod`, original_price: 200, discount_price: 150, ...over });

  const createdBrandIds: number[] = [];
  const createdProductIds: number[] = [];

  try {
    // ── 1) Startup backfill ───────────────────────────────────────────────────
    console.log('\n1) Existing products are linked to brands (backfill)');
    const orphan = await db.query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM products WHERE TRIM(COALESCE(brand,'')) <> '' AND brand_id IS NULL`
    );
    ok('no product with a brand name is left without a brand_id', orphan.rows[0].n === 0, `${orphan.rows[0].n} unlinked`);
    const drift = await db.query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM products p JOIN brands b ON b.id = p.brand_id WHERE p.brand <> b.name`
    );
    ok('product.brand text matches its brand name', drift.rows[0].n === 0);

    // ── 2) Create brands ──────────────────────────────────────────────────────
    console.log('\n2) Admin creates brands');
    const A = await call('/api/content/brands', adminTok, 'POST', { name: `${TAG} Alpha`, emoji: '🅰️', tint: '#E0F2FE', image_url: 'http://x/y.png' });
    ok('create → 201', A.status === 201, A.json.message);
    const alphaId: number = A.json.data?.id;
    createdBrandIds.push(alphaId);
    ok('logo saved and product_count starts at 0', A.json.data?.image_url === 'http://x/y.png' && A.json.data?.product_count === 0);
    const dup = await call('/api/content/brands', adminTok, 'POST', { name: `  ${TAG.toLowerCase()} ALPHA ` });
    ok('duplicate name (any case / spaces) → 409', dup.status === 409, dup.json.message);
    ok('empty name → 422 (validation)', (await call('/api/content/brands', adminTok, 'POST', { name: '   ' })).status === 422);
    ok('bad tint → 422 (validation)', (await call('/api/content/brands', adminTok, 'POST', { name: `${TAG} X`, tint: 'red' })).status === 422);
    const B = await call('/api/content/brands', adminTok, 'POST', { name: `${TAG} Beta` });
    const betaId: number = B.json.data?.id;
    createdBrandIds.push(betaId);

    // ── 3) Products via dropdown (brand_id) ───────────────────────────────────
    console.log('\n3) Products are created with a brand from the dropdown');
    const p1 = await mkProduct({ name: `${TAG} Food`, brand_id: alphaId });
    createdProductIds.push(p1.json.data?.id);
    ok('create with brand_id → 201', p1.status === 201);
    ok('product carries brand_id and the brand NAME', p1.json.data?.brand_id === alphaId && p1.json.data?.brand === `${TAG} Alpha`);
    const bad = await mkProduct({ brand_id: 99999999 });
    ok('unknown brand_id → 400', bad.status === 400, bad.json.message);
    const none = await mkProduct({ name: `${TAG} NoBrand` });
    createdProductIds.push(none.json.data?.id);
    ok('product without a brand is allowed', none.status === 201 && none.json.data?.brand_id === null && none.json.data?.brand === '');

    // legacy text → reuses the existing brand (case-insensitive), or creates a new one
    const legacy = await mkProduct({ name: `${TAG} Legacy`, brand: `${TAG.toLowerCase()} alpha` });
    createdProductIds.push(legacy.json.data?.id);
    ok('legacy brand text matches the existing brand (no duplicate)', legacy.json.data?.brand_id === alphaId && legacy.json.data?.brand === `${TAG} Alpha`);
    const legacyNew = await mkProduct({ name: `${TAG} Legacy2`, brand: `${TAG} Gamma` });
    createdProductIds.push(legacyNew.json.data?.id);
    const gammaId: number = legacyNew.json.data?.brand_id;
    createdBrandIds.push(gammaId);
    ok('unknown legacy brand text auto-creates a brand', typeof gammaId === 'number');

    // ── 4) Changing a product's brand ─────────────────────────────────────────
    console.log('\n4) Change / clear a product brand');
    const up = await call(`/api/products/${p1.json.data.id}`, adminTok, 'PATCH', { brand_id: betaId });
    ok('switch to another brand', up.status === 200 && up.json.data?.brand_id === betaId && up.json.data?.brand === `${TAG} Beta`);
    const keep = await call(`/api/products/${p1.json.data.id}`, adminTok, 'PATCH', { name: `${TAG} Food 2` });
    ok('editing other fields keeps the brand', keep.json.data?.brand_id === betaId);
    const clr = await call(`/api/products/${p1.json.data.id}`, adminTok, 'PATCH', { brand_id: null });
    ok('brand_id: null clears the brand', clr.json.data?.brand_id === null && clr.json.data?.brand === '');
    await call(`/api/products/${p1.json.data.id}`, adminTok, 'PATCH', { brand_id: alphaId });

    // ── 5) Filtering (what the app uses) ──────────────────────────────────────
    console.log('\n5) Products filtered by brand');
    const byId = await call(`/api/products?brand_id=${alphaId}`, null);
    const idsA = (byId.json.data ?? []).map((p: any) => p.id);
    ok('?brand_id= returns that brand\'s products only', byId.status === 200 && idsA.length === 2 && (byId.json.data ?? []).every((p: any) => p.brand_id === alphaId));
    ok('…and not the brandless product', !idsA.includes(none.json.data.id));
    const byName = await call(`/api/products?brand=${encodeURIComponent(`${TAG.toLowerCase()} alpha`)}`, null);
    ok('?brand=<name> works case-insensitively', (byName.json.data ?? []).length === 2);
    const empty = await call(`/api/products?brand_id=${betaId}`, null);
    ok('brand with no products → empty list', empty.status === 200 && (empty.json.data ?? []).length === 0);
    const withFeat = await call(`/api/products?brand_id=${alphaId}&featured=true`, null);
    ok('combines with other filters', (withFeat.json.data ?? []).length === 0);

    // ── 6) What the public app sees ───────────────────────────────────────────
    console.log('\n6) Public app visibility');
    const pub = await call('/api/content/brands', null);
    const pubIds: number[] = (pub.json.data ?? []).map((b: any) => b.id);
    ok('public brands endpoint needs no login', pub.status === 200);
    ok('brand WITH products is listed', pubIds.includes(alphaId));
    ok('brand with NO products is hidden', !pubIds.includes(betaId));
    const alphaPub = (pub.json.data ?? []).find((b: any) => b.id === alphaId);
    ok('listing includes logo + product_count', alphaPub?.image_url === 'http://x/y.png' && alphaPub?.product_count === 2);
    const home1 = await call('/api/content/home', null);
    ok('home content includes the same brand', (home1.json.data?.brands ?? []).some((b: any) => b.id === alphaId));

    await call(`/api/content/brands/${alphaId}`, adminTok, 'PATCH', { is_active: false });
    const pub2 = await call('/api/content/brands', null);
    ok('deactivated brand disappears from the app', !(pub2.json.data ?? []).some((b: any) => b.id === alphaId));
    const adminList = await call('/api/content/admin/brands', adminTok);
    ok('…but stays in the admin list', (adminList.json.data ?? []).some((b: any) => b.id === alphaId && b.is_active === false));
    await call(`/api/content/brands/${alphaId}`, adminTok, 'PATCH', { is_active: true });

    await call(`/api/products/${legacy.json.data.id}`, adminTok, 'PATCH', { is_active: false });
    const pub3 = await call('/api/content/brands', null);
    ok('inactive products are not counted', (pub3.json.data ?? []).find((b: any) => b.id === alphaId)?.product_count === 1);
    await call(`/api/products/${legacy.json.data.id}`, adminTok, 'PATCH', { is_active: true });

    // ── 7) Rename & delete ────────────────────────────────────────────────────
    console.log('\n7) Rename and delete');
    const ren = await call(`/api/content/brands/${alphaId}`, adminTok, 'PATCH', { name: `${TAG} Alpha Renamed` });
    ok('rename OK', ren.status === 200 && ren.json.data?.name === `${TAG} Alpha Renamed`);
    const prod = await call(`/api/products/${p1.json.data.id}`, null);
    ok('products show the new brand name', prod.json.data?.brand === `${TAG} Alpha Renamed`);
    const clash = await call(`/api/content/brands/${alphaId}`, adminTok, 'PATCH', { name: `${TAG} BETA` });
    ok('rename onto an existing name → 409', clash.status === 409);
    const keepName = await call(`/api/content/brands/${alphaId}`, adminTok, 'PATCH', { name: `${TAG} Alpha Renamed`, emoji: '🐕' });
    ok('re-saving with its own name is fine', keepName.status === 200);
    const rmLogo = await call(`/api/content/brands/${alphaId}`, adminTok, 'PATCH', { image_url: '' });
    ok('empty image_url removes the logo', rmLogo.json.data?.image_url === null);
    const delUsed = await call(`/api/content/brands/${alphaId}`, adminTok, 'DELETE');
    ok('deleting a brand that has products → 409', delUsed.status === 409, delUsed.json.message);
    const delEmpty = await call(`/api/content/brands/${betaId}`, adminTok, 'DELETE');
    ok('deleting an unused brand → 200', delEmpty.status === 200);
    createdBrandIds.splice(createdBrandIds.indexOf(betaId), 1);
    ok('deleting a missing brand → 404', (await call(`/api/content/brands/${betaId}`, adminTok, 'DELETE')).status === 404);

    // ── 8) Access control ─────────────────────────────────────────────────────
    console.log('\n8) Access control');
    ok('customer cannot create a brand', (await call('/api/content/brands', custTok, 'POST', { name: `${TAG} Nope` })).status === 403);
    ok('anonymous cannot create a brand', (await call('/api/content/brands', null, 'POST', { name: `${TAG} Nope` })).status === 401);
    ok('customer cannot see the admin brand list', (await call('/api/content/admin/brands', custTok)).status === 403);
    ok('customer cannot delete a brand', (await call(`/api/content/brands/${alphaId}`, custTok, 'DELETE')).status === 403);
  } finally {
    await db.query('DELETE FROM products WHERE id = ANY($1::int[])', [createdProductIds.filter(Boolean)]);
    await db.query('DELETE FROM brands WHERE id = ANY($1::int[])', [createdBrandIds.filter(Boolean)]);
    await db.query(`DELETE FROM brands WHERE name LIKE $1`, [`${TAG}%`]);
    await db.query(`DELETE FROM users WHERE email IN ('brands-test-admin@medpet.com','brands-test-customer@medpet.com')`);
    server.close();
  }

  console.log(`\n${failed === 0 ? '✅' : '❌'} ${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
