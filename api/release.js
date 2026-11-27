// Vercel serverless function: release dates for a batch of movies, from TMDB (all countries).
// The site uses them to tell what's out: coming soon (not in cinemas anywhere yet), CAM (in cinemas,
// no digital release anywhere yet) or HD (out to rent, buy or stream somewhere).
//
// Client usage: GET /api/release?ids=27205,1003596
// Reply: { "27205": { "t": "2010-07-15", "p": "2010-07-08", "d": "2010-12-07" }, ... }
//   t = first cinema release (TMDB types 2 and 3), p = first premiere (type 1),
//   d = first digital, disc or TV release (types 4, 5 and 6). null = none listed.
// Only the dates are sent; the page decides "coming soon / CAM / HD" against today's date.

const TMDB = 'https://api.themoviedb.org/3';
const MAX_IDS = 40;
const TIMEOUT_MS = 8000;
// Kept in memory between calls on a warm server, so a popular movie is looked up once every few hours.
const TTL_MS = 6 * 60 * 60 * 1000;
const memo = new Map();

const firstOf = (list, types) => {
  let best = null;
  for (const c of list || []) {
    for (const r of (c && c.release_dates) || []) {
      if (!types.includes(r && r.type)) continue;
      const d = String(r.release_date || '').slice(0, 10);
      if (/^\d{4}-\d{2}-\d{2}$/.test(d) && (!best || d < best)) best = d;
    }
  }
  return best;
};

const lookup = async (id, key) => {
  const hit = memo.get(id);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.v;
  const res = await fetch(`${TMDB}/movie/${id}/release_dates?api_key=${key}`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (res.status === 404) return { t: null, p: null, d: null };
  if (!res.ok) throw new Error(`TMDB ${res.status}`);
  const data = await res.json();
  const list = data.results || [];
  const v = { t: firstOf(list, [2, 3]), p: firstOf(list, [1]), d: firstOf(list, [4, 5, 6]) };
  memo.set(id, { at: Date.now(), v });
  if (memo.size > 5000) memo.clear();
  return v;
};

export default async function handler(req, res) {
  const key = process.env.TMDB_API_KEY;
  if (!key) {
    res.setHeader('Cache-Control', 'no-store');
    res.status(500).json({ status_message: 'TMDB_API_KEY is not configured on the server.' });
    return;
  }
  const raw = String((req.query && req.query.ids) || '');
  const ids = [...new Set(raw.split(',').map((s) => s.trim()).filter((s) => /^\d{1,9}$/.test(s)))].slice(0, MAX_IDS);
  if (!ids.length) {
    res.setHeader('Cache-Control', 'no-store');
    res.status(400).json({ status_message: 'Pass ?ids= with one or more TMDB movie ids.' });
    return;
  }
  const out = {};
  let failed = false;
  await Promise.all(
    ids.map(async (id) => {
      try {
        out[id] = await lookup(id, key);
      } catch {
        out[id] = null;
        failed = true;
      }
    })
  );
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  // Dates change rarely; if TMDB failed for any of them, only keep the answer briefly.
  res.setHeader('Cache-Control', failed ? 'public, s-maxage=60' : 'public, s-maxage=21600, stale-while-revalidate=86400');
  res.status(200).json(out);
}
