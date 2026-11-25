// Batch title metadata for Netflix-style cards: title logo + IMDb rating.
// GET /api/logos?ids=movie:603,tv:1399
//   -> { "movie:603": { "p": "/logo.png", "r": 2.4, "b": "/titled-backdrop.jpg", "imdb": "tt0133093", "ir": 8.7, "iv": 2200000 }, ... }
// b = artwork with the title already printed on it (TMDB backdrops tagged English), used as card art.
//
// IMDb ratings come from IMDb's official daily dataset (title.ratings.tsv.gz),
// cached in memory on warm instances. Information courtesy of IMDb (https://www.imdb.com). Used with permission.

import { gunzipSync } from 'node:zlib';

const TMDB_BASE = 'https://api.themoviedb.org/3';
const RATINGS_URL = 'https://datasets.imdbws.com/title.ratings.tsv.gz';
const RATINGS_TTL_MS = 12 * 60 * 60 * 1000;
const MAX_IDS = 40;

let ratingsText = null;
let ratingsAt = 0;
let ratingsLoading = null;

const getRatings = async () => {
  if (ratingsText && Date.now() - ratingsAt < RATINGS_TTL_MS) return ratingsText;
  if (!ratingsLoading) {
    ratingsLoading = (async () => {
      const r = await fetch(RATINGS_URL);
      if (!r.ok) throw new Error(`IMDb dataset ${r.status}`);
      const buf = Buffer.from(await r.arrayBuffer());
      ratingsText = '\n' + gunzipSync(buf).toString('latin1');
      ratingsAt = Date.now();
      return ratingsText;
    })().finally(() => {
      ratingsLoading = null;
    });
  }
  return ratingsLoading;
};

const lookupRating = (text, imdbId) => {
  if (!text || !imdbId) return null;
  const i = text.indexOf(`\n${imdbId}\t`);
  if (i < 0) return null;
  const end = text.indexOf('\n', i + 1);
  const cols = text.slice(i + 1, end < 0 ? undefined : end).split('\t');
  const rating = Number(cols[1]);
  const votes = Number(cols[2]);
  return Number.isFinite(rating) ? { ir: rating, iv: Number.isFinite(votes) ? votes : null } : null;
};

const pickLogo = (logos = []) => {
  const english = logos.filter((l) => l.iso_639_1 === 'en');
  const pool = english.length ? english : logos.filter((l) => !l.iso_639_1);
  if (!pool.length) return { p: null, r: 0 };
  pool.sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0) || (b.width || 0) - (a.width || 0));
  const best = pool[0];
  return { p: best.file_path, r: Math.round((best.aspect_ratio || 0) * 100) / 100 };
};

// TMDB backdrops tagged with a language carry the title text (textless ones have no language).
const pickTitledBackdrop = (backdrops = []) => {
  const titled = backdrops.filter((b) => b.iso_639_1 === 'en' && (b.width || 0) >= 1280);
  if (!titled.length) return null;
  titled.sort((x, y) => (y.vote_average || 0) - (x.vote_average || 0) || (y.vote_count || 0) - (x.vote_count || 0));
  return titled[0].file_path;
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

  // Start loading IMDb ratings in parallel with the TMDB lookups.
  const ratingsPromise = getRatings().catch(() => null);

  const out = {};
  await Promise.all(
    ids.map(async (key) => {
      const [type, id] = key.split(':');
      try {
        const r = await fetch(
          `${TMDB_BASE}/${type}/${id}?append_to_response=images,external_ids&include_image_language=en,null&api_key=${apiKey}`
        );
        if (!r.ok) {
          out[key] = null;
          return;
        }
        const d = await r.json();
        out[key] = {
          ...pickLogo(d.images && d.images.logos),
          b: pickTitledBackdrop(d.images && d.images.backdrops),
          imdb: (d.external_ids && d.external_ids.imdb_id) || d.imdb_id || null,
        };
      } catch {
        out[key] = null;
      }
    })
  );

  const ratings = await ratingsPromise;
  for (const key of ids) {
    const entry = out[key];
    if (entry) Object.assign(entry, lookupRating(ratings, entry.imdb) || { ir: null, iv: null });
  }

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', ratings ? 'public, s-maxage=86400, stale-while-revalidate=604800' : 'public, s-maxage=600');
  res.status(200).json(out);
}
