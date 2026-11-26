import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, recoveryLinkOpened } from '../services/supabase';
import { startCloudSync, stopCloudSync, flushCloudSync, getSyncStatus, subscribeSyncStatus } from '../services/cloudSync';
import type { SyncStatus } from '../services/cloudSync';
import { navigate } from '../utils/router';

/**
 * Accounts (Supabase Auth). Everything here is optional: when the Supabase settings are missing,
 * `enabled` is false, nobody is signed in and the account UI hides itself.
 * Signing in starts cloud sync (services/cloudSync.ts); signing out stops it and keeps this
 * browser's data.
 */

export interface Profile {
  username: string;
  display_name: string | null;
}

export interface SignUpResult {
  /** true when Supabase asks the user to confirm their email before the first sign-in */
  confirmEmail: boolean;
}

interface AuthState {
  enabled: boolean;
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  /** opened from a password-reset email (Supabase fired PASSWORD_RECOVERY) */
  recovery: boolean;
  signIn: (identifier: string, password: string) => Promise<void>;
  signUp: (username: string, email: string, password: string) => Promise<SignUpResult>;
  signOut: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
  /** true / false, or null when it couldn't be checked (offline) */
  isUsernameAvailable: (username: string) => Promise<boolean | null>;
}

export const USERNAME_RE = /^[A-Za-z0-9_.]{3,20}$/;
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const SIGN_IN_FAILED = 'Incorrect username/email or password.';

const NOT_AVAILABLE = 'Accounts are not available right now.';

const AuthContext = createContext<AuthState | undefined>(undefined);

const requireClient = () => {
  if (!supabase) throw new Error(NOT_AVAILABLE);
  return supabase;
};

/** Username saved at sign-up (until the profile row has loaded). */
const profileFromUser = (u: User): Profile | null => {
  const meta = (u.user_metadata || {}) as Record<string, unknown>;
  const username = typeof meta.username === 'string' ? meta.username : '';
  if (!username) return null;
  return { username, display_name: typeof meta.display_name === 'string' ? meta.display_name : null };
};

const signUpError = (message: string): string => {
  const m = message.toLowerCase();
  if (m.includes('already registered') || m.includes('already exists')) return 'An account with this email already exists. Sign in instead.';
  // The profile trigger rejects a taken (or invalid) username, which fails the whole sign-up.
  if (m.includes('database error')) return 'That username is taken. Please choose another one.';
  if (m.includes('rate limit') || m.includes('too many')) return 'Too many attempts. Please wait a minute and try again.';
  if (m.includes('invalid') && m.includes('email')) return 'Please enter a valid email address.';
  return message || "We couldn't create your account. Please try again.";
};

const passwordError = (message: string): string => {
  const m = message.toLowerCase();
  if (m.includes('different from the old')) return 'Your new password must be different from your current one.';
  if (m.includes('session') || m.includes('jwt') || m.includes('expired')) return 'This reset link has expired. Please request a new one.';
  return message || "We couldn't change your password. Please try again.";
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const enabled = supabase !== null;
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [recovery, setRecovery] = useState(recoveryLinkOpened);
  const [profile, setProfile] = useState<Profile | null>(null);
  const user = session?.user ?? null;
  const userId = user?.id ?? null;

  // Session: restored from this browser, refreshed automatically, and updated on every auth event.
  useEffect(() => {
    const sb = supabase;
    if (!sb) return;
    let alive = true;
    // A reset link that landed elsewhere (e.g. the Site URL) still goes to the new-password form.
    const toResetForm = () => {
      if (window.location.pathname !== '/reset-password') navigate('/reset-password', { replace: true });
    };
    sb.auth
      .getSession() // waits until the client has read (and cleared) any link in the address bar
      .then(({ data }) => {
        if (!alive) return;
        setSession(data.session);
        setLoading(false);
        if (recoveryLinkOpened && data.session) toResetForm();
      })
      .catch(() => {
        if (alive) setLoading(false);
      });
    const { data } = sb.auth.onAuthStateChange((event, next) => {
      if (!alive) return;
      if (event === 'PASSWORD_RECOVERY') {
        setRecovery(true);
        toResetForm();
      }
      if (event === 'SIGNED_OUT') setRecovery(false);
      setSession(next);
      setLoading(false);
    });
    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, []);

  // Profile (username) of the signed-in user.
  useEffect(() => {
    const sb = supabase;
    const u = user;
    if (!sb || !u) {
      setProfile(null);
      return;
    }
    let alive = true;
    setProfile(profileFromUser(u));
    const load = async () => {
      try {
        const { data, error } = await sb.from('profiles').select('username, display_name').eq('id', u.id).maybeSingle();
        const row = data as unknown as { username?: unknown; display_name?: unknown } | null;
        if (!alive || error || !row || typeof row.username !== 'string') return;
        setProfile({ username: row.username, display_name: typeof row.display_name === 'string' ? row.display_name : null });
      } catch {
        /* keep the name from sign-up */
      }
    };
    void load();
    return () => {
      alive = false;
    };
    // Only when the signed-in user changes (not on every token refresh).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Cloud sync runs while someone is signed in.
  useEffect(() => {
    if (!userId) return;
    startCloudSync(userId);
    return () => stopCloudSync();
  }, [userId]);

  const signIn = useCallback(async (identifier: string, password: string) => {
    const sb = requireClient();
    let res: Response;
    try {
      // Usernames are turned into the account's email on the server, so emails are never exposed.
      res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: identifier.trim(), password }),
        signal: AbortSignal.timeout(20000),
      });
    } catch {
      throw new Error("We couldn't reach StreamFast. Check your connection and try again.");
    }
    const body = (await res.json().catch(() => null)) as { access_token?: unknown; refresh_token?: unknown; error?: unknown } | null;
    const access = body?.access_token;
    const refresh = body?.refresh_token;
    if (!res.ok || typeof access !== 'string' || typeof refresh !== 'string') {
      const message = body?.error;
      throw new Error(typeof message === 'string' && message ? message : SIGN_IN_FAILED);
    }
    const { error } = await sb.auth.setSession({ access_token: access, refresh_token: refresh });
    if (error) throw new Error("We couldn't sign you in. Please try again.");
  }, []);

  const signUp = useCallback(async (username: string, email: string, password: string): Promise<SignUpResult> => {
    const sb = requireClient();
    const name = username.trim();
    const { data, error } = await sb.auth.signUp({
      email: email.trim(),
      password,
      // The database creates the profile from these (and rejects a taken username).
      options: { data: { username: name, display_name: name } },
    });
    if (error) throw new Error(signUpError(error.message));
    return { confirmEmail: !data.session };
  }, []);

  const signOut = useCallback(async () => {
    const sb = requireClient();
    const uid = userId;
    // Upload anything still waiting first (but don't hang on a bad connection).
    await Promise.race([flushCloudSync().catch(() => undefined), new Promise<void>((resolve) => window.setTimeout(resolve, 4000))]);
    stopCloudSync();
    // 'local': only this browser signs out (other devices stay signed in). This browser's data stays.
    const { error } = await sb.auth.signOut({ scope: 'local' });
    if (error) {
      if (uid) startCloudSync(uid);
      throw new Error("We couldn't sign you out. Check your connection and try again.");
    }
  }, [userId]);

  const sendPasswordReset = useCallback(async (email: string) => {
    const sb = requireClient();
    const { error } = await sb.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/reset-password` });
    // The page always shows the same neutral message, whether or not the account exists.
    if (error) console.warn('[StreamFast] Password reset request failed:', error.message);
  }, []);

  const updatePassword = useCallback(async (newPassword: string) => {
    const sb = requireClient();
    const { error } = await sb.auth.updateUser({ password: newPassword });
    if (error) throw new Error(passwordError(error.message));
    setRecovery(false);
  }, []);

  const isUsernameAvailable = useCallback(async (username: string): Promise<boolean | null> => {
    const sb = supabase;
    if (!sb) return null;
    try {
      const { data, error } = await sb.rpc('username_available', { u: username.trim() });
      if (error) return null;
      const ok = data as unknown;
      return typeof ok === 'boolean' ? ok : null;
    } catch {
      return null;
    }
  }, []);

  const value = useMemo<AuthState>(
    () => ({ enabled, session, user, profile, loading, recovery, signIn, signUp, signOut, sendPasswordReset, updatePassword, isUsernameAvailable }),
    [enabled, session, user, profile, loading, recovery, signIn, signUp, signOut, sendPasswordReset, updatePassword, isUsernameAvailable]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthState => {
  const ctx = useContext(AuthContext);
  if (ctx === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};

/** Cloud sync state for the profile menu ("Synced", "Syncing…"). */
export const useSyncStatus = (): SyncStatus => useSyncExternalStore(subscribeSyncStatus, getSyncStatus);
