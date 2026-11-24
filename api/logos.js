// Batch title-logo lookup for Netflix-style card artwork.
// GET /api/logos?ids=movie:603,tv:1399,...  ->  { "movie:603": { "p": "/logo.png", "r": 2.4 }, "tv:1399": null }
// One request per row instead of one per card; responses are cached at the edge for a day.

const TMDB_BASE = 'https://api.themoviedb.org/3';
const MAX_IDS = 40;

const pickLogo = (logos = []) => {
  const english = logos.filter((l) => l.iso_639_1 === 'en');
  const pool = english.length ? english : logos.filter((l) => !l.iso_639_1);
  if (!pool.length) return null;
  pool.sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0) || (b.width || 0) - (a.width || 0));
  const best = pool[0];
  return { p: best.file_path, r: Math.round((best.aspect_ratio || 0) * 100) / 100 };
};

export default async function handler(req, res) {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'TMDB_API_KEY is not configured on the server.' });
    return;
  }

  const raw = String((req.query && req.query.ids) || '');
  const ids = [...new Set(raw.split(',').filter((x) => /^(movie|tv):\d+$/.test(x)))].slice(0, MAX_IDS);
  if (!ids.length) {
    res.status(400).json({ error: 'No valid ids.' });
    return;
  }

  const out = {};
  await Promise.all(
    ids.map(async (key) => {
      const [type, id] = key.split(':');
      try {
        const r = await fetch(`${TMDB_BASE}/${type}/${id}/images?include_image_language=en,null&api_key=${apiKey}`);
        if (!r.ok) {
          out[key] = null;
          return;
        }
        const json = await r.json();
        out[key] = pickLogo(json.logos);
      } catch {
        out[key] = null;
      }
    })
  );

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
  res.status(200).json(out);
}
