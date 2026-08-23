import { Pool, PoolConfig, PoolClient, QueryResult, QueryResultRow } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const rawConnectionString = process.env.DATABASE_URL;

// Aiven (and most managed Postgres) require SSL. `sslmode=require` in the URL,
// or DB_SSL=true, turns it on. rejectUnauthorized:false avoids needing the CA file.
const needsSsl =
  (!!rawConnectionString && /sslmode=(require|verify)/.test(rawConnectionString)) ||
  process.env.DB_SSL === 'true';

// Strip sslmode from the URL — we configure SSL explicitly below, which avoids
// pg treating sslmode=require as the stricter verify-full and warning about it.
let connectionString = rawConnectionString;
if (connectionString) {
  try {
    const u = new URL(connectionString);
    u.searchParams.delete('sslmode');
    connectionString = u.toString();
  } catch {
    /* leave as-is if it isn't a parseable URL */
  }
}

const config: PoolConfig = connectionString
  ? { connectionString }
  : {
      host: process.env.DB_HOST ?? 'localhost',
      port: Number(process.env.DB_PORT) || 5432,
      database: process.env.DB_NAME ?? 'medpet_db',
      user: process.env.DB_USER ?? 'postgres',
      password: process.env.DB_PASSWORD,
    };

config.max = 20;
config.idleTimeoutMillis = 30_000;
config.connectionTimeoutMillis = 10_000;
if (needsSsl) config.ssl = { rejectUnauthorized: false };

const pool = new Pool(config);

pool.on('error', (err: Error) => {
  console.error('Unexpected database pool error:', err);
  process.exit(-1);
});

const db = {
  query: <T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[]
  ): Promise<QueryResult<T>> => pool.query<T>(text, params),

  getClient: (): Promise<PoolClient> => pool.connect(),

  pool,
};

export default db;
