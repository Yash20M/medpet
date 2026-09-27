/**
 * Deployment smoke test — runs against ANY running MedPet API (local or hosted).
 *
 *   SMOKE_URL=https://medpet-api.onrender.com \
 *   SMOKE_ADMIN_EMAIL=admin@medpet.com SMOKE_ADMIN_PASSWORD=... \
 *   npm run test:smoke
 *
 * Verifies the auto-bootstrap (admin + catalog + content), the full customer
 * order path, admin visibility and Socket.IO. The test order is cancelled at
 * the end; the throwaway customer account (smoke-*@medpet.test) remains.
 */
import { io } from 'socket.io-client';

const ROOT = (process.env.SMOKE_URL ?? 'http://localhost:5000').replace(/\/+$/, '');
const API = `${ROOT}/api`;
const ADMIN_EMAIL = process.env.SMOKE_ADMIN_EMAIL ?? 'admin@medpet.com';
const ADMIN_PASSWORD = process.env.SMOKE_ADMIN_PASSWORD ?? 'admin123';

let passed = 0;
let failed = 0;
const check = (name: string, ok: unknown, detail?: unknown): void => {
  if (ok) { passed++; console.log(`  ✅ ${name}`); }
  else { failed++; console.log(`  ❌ ${name}`, detail ?? ''); }
};

async function call<T = any>(method: string, path: string, body?: unknown, token?: string):
  Promise<{ status: number; json: T }> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as T;
  return { status: res.status, json };
}

async function waitForHealthy(): Promise<boolean> {
  // Free hosts cold-start in up to ~60s.
  for (let i = 0; i < 18; i++) {
    try {
      const r = await fetch(`${ROOT}/health`);
      if (r.ok) return true;
    } catch { /* still waking up */ }
    await new Promise((r) => setTimeout(r, 5000));
  }
  return false;
}

async function main(): Promise<void> {
  console.log(`\n🔎 Smoke testing ${ROOT}\n`);

  console.log('Health');
  check('GET /health responds 200', await waitForHealthy());

  console.log('Auto-created admin');
  const adminLogin = await call('POST', '/auth/login', { email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  const adminToken: string | undefined = adminLogin.json?.data?.token;
  check('admin can log in', adminLogin.status === 200 && adminToken, adminLogin.json?.message);
  check('admin has role=admin', adminLogin.json?.data?.user?.role === 'admin');

  console.log('Auto-seeded app data');
  const cats = await call('GET', '/categories');
  check('categories seeded', Array.isArray(cats.json?.data) && cats.json.data.length > 0, cats.json?.data?.length);
  const prods = await call('GET', '/products');
  const products: any[] = Array.isArray(prods.json?.data) ? prods.json.data : [];
  check('products seeded', products.length > 0, products.length);
  const offers = await call('GET', '/offers');
  check('offers seeded', Array.isArray(offers.json?.data) && offers.json.data.length > 0);
  const home = await call('GET', '/content/home');
  const h = home.json?.data ?? {};
  check('home content: health tips', h.tips?.length > 0);
  check('home content: brands', h.brands?.length > 0);
  check('home content: testimonials', h.testimonials?.length > 0);
  check('home content: stores', h.stores?.length > 0);
  check('home content: settings', h.settings && 'delivery_eta_minutes' in h.settings);

  console.log('Customer flow');
  const email = `smoke-${Date.now()}@medpet.test`;
  const reg = await call('POST', '/auth/register', { name: 'Smoke Test', email, password: 'smoke12345' });
  const custToken: string | undefined = reg.json?.data?.token;
  check('customer can register', reg.status === 201 && custToken, reg.json?.message);
  const login = await call('POST', '/auth/login', { email, password: 'smoke12345' });
  check('customer can log in', login.status === 200 && login.json?.data?.token);

  const product = products.find((p) => p.in_stock && p.stock_quantity > 0);
  check('an in-stock product exists', product);
  let orderId: number | undefined;
  if (custToken && product) {
    const add = await call('POST', '/cart', { productId: product.id, quantity: 1 }, custToken);
    check('add to cart', add.status < 300, add.json?.message);
    const cart = await call('GET', '/cart', undefined, custToken);
    check('cart has the item', JSON.stringify(cart.json?.data ?? '').includes(product.name));
    const order = await call('POST', '/orders', {
      items: [{ productId: product.id, quantity: 1 }],
      address: 'Smoke test, Rajkamal Square, Amravati',
      contactPhone: '9999999999',
      paymentMethod: 'cod',
      latitude: 20.9320, longitude: 77.7523,
    }, custToken);
    orderId = order.json?.data?.id;
    check('place COD order', order.status === 201 && orderId, order.json?.message);
    const mine = await call('GET', '/orders', undefined, custToken);
    check('customer sees own order', (mine.json?.data ?? []).some((o: any) => o.id === orderId));
  }

  console.log('Admin panel APIs');
  if (adminToken) {
    const dash = await call('GET', '/dashboard/summary', undefined, adminToken);
    check('dashboard summary', dash.status === 200, dash.json?.message);
    const all = await call('GET', '/orders/admin/all', undefined, adminToken);
    check('admin sees the new order', orderId !== undefined && (all.json?.data ?? []).some((o: any) => o.id === orderId));
    const denied = await call('GET', '/orders/admin/all', undefined, custToken);
    check('customer is blocked from admin API', denied.status === 403 || denied.status === 401);
    if (orderId) {
      const cancel = await call('PATCH', `/orders/${orderId}/status`, { status: 'cancelled', reason: 'Smoke test' }, adminToken);
      check('admin can update order status (cancel test order)', cancel.status === 200, cancel.json?.message);
    }
  }

  console.log('Realtime');
  const socketOk = await new Promise<boolean>((resolve) => {
    const s = io(ROOT, { auth: { token: adminToken }, transports: ['websocket'], timeout: 20_000 });
    const done = (v: boolean) => { s.close(); resolve(v); };
    s.on('connect', () => done(true));
    s.on('connect_error', (e) => { console.log('    socket error:', e.message); done(false); });
    setTimeout(() => done(false), 25_000);
  });
  check('Socket.IO websocket connects', socketOk);

  console.log(`\n${failed === 0 ? '✅' : '❌'} ${passed} passed, ${failed} failed\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('Smoke test crashed:', err);
  process.exit(1);
});
