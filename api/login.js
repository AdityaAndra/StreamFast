// Sign in with a username OR an email, without ever sending an email address to the browser.
//   POST /api/login  { "identifier": "neo" | "neo@example.com", "password": "…" }
//   200 { access_token, refresh_token }   -> the client calls supabase.auth.setSession(...)
//   401 { error: 'Incorrect username/email or password.' }  (same answer for unknown user and wrong password)
//
// A username is looked up with the service-role key (SUPABASE_SECRET_KEY, server only) to find the
// account's email; the password check itself is Supabase's normal password sign-in with the public key.

const TIMEOUT_MS = 10000;
const FAIL = 'Incorrect username/email or password.';
const USERNAME = /^[A-Za-z0-9_.]{3,20}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Failures take at least this long, so response time doesn't reveal whether a username exists.
const MIN_FAIL_MS = 700;

class Unreachable extends Error {}
class RateLimited extends Error {}

const noStore = (res) => res.setHeader('Cache-Control', 'no-store');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** fetch with a 10s timeout (AbortController). Network errors / timeouts become Unreachable. */
const request = async (url, options) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch {
    throw new Unreachable();
  } finally {
    clearTimeout(timer);
  }
};

const readJSON = async (r) => {
  try {
    return await r.json();
  } catch {
    return null;
  }
};

const readBody = (req) => {
  let body;
  try {
    body = req.body; // Vercel parses JSON bodies (and throws on malformed JSON)
  } catch {
    return null;
  }
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      return null;
    }
  }
  return body && typeof body === 'object' && !Array.isArray(body) ? body : null;
};

/** Username -> the account's email (or null). Uses the service role; nothing is returned to the client. */
const emailForUsername = async (base, secret, username) => {
  const headers = { apikey: secret, Authorization: `Bearer ${secret}`, Accept: 'application/json' };
  // username is citext, so eq is case-insensitive.
  const r = await request(`${base}/rest/v1/profiles?select=id&username=eq.${encodeURIComponent(username)}&limit=1`, { headers });
  if (r.status >= 500) throw new Unreachable();
  if (!r.ok) return null;
  const rows = await readJSON(r);
  const id = Array.isArray(rows) && rows[0] && typeof rows[0].id === 'string' ? rows[0].id : '';
  if (!UUID.test(id)) return null;
  const u = await request(`${base}/auth/v1/admin/users/${id}`, { headers });
  if (u.status >= 500) throw new Unreachable();
  if (!u.ok) return null;
  const user = await readJSON(u);
  return user && typeof user.email === 'string' && user.email ? user.email : null;
};

/** Supabase password sign-in with the public key. Returns the tokens, or null for bad credentials. */
const passwordGrant = async (base, publishable, email, password) => {
  const r = await request(`${base}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: publishable, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (r.status === 429) throw new RateLimited();
  if (r.status >= 500) throw new Unreachable();
  if (!r.ok) return null;
  const d = await readJSON(r);
  return d && typeof d.access_token === 'string' && typeof d.refresh_token === 'string'
    ? { access_token: d.access_token, refresh_token: d.refresh_token }
    : null;
};

export default async function handler(req, res) {
  noStore(res);
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  const base = String(process.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '');
  const publishable = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!/^https:\/\//.test(base) || !publishable || !secret) {
    res.status(500).json({ error: 'Sign-in is not configured on the server.' });
    return;
  }

  const started = Date.now();
  const fail = async () => {
    await sleep(Math.max(0, MIN_FAIL_MS - (Date.now() - started)) + Math.floor(Math.random() * 150));
    res.status(401).json({ error: FAIL });
  };

  const body = readBody(req);
  const identifier = body && typeof body.identifier === 'string' ? body.identifier.trim() : '';
  const password = body && typeof body.password === 'string' ? body.password : '';
  if (!identifier || identifier.length > 254 || !password || password.length > 200) {
    await fail();
    return;
  }

  try {
    let email = null;
    if (identifier.includes('@')) {
      email = EMAIL.test(identifier) ? identifier : null;
    } else if (USERNAME.test(identifier)) {
      email = await emailForUsername(base, secret, identifier);
    }
    const tokens = email ? await passwordGrant(base, publishable, email, password) : null;
    if (!tokens) {
      await fail();
      return;
    }
    res.status(200).json(tokens);
  } catch (err) {
    // Never log the identifier, password, tokens or keys.
    if (err instanceof RateLimited) {
      res.status(429).json({ error: 'Too many sign-in attempts. Please wait a minute and try again.' });
    } else if (err instanceof Unreachable) {
      res.status(502).json({ error: "We couldn't reach the sign-in service. Please try again." });
    } else {
      await fail();
    }
  }
}
