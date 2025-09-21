import pkg from 'pg';
import 'dotenv/config';
const { Pool } = pkg;

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function q(text, params) {
  return pool.query(text, params);
}
