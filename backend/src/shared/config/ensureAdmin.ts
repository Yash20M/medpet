import bcrypt from 'bcryptjs';
import db from './database';

export async function ensureAdminExists(): Promise<void> {
  try {
    const { rows } = await db.query<{ id: number }>(
      `SELECT id FROM users WHERE role = 'admin' LIMIT 1`
    );

    if (rows.length > 0) {
      console.log('✅ Admin user already exists.');
      return;
    }

    const name = process.env.ADMIN_NAME ?? 'MedPet Admin';
    const email = (process.env.ADMIN_EMAIL ?? 'admin@medpet.com').toLowerCase();
    const password = process.env.ADMIN_PASSWORD ?? 'admin123';
    const hash = await bcrypt.hash(password, 12);

    await db.query(
      `INSERT INTO users (name, email, password, role)
       VALUES ($1, $2, $3, 'admin')
       ON CONFLICT (email) DO UPDATE SET role = 'admin'`,
      [name, email, hash]
    );

    const isProd = process.env.NODE_ENV === 'production';
    console.log(`👤 No admin found — created default admin: ${email}${isProd ? '' : ` / ${password}`}`);
    if (isProd && !process.env.ADMIN_PASSWORD) {
      console.warn('⚠️  ADMIN_PASSWORD is not set — the admin is using the default password. Set it and change it now.');
    }
  } catch (err) {
    console.error(
      '⚠️  Could not verify/create admin user (did you run "npm run migrate"?):',
      (err as Error).message
    );
  }
}
