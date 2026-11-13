// The site is static files. This script only answers /api/stats; every other path is served
// straight from the files (run_worker_first in wrangler.jsonc), so it never touches normal page loads.
//
// GET  /api/stats  public: platform totals and the last 7 days of views for The Collective chart.
// POST /api/stats  private: The Collective's HQ app sends fresh numbers, with the STATS_KEY secret.
// The stored summary holds numbers only. No handles, account ids, links or platform tokens ever reach here.

const PLATFORMS = ['tiktok', 'youtube', 'instagram'];
const KEY = 'collective';
const MAX_BODY = 8 * 1024;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== '/api/stats') return env.ASSETS.fetch(request);
    if (!env.STATS) return json({ error: 'not set up' }, 503);
    if (request.method === 'GET' || request.method === 'HEAD') {
      const data = await env.STATS.get(KEY, 'json');
      if (!data) return json({ error: 'no data yet' }, 404, 'no-store');
      return json(data, 200, 'public, max-age=120');
    }
    if (request.method === 'POST') {
      if (!env.STATS_KEY || !(await sameSecret(request.headers.get('authorization') || '', 'Bearer ' + String(env.STATS_KEY).trim()))) {
        return json({ error: 'unauthorized' }, 401, 'no-store');
      }
      const text = await request.text();
      if (text.length > MAX_BODY) return json({ error: 'too large' }, 413, 'no-store');
      let clean;
      try { clean = sanitize(JSON.parse(text)); } catch { clean = null; }
      if (!clean) return json({ error: 'bad summary' }, 400, 'no-store');
      await env.STATS.put(KEY, JSON.stringify(clean));
      return json({ ok: true, updated: clean.updated }, 200, 'no-store');
    }
    return json({ error: 'method not allowed' }, 405, 'no-store');
  },
};

// Keeps only the fields the chart uses, as plain numbers, whatever else was sent.
function sanitize(d) {
  if (!d || typeof d !== 'object') return null;
  const n = (x) => (typeof x === 'number' && Number.isFinite(x) && x >= 0 && x < 1e12 ? Math.round(x) : null);
  const seven = (a, f) => (Array.isArray(a) && a.length === 7 && a.every((x) => f(x) !== null) ? a.map(f) : null);
  const day = (s) => (typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null);
  const days = seven(d.days, day);
  const updated = typeof d.updated === 'string' && !Number.isNaN(Date.parse(d.updated)) ? new Date(d.updated).toISOString() : null;
  if (!days || !updated || !d.platforms) return null;
  const platforms = {};
  for (const p of PLATFORMS) {
    const s = d.platforms[p];
    if (!s) return null;
    const total = n(s.total), daily = seven(s.daily, n), cum = seven(s.cum, n);
    if (total === null || !daily || !cum) return null;
    platforms[p] = { total, daily, cum };
  }
  const out = { v: 1, updated, days, platforms };
  if (d.reach && typeof d.reach === 'object') {
    const followers = n(d.reach.followers), views = n(d.reach.views);
    if (followers !== null || views !== null) out.reach = { followers, views };
  }
  return out;
}

async function sameSecret(a, b) {
  const enc = new TextEncoder();
  const [x, y] = await Promise.all([crypto.subtle.digest('SHA-256', enc.encode(a)), crypto.subtle.digest('SHA-256', enc.encode(b))]);
  const u = new Uint8Array(x), v = new Uint8Array(y);
  let diff = 0;
  for (let i = 0; i < u.length; i++) diff |= u[i] ^ v[i];
  return diff === 0;
}

function json(body, status, cache = 'no-store') {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': cache, 'x-content-type-options': 'nosniff' },
  });
}
