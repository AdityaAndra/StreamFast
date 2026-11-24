// Vercel serverless function that proxies TMDB requests.
// The TMDB API key lives only on the server (Vercel env var TMDB_API_KEY),
// so it is never shipped to the browser or committed to the repo.
//
// Client usage: GET /api/tmdb?path=/movie/popular&page=1

const TMDB_BASE = 'https://api.themoviedb.org/3';

// Only allow the endpoints the app actually uses.
const ALLOWED_PATH =
  /^\/(search\/multi|search\/person|person\/\d+(\/(combined_credits|images|external_ids))?|trending\/(all|movie|tv)\/(day|week)|discover\/(movie|tv)|genre\/(movie|tv)\/list|collection\/\d+|company\/\d+|network\/\d+|movie\/(popular|top_rated|upcoming|now_playing|\d+(\/(images|recommendations|similar|videos|credits|release_dates))?)|tv\/(popular|top_rated|on_the_air|airing_today|\d+(\/(images|recommendations|similar|videos|credits|aggregate_credits|content_ratings)|\/season\/\d+)?))$/;

export default async function handler(req, res) {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) {
    res.status(500).json({ status_message: 'TMDB_API_KEY is not configured on the server.' });
    return;
  }

  const { path, ...rest } = req.query || {};
  const tmdbPath = Array.isArray(path) ? path[0] : path;

  if (typeof tmdbPath !== 'string' || !ALLOWED_PATH.test(tmdbPath)) {
    res.status(400).json({ status_message: 'Invalid TMDB path.' });
    return;
  }

  const url = new URL(TMDB_BASE + tmdbPath);
  for (const [key, value] of Object.entries(rest)) {
    if (key === 'api_key') continue;
    url.searchParams.set(key, Array.isArray(value) ? String(value[0]) : String(value));
  }
  url.searchParams.set('api_key', apiKey);

  try {
    const upstream = await fetch(url);
    const body = await upstream.text();
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    if (upstream.ok) {
      res.setHeader(
        'Cache-Control',
        tmdbPath.startsWith('/search')
          ? 'public, s-maxage=300, stale-while-revalidate=600'
          : 'public, s-maxage=3600, stale-while-revalidate=86400'
      );
    }
    res.status(upstream.status).send(body);
  } catch (err) {
    res.status(502).json({ status_message: 'Could not reach TMDB. Please try again.' });
  }
}
