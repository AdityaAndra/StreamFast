import { useEffect, useState, useSyncExternalStore } from 'react';
import { notifyLocalDataChange, onRemoteDataApplied } from '../services/storage';

/**
 * Trailer previews (Netflix-style): the billboard, the hover card and the title window play the
 * title's trailer, muted, after the picture has been up for a moment.
 *
 *  - "Autoplay previews" setting (on by default), saved in localStorage as '1' / '0'. It is synced to
 *    signed-in devices with the notifications settings (services/cloudSync.ts) and applies straight
 *    away everywhere: this tab, other tabs (storage event) and after a cloud sync.
 *  - Sound: previews always start muted; unmuting one keeps the sound on for the next ones (this visit).
 *  - Holds: whatever is on top pauses the previews underneath it. A preview at a level pauses while
 *    anything holds that level or higher:
 *      billboard (1)  paused by a hover card's trailer, the title window and dialogs
 *      page (2)       hover cards: paused by the title window and dialogs
 *      window (3)     the title window's hero: paused only by dialogs over it (trailer, Get Link, theme)
 */

export const AUTOPLAY_PREVIEWS_KEY = 'sf_autoplay_previews';
/** Fired on window whenever the setting changes in this tab (detail: boolean). */
export const AUTOPLAY_PREVIEWS_EVENT = 'sf:autoplay-previews';

const readAutoplay = (): boolean => {
  try {
    return localStorage.getItem(AUTOPLAY_PREVIEWS_KEY) !== '0';
  } catch {
    return true;
  }
};

let autoplay = readAutoplay();
const autoplayListeners = new Set<() => void>();
const emitAutoplay = () => autoplayListeners.forEach((l) => l());

const refreshAutoplay = () => {
  const v = readAutoplay();
  if (v === autoplay) return;
  autoplay = v;
  emitAutoplay();
};

if (typeof window !== 'undefined') {
  // Another tab changed it (or "Reset site data" cleared it).
  window.addEventListener('storage', (e) => {
    if (e.key === AUTOPLAY_PREVIEWS_KEY || e.key === null) refreshAutoplay();
  });
  window.addEventListener(AUTOPLAY_PREVIEWS_EVENT, refreshAutoplay);
  // Signed in on another device: cloud sync brought the setting.
  onRemoteDataApplied((keys) => {
    if (keys.includes('notifications')) refreshAutoplay();
  });
}

export const getAutoplayPreviews = (): boolean => autoplay;

export const setAutoplayPreviews = (on: boolean): void => {
  try {
    localStorage.setItem(AUTOPLAY_PREVIEWS_KEY, on ? '1' : '0');
    notifyLocalDataChange('notifications');
  } catch {
    /* storage full or blocked: still applies for this visit */
  }
  if (autoplay !== on) {
    autoplay = on;
    emitAutoplay();
  }
  try {
    window.dispatchEvent(new CustomEvent<boolean>(AUTOPLAY_PREVIEWS_EVENT, { detail: on }));
  } catch {
    /* ignore */
  }
};

const subscribeAutoplay = (cb: () => void) => {
  autoplayListeners.add(cb);
  return () => {
    autoplayListeners.delete(cb);
  };
};

/** [autoplay on?, set it] — re-renders when the setting changes anywhere. */
export const useAutoplayPreviews = (): [boolean, (on: boolean) => void] => [
  useSyncExternalStore(subscribeAutoplay, getAutoplayPreviews, () => true),
  setAutoplayPreviews,
];

/* ---------- sound ---------- */

let muted = true;
const mutedListeners = new Set<() => void>();
const subscribeMuted = (cb: () => void) => {
  mutedListeners.add(cb);
  return () => {
    mutedListeners.delete(cb);
  };
};
export const setPreviewMuted = (m: boolean): void => {
  if (m === muted) return;
  muted = m;
  mutedListeners.forEach((l) => l());
};
export const usePreviewMuted = (): [boolean, (m: boolean) => void] => [
  useSyncExternalStore(subscribeMuted, () => muted, () => true),
  setPreviewMuted,
];

/* ---------- holds (something open on top) ---------- */

export const PREVIEW_LEVEL = { billboard: 1, page: 2, window: 3 } as const;

const holds = new Map<number, number>();
let holdSeq = 0;
const holdListeners = new Set<() => void>();
const emitHolds = () => holdListeners.forEach((l) => l());
const subscribeHolds = (cb: () => void) => {
  holdListeners.add(cb);
  return () => {
    holdListeners.delete(cb);
  };
};

/** Pause every preview at `level` or below while something is open. Returns the release function. */
export const holdPreviews = (level: number): (() => void) => {
  const id = ++holdSeq;
  holds.set(id, level);
  emitHolds();
  return () => {
    if (holds.delete(id)) emitHolds();
  };
};

const blockedAt = (level: number): boolean => {
  for (const l of holds.values()) if (l >= level) return true;
  return false;
};

/** True while a window or dialog is open above a preview of this level. */
export const usePreviewsBlocked = (level: number): boolean =>
  useSyncExternalStore(subscribeHolds, () => blockedAt(level), () => false);

/* ---------- page visibility ---------- */

/** True while the browser tab is hidden (previews pause). */
export const usePageHidden = (): boolean => {
  const [hidden, setHidden] = useState(() => typeof document !== 'undefined' && document.hidden);
  useEffect(() => {
    const onVis = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);
  return hidden;
};

/** Data saver on (or a 2G connection): don't stream trailers on our own. */
export const PREVIEWS_SAVE_DATA = (() => {
  if (typeof navigator === 'undefined') return false;
  const c = (navigator as unknown as { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  return !!c && (c.saveData === true || c.effectiveType === 'slow-2g' || c.effectiveType === '2g');
})();
