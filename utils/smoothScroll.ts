/**
 * Page scrolling.
 *
 * Wheel and trackpad scrolling is the browser's own: it runs off the main thread, at the screen's refresh
 * rate, with the system's own momentum, so it never stutters while rows, images or hover previews are busy.
 * (A JavaScript smooth-scroll layer used to re-animate every wheel step on the main thread, which felt
 * choppy on trackpads and whenever the page was doing work.)
 *
 * Only programmatic moves glide: back to top, and jumping to a section. They are time-based, so they look
 * the same at 60, 120 or 144 Hz, and they stop the moment you scroll, click or press a key yourself.
 */

const GLIDE_SECONDS = 0.9;
const expoOut = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));

let glideRaf = 0;
let stopGlide: (() => void) | null = null;

const instantTo = (y: number) => window.scrollTo({ top: y, left: 0, behavior: 'instant' as ScrollBehavior });

const cancelGlide = () => {
  if (glideRaf) cancelAnimationFrame(glideRaf);
  glideRaf = 0;
  stopGlide?.();
  stopGlide = null;
};

/* While the page is scrolling, cards slide under a still mouse pointer. Hover effects, hover previews and
 * hover prefetches would fire on every card passing by and make the scroll stutter, so they wait until
 * the page has stopped for a moment (html.sf-scrolling turns hover off for the rows, see index.css). */
let lastScroll = 0;
let scrollingTimer = 0;
let started = false;
const SETTLE_MS = 160;
export const isScrolling = () => performance.now() - lastScroll < SETTLE_MS;

export const initSmoothScroll = () => {
  if (started || typeof window === 'undefined') return;
  started = true;
  const root = document.documentElement;
  window.addEventListener(
    'scroll',
    () => {
      lastScroll = performance.now();
      if (!scrollingTimer) root.classList.add('sf-scrolling');
      window.clearTimeout(scrollingTimer);
      scrollingTimer = window.setTimeout(() => {
        scrollingTimer = 0;
        root.classList.remove('sf-scrolling');
      }, SETTLE_MS);
    },
    { passive: true }
  );
};

export const scrollToY = (y: number, smooth = false) => {
  cancelGlide();
  const max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  const target = Math.min(Math.max(0, y), max);
  const from = window.scrollY;
  if (!smooth || Math.abs(target - from) < 2 || document.hidden) return instantTo(target);
  const start = performance.now();
  const dist = target - from;
  // Longer trips take a little longer, but never drag.
  const dur = Math.min(GLIDE_SECONDS, 0.45 + Math.abs(dist) / 6000) * 1000;
  const interrupt = () => cancelGlide();
  const opts = { passive: true, capture: true } as AddEventListenerOptions;
  window.addEventListener('wheel', interrupt, opts);
  window.addEventListener('touchstart', interrupt, opts);
  window.addEventListener('mousedown', interrupt, opts);
  window.addEventListener('keydown', interrupt, opts);
  stopGlide = () => {
    window.removeEventListener('wheel', interrupt, opts);
    window.removeEventListener('touchstart', interrupt, opts);
    window.removeEventListener('mousedown', interrupt, opts);
    window.removeEventListener('keydown', interrupt, opts);
  };
  const step = (now: number) => {
    const t = Math.min(1, (now - start) / dur);
    instantTo(from + dist * expoOut(t));
    if (t < 1) glideRaf = requestAnimationFrame(step);
    else cancelGlide();
  };
  glideRaf = requestAnimationFrame(step);
};

/** Jump straight to y (no animation). */
export const jumpToY = (y: number) => {
  cancelGlide();
  instantTo(y);
};

/** Stop the page behind a dialog from scrolling. The scrollbar's space stays reserved (see index.css),
 *  so nothing on the page shifts sideways when it's locked. */
let locks = 0;
export const pauseScroll = () => {
  locks++;
  document.documentElement.classList.add('sf-scroll-locked');
};
export const resumeScroll = () => {
  locks = Math.max(0, locks - 1);
  if (!locks) document.documentElement.classList.remove('sf-scroll-locked');
};
