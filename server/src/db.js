import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

export const pool = new Pool({
  host: process.env.DB_HOST || 'postgres',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  user: process.env.DB_USER || 'howami_user',
  password: process.env.DB_PASSWORD || 'howami_secure_pwd_2026',
  database: process.env.DB_NAME || 'howami_db',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('[DB] Unexpected error on idle client', err);
});

export async function query(text, params) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[DB] executed query: ${text.slice(0, 60)} | duration: ${duration}ms | rows: ${res.rowCount}`);
  }
  return res;
}

export async function waitForDb(maxRetries = 10, delayMs = 2000) {
  for (let i = 1; i <= maxRetries; i++) {
    try {
      await pool.query('SELECT 1');
      console.log('✅ [DB] Connected to PostgreSQL successfully!');
      return true;
    } catch (err) {
      console.log(`⏳ [DB] Waiting for database (attempt ${i}/${maxRetries}): ${err.message}`);
      if (i === maxRetries) throw err;
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}
