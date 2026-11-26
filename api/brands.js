// Brand artwork for Netflix-style logo rows.
//   /api/brands?kind=companies&ids=420,3       -> { "420": { name, logo }, ... }
//   /api/brands?kind=collections&ids=1241,10   -> { "1241": { name, overview, poster, backdrop, count }, ... }
//   /api/brands?kind=providers&region=US       -> { region, providers: [{ id, name, logo }] }  (streaming services in that region)

const TMDB = 'https://api.themoviedb.org/3';
const MAX_IDS = 50;
// Rent/buy stores and add-on "channels" are not streaming services.
const SKIP_IDS = new Set([2, 3, 7, 10, 35, 68, 175, 192, 279, 1796]);
const SKIP_NAME = /justwatch|channel|with ads|amazon video|google play|microsoft store|fandango|vudu|redbox/i;

const getJSON = async (url) => {
  const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(String(r.status));
  return r.json();
};

export default async function handler(req, res) {
  const key = process.env.TMDB_API_KEY;
  if (!key) {
    res.setHeader('Cache-Control', 'no-store');
    res.status(500).json({ error: 'TMDB_API_KEY is not configured on the server.' });
    return;
  }
  const q = req.query || {};
  const kind = String(q.kind || '');
  // A complete answer is cached for a week. If any lookup failed, only for 5 minutes,
  // so a short TMDB hiccup doesn't leave studios or services without a logo all week.
  const send = (body, complete = true) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', complete ? 'public, s-maxage=604800, stale-while-revalidate=2592000' : 'public, s-maxage=300');
    res.status(200).json(body);
  };

  try {
    if (kind === 'companies' || kind === 'collections') {
      const ids = [...new Set(String(q.ids || '').split(',').filter((x) => /^\d+$/.test(x)))].slice(0, MAX_IDS);
      const out = {};
      await Promise.all(
        ids.map(async (id) => {
          try {
            const d = await getJSON(`${TMDB}/${kind === 'companies' ? 'company' : 'collection'}/${id}?api_key=${key}`);
            out[id] =
              kind === 'companies'
                ? { name: d.name, logo: d.logo_path || null }
                : { name: d.name, overview: d.overview || '', poster: d.poster_path || null, backdrop: d.backdrop_path || null, count: (d.parts || []).length };
          } catch {
            out[id] = null;
          }
        })
      );
      send(out, ids.every((id) => out[id]));
      return;
    }

    if (kind === 'providers') {
      const region = /^[A-Z]{2}$/.test(String(q.region || '')) ? String(q.region) : 'US';
      let failed = false;
      const lists = await Promise.all(
        ['movie', 'tv'].map((t) =>
          getJSON(`${TMDB}/watch/providers/${t}?watch_region=${region}&api_key=${key}`).catch(() => {
            failed = true;
            return { results: [] };
          })
        )
      );
      const map = new Map();
      for (const p of lists.flatMap((l) => l.results || [])) {
        if (SKIP_IDS.has(p.provider_id) || SKIP_NAME.test(p.provider_name || '')) continue;
        const priority = (p.display_priorities && p.display_priorities[region]) ?? p.display_priority ?? 999;
        const existing = map.get(p.provider_id);
        if (!existing || priority < existing.priority) map.set(p.provider_id, { id: p.provider_id, name: p.provider_name, logo: p.logo_path || null, priority });
      }
      const providers = [...map.values()]
        .sort((a, b) => a.priority - b.priority)
        .slice(0, 24)
        .map(({ priority, ...rest }) => rest);
      send({ region, providers }, !failed);
      return;
    }

    res.setHeader('Cache-Control', 'no-store');
    res.status(400).json({ error: 'Unknown kind' });
  } catch {
    res.setHeader('Cache-Control', 'no-store');
    res.status(502).json({ error: 'Could not reach TMDB.' });
  }
}
