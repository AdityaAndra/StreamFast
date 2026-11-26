import { createClient } from '@supabase/supabase-js';

/**
 * Browser Supabase client for accounts + cloud sync.
 * Built from the public VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY (set in Vercel, or in .env.local).
 * If either is missing (or invalid) this is null, and every account feature hides itself:
 * the site then works exactly as before, saving only in this browser.
 */
const url = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const key = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '').trim();

// Password-reset links land on /reset-password#access_token=…&type=recovery (or #error=… when the
// link has expired). Read that before the client consumes the address-bar hash.
const readAuthLink = (): { recovery: boolean; error: string | null } => {
  try {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const query = new URLSearchParams(window.location.search);
    const recovery = hash.get('type') === 'recovery';
    const hasError = !!(hash.get('error') || hash.get('error_code') || (query.get('error') && query.get('error_description')));
    const error = hasError ? hash.get('error_description') || query.get('error_description') || 'This link is invalid or has expired.' : null;
    return { recovery, error };
  } catch {
    return { recovery: false, error: null };
  }
};

const authLink = readAuthLink();
/** The page was opened from a password-reset email. */
export const recoveryLinkOpened = authLink.recovery;
/** The email link was rejected by Supabase (usually expired or already used). */
export const authLinkError = authLink.error;

const create = () => {
  try {
    return createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        // Needed for password-recovery links (the session arrives in the address bar).
        detectSessionInUrl: true,
      },
    });
  } catch (err) {
    console.warn('[StreamFast] Accounts are off: could not start Supabase.', err);
    return null;
  }
};

export const supabase = url && key ? create() : null;
export const accountsEnabled = supabase !== null;
