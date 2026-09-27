import db from './database';
import dotenv from 'dotenv';

dotenv.config();

// ─── Reusable updated_at trigger function ───────────────────────────────────
const SQL_UPDATED_AT_FN = `
  CREATE OR REPLACE FUNCTION set_updated_at()
  RETURNS TRIGGER AS $$
  BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;
`;

const updatedAtTrigger = (table: string): string => `
  DROP TRIGGER IF EXISTS trg_${table}_updated_at ON ${table};
  CREATE TRIGGER trg_${table}_updated_at
    BEFORE UPDATE ON ${table}
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
`;

// ─── Tables ─────────────────────────────────────────────────────────────────
const SQL_USERS = `
  CREATE TABLE IF NOT EXISTS users (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    email       VARCHAR(255) UNIQUE NOT NULL,
    password    VARCHAR(255) NOT NULL,
    phone       VARCHAR(20),
    avatar_url  TEXT,
    role        VARCHAR(20) DEFAULT 'customer' CHECK (role IN ('customer', 'admin', 'delivery')),
    is_active   BOOLEAN DEFAULT true,
    created_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  );

  -- Allow the 'delivery' role on databases created before it existed by
  -- rebuilding the CHECK constraint (Postgres won't widen it automatically).
  ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
  ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('customer', 'admin', 'delivery'));

  -- Password-reset / set-password invite flow (used by delivery-partner onboarding).
  ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_hash    TEXT;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMPTZ;

  -- Delivery-partner vehicle details (shown on the customer tracking card).
  ALTER TABLE users ADD COLUMN IF NOT EXISTS vehicle_number VARCHAR(20);
  ALTER TABLE users ADD COLUMN IF NOT EXISTS vehicle_type   VARCHAR(20)
    CHECK (vehicle_type IN ('bike','scooter') OR vehicle_type IS NULL);
`;

const SQL_CATEGORIES = `
  CREATE TABLE IF NOT EXISTS categories (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(80) NOT NULL,
    slug        VARCHAR(80) UNIQUE NOT NULL,
    icon        VARCHAR(16) DEFAULT '🐾',
    image_url   TEXT,
    parent_id   INTEGER REFERENCES categories(id) ON DELETE CASCADE,
    color       VARCHAR(16) DEFAULT '#FDE8EA',
    icon_bg     VARCHAR(16) DEFAULT '#F8B7BE',
    sort_order  INTEGER DEFAULT 0,
    is_active   BOOLEAN DEFAULT true,
    created_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  );
  ALTER TABLE categories ADD COLUMN IF NOT EXISTS image_url TEXT;
  ALTER TABLE categories ADD COLUMN IF NOT EXISTS parent_id INTEGER REFERENCES categories(id) ON DELETE CASCADE;
  CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id);
`;

const SQL_PRODUCTS = `
  CREATE TABLE IF NOT EXISTS products (
    id                  SERIAL PRIMARY KEY,
    name                VARCHAR(160) NOT NULL,
    brand               VARCHAR(120) DEFAULT '',
    description         TEXT DEFAULT '',
    emoji               VARCHAR(16) DEFAULT '💊',
    image_url           TEXT,
    category_id         INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    original_price      INTEGER NOT NULL DEFAULT 0,
    discount_price      INTEGER NOT NULL DEFAULT 0,
    rating              NUMERIC(2,1) DEFAULT 4.5,
    reviews_count       INTEGER DEFAULT 0,
    stock_quantity      INTEGER NOT NULL DEFAULT 100,
    low_stock_threshold INTEGER NOT NULL DEFAULT 10,
    in_stock            BOOLEAN DEFAULT true,
    is_featured         BOOLEAN DEFAULT false,
    is_active           BOOLEAN DEFAULT true,
    created_at          TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
  CREATE INDEX IF NOT EXISTS idx_products_featured ON products(is_featured);
  ALTER TABLE products ADD COLUMN IF NOT EXISTS stock_quantity INTEGER NOT NULL DEFAULT 100;
  ALTER TABLE products ADD COLUMN IF NOT EXISTS low_stock_threshold INTEGER NOT NULL DEFAULT 10;
`;

const SQL_OFFERS = `
  CREATE TABLE IF NOT EXISTS offers (
    id          SERIAL PRIMARY KEY,
    title       VARCHAR(120) NOT NULL,
    subtitle    VARCHAR(200) DEFAULT '',
    badge       VARCHAR(24) DEFAULT 'OFFER',
    code        VARCHAR(40),
    emoji       VARCHAR(16) DEFAULT '🎁',
    color_from  VARCHAR(16) DEFAULT '#E63946',
    color_to    VARCHAR(16) DEFAULT '#A4121A',
    sort_order  INTEGER DEFAULT 0,
    is_active   BOOLEAN DEFAULT true,
    created_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  );
`;

// App-content tables driving the mobile Home sections (health tips, brands,
// testimonials, nearby stores) plus a key-value settings store. Each list
// table is seeded once (only when empty) so a fresh install isn't blank.
const SQL_CONTENT = `
  CREATE TABLE IF NOT EXISTS health_tips (
    id          SERIAL PRIMARY KEY,
    title       VARCHAR(120) NOT NULL,
    teaser      VARCHAR(240) DEFAULT '',
    icon        VARCHAR(40) DEFAULT 'sunny',
    color_from  VARCHAR(16) DEFAULT '#FCD34D',
    color_to    VARCHAR(16) DEFAULT '#F59E0B',
    read_mins   INTEGER NOT NULL DEFAULT 3,
    sections    JSONB NOT NULL DEFAULT '[]',
    sort_order  INTEGER DEFAULT 0,
    is_active   BOOLEAN DEFAULT true,
    created_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS brands (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(80) NOT NULL,
    emoji       VARCHAR(16) DEFAULT '🐾',
    tint        VARCHAR(16) DEFAULT '#D1FAE5',
    sort_order  INTEGER DEFAULT 0,
    is_active   BOOLEAN DEFAULT true,
    created_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS testimonials (
    id          SERIAL PRIMARY KEY,
    owner_name  VARCHAR(80) NOT NULL,
    pet_name    VARCHAR(80) DEFAULT '',
    pet_emoji   VARCHAR(16) DEFAULT '🐕',
    rating      INTEGER NOT NULL DEFAULT 5 CHECK (rating BETWEEN 1 AND 5),
    body        TEXT NOT NULL,
    sort_order  INTEGER DEFAULT 0,
    is_active   BOOLEAN DEFAULT true,
    created_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS stores (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(120) NOT NULL,
    area        VARCHAR(120) DEFAULT '',
    distance_km NUMERIC(5,1) NOT NULL DEFAULT 1.0,
    eta_mins    INTEGER NOT NULL DEFAULT 20,
    is_open     BOOLEAN DEFAULT true,
    sort_order  INTEGER DEFAULT 0,
    is_active   BOOLEAN DEFAULT true,
    created_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS app_settings (
    key         VARCHAR(60) PRIMARY KEY,
    value       TEXT NOT NULL DEFAULT '',
    updated_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  );

  ALTER TABLE products ADD COLUMN IF NOT EXISTS is_flash_sale BOOLEAN DEFAULT false;

  -- Seed defaults only on first run (tables empty / keys missing).
  INSERT INTO app_settings (key, value)
  VALUES ('delivery_eta_minutes', '18'), ('flash_sale_ends_at', '')
  ON CONFLICT (key) DO NOTHING;

  INSERT INTO brands (name, emoji, tint, sort_order)
  SELECT * FROM (VALUES
    ('Vet Guard', '🛡️', '#D1FAE5', 1), ('PetCare Pro', '🐾', '#E0F2FE', 2),
    ('NutriPet', '🥩', '#FEF3C7', 3), ('FurWell', '✨', '#EDE9FE', 4),
    ('AquaLife', '🐠', '#CFFAFE', 5), ('Birdiez', '🦜', '#FFE4E6', 6)
  ) AS seed(name, emoji, tint, sort_order)
  WHERE NOT EXISTS (SELECT 1 FROM brands);

  INSERT INTO testimonials (owner_name, pet_name, pet_emoji, rating, body, sort_order)
  SELECT * FROM (VALUES
    ('Priya S.', 'Bruno', '🐕', 5, 'Medicines arrived in 20 minutes when Bruno had an upset tummy. Lifesaver — literally!', 1),
    ('Arjun M.', 'Misty', '🐈', 5, 'The vet consult was so smooth. Doctor was patient and Misty is doing great now.', 2),
    ('Neha K.', 'Coco', '🐇', 4, 'Great prices on food and supplements. The subscription saves me a trip every month.', 3)
  ) AS seed(owner_name, pet_name, pet_emoji, rating, body, sort_order)
  WHERE NOT EXISTS (SELECT 1 FROM testimonials);

  INSERT INTO stores (name, area, distance_km, eta_mins, is_open, sort_order)
  SELECT * FROM (VALUES
    ('MedPet Indiranagar', '100 Ft Road', 1.2, 18, true, 1),
    ('MedPet Koramangala', '5th Block', 3.8, 26, true, 2),
    ('MedPet Whitefield', 'Phoenix Mall', 9.5, 41, false, 3)
  ) AS seed(name, area, distance_km, eta_mins, is_open, sort_order)
  WHERE NOT EXISTS (SELECT 1 FROM stores);

  INSERT INTO health_tips (title, teaser, icon, color_from, color_to, read_mins, sections, sort_order)
  SELECT * FROM (VALUES
    ('Daily Care Essentials', 'Five small habits that keep your pet thriving every single day.', 'sunny', '#FCD34D', '#F59E0B', 3,
     '[{"heading":"Fresh water, always","body":"Change your pet’s water at least twice a day. Dehydration is one of the most common (and most preventable) causes of vet visits, especially in warmer months."},{"heading":"A consistent routine","body":"Pets are creatures of habit. Feeding, walking and play at roughly the same times each day lowers anxiety and makes behavioural issues far less likely."},{"heading":"Daily brushing","body":"Even short-haired breeds benefit from a quick daily brush — it distributes natural oils, reduces shedding, and doubles as a bonding ritual."},{"heading":"Watch the paws","body":"Check paw pads for cracks, foreign objects or redness after walks. Hot pavement and rough terrain do more damage than most owners realise."},{"heading":"Five minutes of training","body":"Short, positive training sessions keep your pet’s mind sharp. Five focused minutes beats an occasional hour-long session."}]'::jsonb, 1),
    ('Nutrition Made Simple', 'What to feed, what to avoid, and how much is actually enough.', 'nutrition', '#FB923C', '#F97316', 4,
     '[{"heading":"Read the first three ingredients","body":"The first three ingredients on a food label make up most of the bowl. Look for named meats (chicken, salmon) rather than vague “meat meal”."},{"heading":"Portion by body condition","body":"Feeding guides on packets are starting points, not rules. You should be able to feel (not see) your pet’s ribs. Adjust portions every few weeks."},{"heading":"Foods to never share","body":"Chocolate, grapes, onions, garlic and xylitol are toxic to dogs and cats. When in doubt, don’t share from your plate."},{"heading":"Transition foods slowly","body":"Switching foods overnight is the top cause of upset stomachs. Mix the new food in gradually over 7–10 days."}]'::jsonb, 2),
    ('Vaccination Schedule Guide', 'The core vaccines every pet needs — and exactly when they need them.', 'shield-checkmark', '#38BDF8', '#0EA5E9', 5,
     '[{"heading":"Puppies & kittens (6–16 weeks)","body":"Core vaccinations begin at 6–8 weeks and are boosted every 3–4 weeks until 16 weeks. Keep unvaccinated youngsters away from public spaces until the full course is done."},{"heading":"The annual booster myth","body":"Many core vaccines now protect for three years. Ask your vet for a titre test before assuming an annual booster is needed."},{"heading":"Rabies is non-negotiable","body":"Rabies vaccination is legally required in most regions and protects your family as much as your pet. Keep the certificate somewhere you can find it."},{"heading":"Track it in the app","body":"Add your pet’s profile in MedPet and we’ll remind you before every due date — no more guessing from a crumpled vaccination card."}]'::jsonb, 3),
    ('Emergency First Aid', 'Know these signs and steps before you ever need them.', 'alert-circle', '#FB7185', '#E11D48', 4,
     '[{"heading":"Know your emergency numbers","body":"Save your regular vet, the nearest 24-hour clinic and an animal poison helpline in your phone today. Minutes matter in a real emergency."},{"heading":"Signs that can’t wait","body":"Laboured breathing, repeated vomiting, collapse, seizures, bloated abdomen or an inability to urinate all warrant an immediate trip to the vet — not a wait-and-see."},{"heading":"A basic first-aid kit","body":"Gauze, self-adhesive bandage, saline, a digital thermometer and your pet’s medical records. Keep a duplicate kit in the car."},{"heading":"Transporting an injured pet","body":"Injured animals may bite out of pain. Use a blanket as a sling for large dogs and a secure carrier for cats and small pets."}]'::jsonb, 4)
  ) AS seed(title, teaser, icon, color_from, color_to, read_mins, sections, sort_order)
  WHERE NOT EXISTS (SELECT 1 FROM health_tips);
`;

const SQL_COUPONS = `
  CREATE TABLE IF NOT EXISTS coupons (
    id                   SERIAL PRIMARY KEY,
    code                 VARCHAR(40) UNIQUE NOT NULL,
    title                VARCHAR(120) NOT NULL,
    description          TEXT DEFAULT '',
    discount_type        VARCHAR(10) NOT NULL CHECK (discount_type IN ('percent','flat')),
    discount_value       NUMERIC(10,2) NOT NULL,
    max_discount_amount  INTEGER,
    min_order_value      INTEGER DEFAULT 0,
    condition_type       VARCHAR(20) NOT NULL DEFAULT 'none'
                         CHECK (condition_type IN ('none','first_order','nth_order','min_order_count')),
    condition_value      INTEGER,
    user_id              INTEGER REFERENCES users(id) ON DELETE CASCADE,
    show_on_ui           BOOLEAN DEFAULT true,
    usage_limit          INTEGER,
    per_user_limit       INTEGER DEFAULT 1,
    used_count           INTEGER DEFAULT 0,
    valid_from           TIMESTAMPTZ,
    valid_until          TIMESTAMPTZ,
    is_active            BOOLEAN DEFAULT true,
    created_at           TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at           TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code);
  CREATE INDEX IF NOT EXISTS idx_coupons_user ON coupons(user_id);

  CREATE TABLE IF NOT EXISTS coupon_categories (
    coupon_id   INTEGER NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
    category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    PRIMARY KEY (coupon_id, category_id)
  );

  CREATE TABLE IF NOT EXISTS coupon_products (
    coupon_id  INTEGER NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    PRIMARY KEY (coupon_id, product_id)
  );
`;

// coupon_redemptions.order_id references orders(id), so this must run after SQL_ORDERS.
const SQL_COUPON_REDEMPTIONS = `
  CREATE TABLE IF NOT EXISTS coupon_redemptions (
    id              SERIAL PRIMARY KEY,
    coupon_id       INTEGER NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    order_id        INTEGER REFERENCES orders(id) ON DELETE SET NULL,
    discount_amount INTEGER NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_coupon ON coupon_redemptions(coupon_id);
  CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_user ON coupon_redemptions(user_id);
`;

const SQL_PETS = `
  CREATE TABLE IF NOT EXISTS pets (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name        VARCHAR(80) NOT NULL,
    type        VARCHAR(20) NOT NULL DEFAULT 'dog'
                CHECK (type IN ('dog','cat','bird','fish','rabbit','horse','reptile','other')),
    breed       VARCHAR(80) DEFAULT '',
    gender      VARCHAR(10) DEFAULT 'unknown' CHECK (gender IN ('male','female','unknown')),
    age_years   NUMERIC(4,1),
    weight_kg   NUMERIC(5,1),
    avatar_url  TEXT,
    notes       TEXT DEFAULT '',
    created_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_pets_user ON pets(user_id);
`;

const SQL_WISHLIST = `
  CREATE TABLE IF NOT EXISTS wishlist_items (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, product_id)
  );
`;

const SQL_CART = `
  CREATE TABLE IF NOT EXISTS cart_items (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity    INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    created_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, product_id)
  );
`;

const SQL_NOTIFICATIONS = `
  CREATE TABLE IF NOT EXISTS notifications (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
    title       VARCHAR(160) NOT NULL,
    body        TEXT DEFAULT '',
    type        VARCHAR(40) DEFAULT 'general',
    is_read     BOOLEAN DEFAULT false,
    created_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
`;

const SQL_SUPPORT_TICKETS = `
  CREATE TABLE IF NOT EXISTS support_tickets (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subject     VARCHAR(160) NOT NULL,
    status      VARCHAR(12) NOT NULL DEFAULT 'open'
                CHECK (status IN ('open','pending','resolved','closed')),
    created_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_support_tickets_user ON support_tickets(user_id);
  CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);
`;

const SQL_SUPPORT_MESSAGES = `
  CREATE TABLE IF NOT EXISTS support_messages (
    id          SERIAL PRIMARY KEY,
    ticket_id   INTEGER NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
    sender_role VARCHAR(10) NOT NULL CHECK (sender_role IN ('user','admin')),
    sender_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body        TEXT NOT NULL,
    is_read     BOOLEAN DEFAULT false,
    created_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_support_messages_ticket ON support_messages(ticket_id);
`;

const SQL_ORDERS = `
  CREATE TABLE IF NOT EXISTS orders (
    id              SERIAL PRIMARY KEY,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status          VARCHAR(20) NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled')),
    subtotal        INTEGER NOT NULL DEFAULT 0,
    delivery_fee    INTEGER NOT NULL DEFAULT 0,
    total           INTEGER NOT NULL DEFAULT 0,
    address         TEXT DEFAULT '',
    contact_phone   VARCHAR(20) DEFAULT '',
    payment_method  VARCHAR(10) NOT NULL DEFAULT 'cod' CHECK (payment_method IN ('upi', 'cod')),
    latitude        NUMERIC(9,6),
    longitude       NUMERIC(9,6),
    created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
  CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

  -- Backfill columns on databases created before these fields existed.
  ALTER TABLE orders ADD COLUMN IF NOT EXISTS contact_phone  VARCHAR(20) DEFAULT '';
  ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method VARCHAR(10) NOT NULL DEFAULT 'cod';
  ALTER TABLE orders ADD COLUMN IF NOT EXISTS latitude       NUMERIC(9,6);
  ALTER TABLE orders ADD COLUMN IF NOT EXISTS longitude      NUMERIC(9,6);
  ALTER TABLE orders ADD COLUMN IF NOT EXISTS coupon_id      INTEGER REFERENCES coupons(id) ON DELETE SET NULL;
  ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount       INTEGER NOT NULL DEFAULT 0;

  -- Delivery-partner assignment: which partner claimed the order, and when.
  ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_partner_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
  ALTER TABLE orders ADD COLUMN IF NOT EXISTS accepted_at         TIMESTAMPTZ;
  CREATE INDEX IF NOT EXISTS idx_orders_delivery_partner ON orders(delivery_partner_id);

  -- ─── Real-time delivery tracking (Zomato-style) ─────────────────────────────
  -- The canonical status column above is untouched. These columns layer a
  -- finer live-journey phase on top, only meaningful while status = 'shipped'.

  -- Pickup (store/warehouse) location. Drop location reuses orders.latitude/longitude.
  ALTER TABLE orders ADD COLUMN IF NOT EXISTS pickup_lat NUMERIC(9,6);
  ALTER TABLE orders ADD COLUMN IF NOT EXISTS pickup_lng NUMERIC(9,6);

  -- Cached OSRM route, fetched ONCE at dispatch. polyline = JSON [[lat,lng],...].
  ALTER TABLE orders ADD COLUMN IF NOT EXISTS route_polyline     JSONB;
  ALTER TABLE orders ADD COLUMN IF NOT EXISTS route_distance_km  NUMERIC(6,2);
  ALTER TABLE orders ADD COLUMN IF NOT EXISTS route_eta_minutes  INTEGER;

  -- Live driver GPS (last processed ping, already snapped to the route).
  ALTER TABLE orders ADD COLUMN IF NOT EXISTS driver_lat          NUMERIC(9,6);
  ALTER TABLE orders ADD COLUMN IF NOT EXISTS driver_lng          NUMERIC(9,6);
  ALTER TABLE orders ADD COLUMN IF NOT EXISTS driver_heading      NUMERIC(5,2);
  ALTER TABLE orders ADD COLUMN IF NOT EXISTS driver_speed        NUMERIC(6,2);
  ALTER TABLE orders ADD COLUMN IF NOT EXISTS driver_location_at  TIMESTAMPTZ;

  -- Live-journey phase + running tracking stats.
  ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_phase VARCHAR(20)
    CHECK (tracking_phase IN ('preparing','picked','on_the_way','nearby','delivered'));
  ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_started_at            TIMESTAMPTZ;
  ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_delivered_at          TIMESTAMPTZ;
  ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_last_ping_at          TIMESTAMPTZ;
  ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_eta_minutes           INTEGER;
  ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_distance_remaining_km NUMERIC(6,2);

  -- Progress fraction (0..1) along the polyline, so completed vs remaining route
  -- can be split without recomputing on the client.
  ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_progress NUMERIC(5,4) DEFAULT 0;

  CREATE TABLE IF NOT EXISTS order_items (
    id          SERIAL PRIMARY KEY,
    order_id    INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id  INTEGER REFERENCES products(id) ON DELETE SET NULL,
    name        VARCHAR(160) NOT NULL,
    emoji       VARCHAR(16) DEFAULT '💊',
    image_url   TEXT,
    price       INTEGER NOT NULL,
    quantity    INTEGER NOT NULL CHECK (quantity > 0)
  );
  CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);

  -- Optional admin-supplied reason shown on the ORDER_REJECTED/ORDER_CANCELLED emails.
  ALTER TABLE orders ADD COLUMN IF NOT EXISTS status_reason TEXT;

  -- Delivery-handoff OTP: the customer is emailed the plaintext code once
  -- (never persisted in plain text — only its hash lives here); the delivery
  -- partner must enter it correctly to complete the delivery.
  ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_otp_hash       TEXT;
  ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_otp_expires_at TIMESTAMPTZ;
`;

// Idempotency + audit log for every transactional email the API sends. The
// partial unique index on (order_id, type) is what EmailService's
// `ON CONFLICT ... DO NOTHING` relies on to guarantee an order-lifecycle email
// is never sent twice for the same order.
const SQL_EMAIL_NOTIFICATIONS = `
  CREATE TABLE IF NOT EXISTS email_notifications (
    id                   SERIAL PRIMARY KEY,
    user_id              INTEGER REFERENCES users(id) ON DELETE SET NULL,
    order_id             INTEGER REFERENCES orders(id) ON DELETE CASCADE,
    type                 VARCHAR(30) NOT NULL CHECK (type IN (
                           'order_placed', 'order_accepted', 'order_rejected', 'order_cancelled',
                           'order_dispatched', 'out_for_delivery', 'order_delivered',
                           'password_reset', 'otp'
                         )),
    recipient            VARCHAR(255) NOT NULL,
    subject              VARCHAR(255) NOT NULL,
    status               VARCHAR(10) NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending', 'sending', 'sent', 'failed')),
    attempts             INTEGER NOT NULL DEFAULT 0,
    provider_message_id  TEXT,
    error                TEXT,
    sent_at              TIMESTAMPTZ,
    failed_at            TIMESTAMPTZ,
    created_at           TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at           TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  );
  CREATE UNIQUE INDEX IF NOT EXISTS uq_email_notifications_order_type
    ON email_notifications(order_id, type) WHERE order_id IS NOT NULL;
  CREATE INDEX IF NOT EXISTS idx_email_notifications_user ON email_notifications(user_id);
  CREATE INDEX IF NOT EXISTS idx_email_notifications_status ON email_notifications(status);
`;

// Serialises concurrent boots (e.g. two instances during a zero-downtime deploy).
const MIGRATION_LOCK_KEY = 7_311_2026;

export async function runMigrations(): Promise<void> {
  const client = await db.getClient();
  try {
    console.log('🔄 Running migrations...');
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock($1)', [MIGRATION_LOCK_KEY]);

    await client.query(SQL_UPDATED_AT_FN);
    await client.query(SQL_USERS);
    await client.query(SQL_CATEGORIES);
    await client.query(SQL_PRODUCTS);
    await client.query(SQL_OFFERS);
    await client.query(SQL_CONTENT);
    await client.query(SQL_COUPONS);
    await client.query(SQL_PETS);
    await client.query(SQL_WISHLIST);
    await client.query(SQL_CART);
    await client.query(SQL_NOTIFICATIONS);
    await client.query(SQL_SUPPORT_TICKETS);
    await client.query(SQL_SUPPORT_MESSAGES);
    await client.query(SQL_ORDERS);
    await client.query(SQL_COUPON_REDEMPTIONS);
    await client.query(SQL_EMAIL_NOTIFICATIONS);

    for (const t of [
      'users', 'categories', 'products', 'offers', 'coupons', 'pets',
      'cart_items', 'orders', 'support_tickets', 'health_tips', 'app_settings',
      'email_notifications',
    ]) {
      await client.query(updatedAtTrigger(t));
    }

    await client.query('COMMIT');
    console.log('✅ Migration complete — all tables ready.');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  runMigrations()
    .catch((err) => {
      console.error('❌ Migration failed:', err);
      process.exitCode = 1;
    })
    .finally(() => db.pool.end());
}
