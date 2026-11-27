// Vercel serverless function that proxies TMDB requests.
// The TMDB API key lives only on the server (Vercel env var TMDB_API_KEY),
// so it is never shipped to the browser or committed to the repo.
//
// Client usage: GET /api/tmdb?path=/movie/popular&page=1

const TMDB_BASE = 'https://api.themoviedb.org/3';

// Only allow the endpoints the app actually uses.
const ALLOWED_PATH =
  /^\/(search\/multi|search\/person|person\/\d+(\/(combined_credits|images|external_ids))?|trending\/(all|movie|tv)\/(day|week)|discover\/(movie|tv)|genre\/(movie|tv)\/list|collection\/\d+|company\/\d+|network\/\d+|movie\/(popular|top_rated|upcoming|now_playing|\d+(\/(images|recommendations|similar|videos|credits|release_dates))?)|tv\/(popular|top_rated|on_the_air|airing_today|\d+(\/(images|recommendations|similar|videos|credits|aggregate_credits|content_ratings)|\/season\/\d+)?))$/;

// Only these query parameters are passed on to TMDB (anything else is dropped), so the endpoint
// can't be used to send arbitrary requests on our key or to bust the cache with junk parameters.
const ALLOWED_PARAM =
  /^(page|query|language|region|year|timezone|include_adult|include_image_language|include_video_language|append_to_response|sort_by|watch_region|primary_release_year|first_air_date_year|certification|certification_country|(with|without)_[a-z_]+|(primary_release_date|first_air_date|release_date|air_date|vote_count|vote_average|with_runtime|certification)\.(gte|lte))$/;
const MAX_PARAMS = 20;
const MAX_VALUE_LENGTH = 300;
// The title window asks for 6 extras (credits, recommendations, similar, videos, images, ratings) in one call;
// TMDB itself allows up to 20.
const MAX_APPEND = 8;
const TIMEOUT_MS = 10000;

const noStore = (res) => res.setHeader('Cache-Control', 'no-store');

export default async function handler(req, res) {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) {
    noStore(res);
    res.status(500).json({ status_message: 'TMDB_API_KEY is not configured on the server.' });
    return;
  }

  const { path, ...rest } = req.query || {};
  const tmdbPath = Array.isArray(path) ? path[0] : path;

  if (typeof tmdbPath !== 'string' || !ALLOWED_PATH.test(tmdbPath)) {
    noStore(res);
    res.status(400).json({ status_message: 'Invalid TMDB path.' });
    return;
  }

  const url = new URL(TMDB_BASE + tmdbPath);
  let count = 0;
  for (const [key, raw] of Object.entries(rest)) {
    if (!ALLOWED_PARAM.test(key) || ++count > MAX_PARAMS) continue;
    let value = String(Array.isArray(raw) ? raw[0] : raw).slice(0, MAX_VALUE_LENGTH);
    if (key === 'append_to_response') value = value.split(',').slice(0, MAX_APPEND).join(',');
    url.searchParams.set(key, value);
  }
  url.searchParams.set('api_key', apiKey);

  try {
    const upstream = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    const body = await upstream.text();
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    if (upstream.ok) {
      res.setHeader(
        'Cache-Control',
        tmdbPath.startsWith('/search')
          ? 'public, s-maxage=300, stale-while-revalidate=600'
          : 'public, s-maxage=3600, stale-while-revalidate=86400'
      );
    } else {
      // Don't let Vercel's CDN keep TMDB errors (rate limits, outages) for everyone.
      noStore(res);
    }
    res.status(upstream.status).send(body);
  } catch {
    noStore(res);
    res.status(502).json({ status_message: 'Could not reach TMDB. Please try again.' });
  }
}
