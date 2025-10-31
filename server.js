import express from 'express';
import pkg from 'pg';
const { Pool } = pkg;
const app = express();
// --- Config ---
const PORT = process.env.PORT || 3000;
const DATABASE_URL = process.env.DATABASE_URL || ''; // empty = in-memory fallback
app.use(express.json());
app.use(express.static('public'));
// --- In-memory fallback (if no DB yet) ---
let mem = { pageViews: 0, writes: 0 };
// --- Optional Postgres pool ---
let pool = null;
if (DATABASE_URL) {
  pool = new Pool({ connectionString: DATABASE_URL, ssl: sslOption(DATABASE_URL) });
  (async () => {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS pageviews(id SERIAL PRIMARY KEY, at TIMESTAMP DEFAULT NOW());
        CREATE TABLE IF NOT EXISTS writes(id SERIAL PRIMARY KEY, at TIMESTAMP DEFAULT NOW());
      `);
      console.log('DB ready');
    } catch (e) {
      console.error('DB init error:', e.message);
      pool = null; // fall back to memory if DB init fails
    }
  })();
}
function sslOption(cs) {
  // Some hosted Postgres providers require SSL
  return /amazonaws|render|railway|supabase|azure|gcp|neon|timescale|heroku/i.test(cs)
    ? { rejectUnauthorized: false }
    : undefined;
}
// --- Count a page view on homepage load ---
app.get('/', async (_req, _res, next) => {
  try {
    if (pool) await pool.query('INSERT INTO pageviews DEFAULT VALUES;');
    else mem.pageViews++;
  } catch {}
  next();
});
// --- Demo endpoints ---
// GET: simple dynamic read
app.get('/api/time', (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});
// POST: demo write (increments a counter)
app.post('/api/demo-write', async (_req, res) => {
  try {
    if (pool) {
      await pool.query('INSERT INTO writes DEFAULT VALUES;');
      const total = (await pool.query('SELECT COUNT(*)::int AS n FROM writes')).rows[0].n;
      return res.json({ ok: true, total });
    } else {
      mem.writes++;
      return res.json({ ok: true, total: mem.writes });
    }
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});
// Expose simple metrics (handy while filming)
app.get('/api/metrics', async (_req, res) => {
  try {
    if (pool) {
      const pv = (await pool.query('SELECT COUNT(*)::int AS n FROM pageviews')).rows[0].n;
      const wr = (await pool.query('SELECT COUNT(*)::int AS n FROM writes')).rows[0].n;
      res.json({ pageViews: pv, writes: wr, db: true });
    } else {
      res.json({ pageViews: mem.pageViews, writes: mem.writes, db: false });
    }
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});
app.listen(PORT, () => console.log(`Listening on ${PORT}`));










