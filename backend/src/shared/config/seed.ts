import bcrypt from 'bcryptjs';
import { PoolClient } from 'pg';
import db from './database';
import dotenv from 'dotenv';

dotenv.config();

const ADMIN = {
  name: process.env.ADMIN_NAME ?? 'MedPet Admin',
  email: process.env.ADMIN_EMAIL ?? 'admin@medpet.com',
  password: process.env.ADMIN_PASSWORD ?? 'admin123',
};

const IMG = (id: string): string => `https://images.unsplash.com/${id}?w=600&q=80`;

const CATEGORIES = [
  { name: 'Dogs',    slug: 'dogs',    icon: '🐕', color: '#FDE8EA', icon_bg: '#F8B7BE', sort_order: 1, image: IMG('photo-1583337130417-3346a1be7dee') },
  { name: 'Cats',    slug: 'cats',    icon: '🐈', color: '#FEF3E8', icon_bg: '#FDDCB5', sort_order: 2, image: IMG('photo-1514888286974-6c03e2ca1dba') },
  { name: 'Birds',   slug: 'birds',   icon: '🐦', color: '#EEF2FF', icon_bg: '#C7D2FE', sort_order: 3, image: IMG('photo-1452570053594-1b985d6ea890') },
  { name: 'Fish',    slug: 'fish',    icon: '🐟', color: '#E0F7FA', icon_bg: '#B2EBF2', sort_order: 4, image: IMG('photo-1524704796725-9fc3044a58b2') },
  { name: 'Rabbit',  slug: 'rabbit',  icon: '🐇', color: '#FCE4EC', icon_bg: '#F8BBD0', sort_order: 5, image: IMG('photo-1535241749838-299277b6305f') },
  { name: 'Reptile', slug: 'reptile', icon: '🦎', color: '#F1F8E9', icon_bg: '#DCEDC8', sort_order: 6, image: IMG('photo-1517331156700-3c241d2b4d83') },
];

// price = discount_price, original = original_price
const PRODUCTS = [
  { name: 'Deworming Tablets', brand: 'Vet Guard', cat: 'dogs', emoji: '💊', image: IMG('photo-1584308666744-24d5c474f2ae'), original: 200, price: 149, rating: 4.8, reviews: 2300, stock: 120, featured: true, desc: 'Broad-spectrum deworming tablets effective against roundworms, hookworms and tapeworms.' },
  { name: 'Flea & Tick Spray', brand: 'PetCare Pro', cat: 'dogs', emoji: '🧴', image: IMG('photo-1556228453-efd6c1ff04f6'), original: 399, price: 299, rating: 4.6, reviews: 1100, stock: 80, featured: true, desc: 'Fast-acting spray that kills fleas and ticks on contact and protects for up to 30 days.' },
  { name: 'Vitamin Supplement', brand: 'NutriPet', cat: 'cats', emoji: '🌿', image: IMG('photo-1550572017-edd951b55104'), original: 599, price: 450, rating: 4.9, reviews: 3500, stock: 60, featured: true, desc: 'Daily multivitamin chews with Omega-3, biotin and essential minerals.' },
  { name: 'Dental Chews', brand: 'SmileVet', cat: 'dogs', emoji: '🦴', image: IMG('photo-1601758228041-f3b2795255f1'), original: 249, price: 189, rating: 4.7, reviews: 890, stock: 150, featured: true, desc: 'Tasty dental chews that reduce plaque and tartar while freshening breath.' },
  { name: 'Premium Dog Food', brand: 'NutriPet', cat: 'dogs', emoji: '🥫', image: IMG('photo-1589924691995-400dc9ecc119'), original: 1599, price: 1299, rating: 4.8, reviews: 5200, stock: 40, featured: false, desc: 'Grain-free, high-protein dry food crafted by vet nutritionists.' },
  { name: 'Cat Litter (5kg)', brand: 'FreshPaws', cat: 'cats', emoji: '🪣', image: IMG('photo-1543852786-1cf6624b9987'), original: 699, price: 549, rating: 4.5, reviews: 2000, stock: 70, featured: false, desc: 'Clumping, dust-free litter with superior odour control.' },
  { name: 'Eye Drops', brand: 'Vet Guard', cat: 'cats', emoji: '💧', image: IMG('photo-1584017911766-d451b3d0e843'), original: 229, price: 179, rating: 4.4, reviews: 640, stock: 8, featured: false, desc: 'Soothing sterile eye drops that relieve irritation, redness and tear staining.' },
  { name: 'Bird Vitamin Drops', brand: 'AviCare', cat: 'birds', emoji: '🐦', image: IMG('photo-1452570053594-1b985d6ea890'), original: 299, price: 219, rating: 4.6, reviews: 410, stock: 55, featured: false, desc: 'Water-soluble multivitamin drops for cage and aviary birds.' },
  { name: 'Aquarium Water Conditioner', brand: 'AquaSafe', cat: 'fish', emoji: '🐟', image: IMG('photo-1524704796725-9fc3044a58b2'), original: 199, price: 159, rating: 4.7, reviews: 1300, stock: 90, featured: false, desc: 'Instantly removes chlorine and chloramine, making tap water safe for fish.' },
  { name: 'Rabbit Pellet Feed', brand: 'NutriPet', cat: 'rabbit', emoji: '🥕', image: IMG('photo-1535241749838-299277b6305f'), original: 499, price: 399, rating: 4.5, reviews: 720, stock: 45, featured: false, desc: 'High-fibre timothy-hay based pellets for digestive and dental health.' },
  { name: 'Calcium Supplement', brand: 'ReptiCare', cat: 'reptile', emoji: '🦴', image: IMG('photo-1517331156700-3c241d2b4d83'), original: 329, price: 249, rating: 4.6, reviews: 380, stock: 35, featured: false, desc: 'Calcium with D3 powder for reptiles to prevent metabolic bone disease.' },
  { name: 'Pet Grooming Kit', brand: 'SmileVet', cat: 'dogs', emoji: '✂️', image: IMG('photo-1581888227599-779811939961'), original: 1199, price: 899, rating: 4.8, reviews: 1800, stock: 25, featured: true, desc: 'Complete grooming set with low-noise clippers, scissors, comb and nail trimmer.' },
  { name: 'Joint Care Tablets', brand: 'Vet Guard', cat: 'dogs', emoji: '💊', image: IMG('photo-1584308666744-24d5c474f2ae'), original: 699, price: 549, rating: 4.9, reviews: 2700, stock: 0, featured: false, instock: false, desc: 'Glucosamine and chondroitin tablets that support joint mobility.' },
  { name: 'Catnip Treats', brand: 'FreshPaws', cat: 'cats', emoji: '🌿', image: IMG('photo-1592194996308-7b43878e84a6'), original: 169, price: 129, rating: 4.7, reviews: 960, stock: 100, featured: false, desc: 'Crunchy treats infused with premium catnip for playful enrichment.' },
];

const OFFERS = [
  { title: 'Flat 30% Off', subtitle: 'On all pet medicines\nThis weekend only!', badge: 'SALE', code: 'MED30', emoji: '💊', color_from: '#E63946', color_to: '#A4121A', sort_order: 1 },
  { title: 'Premium Dog Food', subtitle: 'Nutrition crafted by\nvet specialists', badge: 'NEW', code: '', emoji: '🐕', color_from: '#FF6B35', color_to: '#C1440E', sort_order: 2 },
  { title: 'Free Consultation', subtitle: 'Talk to a vet online\n24/7 support available', badge: 'FREE', code: 'VET0', emoji: '👨‍⚕️', color_from: '#F59E0B', color_to: '#B45309', sort_order: 3 },
];

const SEEDED_MARKER = 'catalog_seeded_at';

async function insertCatalog(client: PoolClient): Promise<void> {
  const slugToId = new Map<string, number>();
  for (const c of CATEGORIES) {
    const { rows } = await client.query<{ id: number }>(
      `INSERT INTO categories (name, slug, icon, image_url, color, icon_bg, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [c.name, c.slug, c.icon, c.image, c.color, c.icon_bg, c.sort_order]
    );
    slugToId.set(c.slug, rows[0].id);
  }

  for (const p of PRODUCTS) {
    await client.query(
      `INSERT INTO products
         (name, brand, description, emoji, image_url, category_id, original_price, discount_price,
          rating, reviews_count, stock_quantity, in_stock, is_featured)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [p.name, p.brand, p.desc, p.emoji, p.image, slugToId.get(p.cat) ?? null,
       p.original, p.price, p.rating, p.reviews, p.stock, p.instock !== false, p.featured]
    );
  }

  for (const o of OFFERS) {
    await client.query(
      `INSERT INTO offers (title, subtitle, badge, code, emoji, color_from, color_to, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [o.title, o.subtitle, o.badge, o.code || null, o.emoji, o.color_from, o.color_to, o.sort_order]
    );
  }
}

async function markSeeded(client: PoolClient): Promise<void> {
  await client.query(
    `INSERT INTO app_settings (key, value) VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [SEEDED_MARKER, new Date().toISOString()]
  );
}

/**
 * Startup seed: fills the catalog on a brand-new database only. The marker row
 * stops it from re-adding demo products after an admin has deleted them.
 */
export async function seedCatalogIfEmpty(): Promise<void> {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock($1)', [7_311_2027]);

    const marker = await client.query(`SELECT 1 FROM app_settings WHERE key = $1`, [SEEDED_MARKER]);
    if (marker.rowCount) {
      await client.query('COMMIT');
      return;
    }

    const { rows } = await client.query<{ n: number }>(
      `SELECT (SELECT COUNT(*) FROM categories)::int + (SELECT COUNT(*) FROM products)::int AS n`
    );
    if (rows[0].n === 0) {
      await insertCatalog(client);
      console.log(`🌱 Fresh database — seeded ${CATEGORIES.length} categories, ${PRODUCTS.length} products, ${OFFERS.length} offers.`);
    } else {
      console.log('🌱 Catalog already has data — skipping demo seed.');
    }
    await markSeeded(client);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/** `npm run seed` — DESTRUCTIVE full reset of the catalog + admin password. */
async function resetSeed(): Promise<void> {
  const client = await db.getClient();
  try {
    console.log('🌱 Seeding database...');
    await client.query('BEGIN');

    const hash = await bcrypt.hash(ADMIN.password, 12);
    await client.query(
      `INSERT INTO users (name, email, password, role)
       VALUES ($1, $2, $3, 'admin')
       ON CONFLICT (email) DO UPDATE SET role = 'admin', password = EXCLUDED.password`,
      [ADMIN.name, ADMIN.email.toLowerCase(), hash]
    );

    await client.query('TRUNCATE TABLE offers RESTART IDENTITY');
    await client.query('TRUNCATE TABLE products RESTART IDENTITY CASCADE');
    await client.query('TRUNCATE TABLE categories RESTART IDENTITY CASCADE');

    await insertCatalog(client);
    await markSeeded(client);

    await client.query('COMMIT');
    console.log(`✅ Seed complete — ${CATEGORIES.length} categories, ${PRODUCTS.length} products, ${OFFERS.length} offers.`);
    console.log(`   👤 Admin login: ${ADMIN.email}`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Seed failed:', err);
    process.exitCode = 1;
  } finally {
    client.release();
    await db.pool.end();
  }
}

if (require.main === module) {
  void resetSeed();
}
