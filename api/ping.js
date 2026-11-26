// Keep-awake heartbeat: touches the database so the Supabase project never pauses for inactivity.
//   GET /api/ping?source=github  -> 200 { ok: true, db: true, at }   (503 { ok: false } if the database didn't answer)
// Called by .github/workflows/keep-awake.yml. Writes one row per source in public.heartbeat with the
// service-role key (the table has RLS on and no policies, so nobody else can touch it).

const TIMEOUT_MS = 10000;
// Known callers; anything else is recorded as "other" (so the endpoint can't be used to add rows).
const SOURCES = new Set(['site', 'github', 'cron', 'uptime', 'manual']);

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    res.status(405).json({ ok: false });
    return;
  }

  const base = String(process.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '');
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!/^https:\/\//.test(base) || !secret) {
    res.status(503).json({ ok: false });
    return;
  }

  const raw = req.query && req.query.source;
  const requested = String(Array.isArray(raw) ? raw[0] : raw || 'site').toLowerCase();
  const source = SOURCES.has(requested) ? requested : 'other';
  const at = new Date().toISOString();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(`${base}/rest/v1/heartbeat?on_conflict=source`, {
      method: 'POST',
      headers: {
        apikey: secret,
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify([{ source, seen_at: at }]),
      signal: controller.signal,
    });
    if (!r.ok) throw new Error(String(r.status));
    res.status(200).json({ ok: true, db: true, at });
  } catch {
    res.status(503).json({ ok: false });
  } finally {
    clearTimeout(timer);
  }
}
