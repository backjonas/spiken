import pg from 'pg'

export const pool = new pg.Pool()

await pool.query(
  `CREATE TABLE IF NOT EXISTS transactions(
    id SERIAL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    user_id INTEGER,
    user_name TEXT,
    description TEXT,
    amount_cents INTEGER
  );
  `
)
