import Lenis from 'lenis';

/** Inertial wheel scrolling (Lenis) on mouse/trackpad devices. Touch keeps native momentum. */
let lenis: Lenis | null = null;
let rafId = 0;

/** Programmatic glides (scroll-to-top, jump to a section): time-based, so they look the same at 60, 120 or 144 Hz. */
const GLIDE_SECONDS = 1.1;
const expoOut = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));

export const initSmoothScroll = () => {
  if (lenis || typeof window === 'undefined' || !window.matchMedia) return;
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (!fine) return;
  lenis = new Lenis({
    // Wheel smoothing: Lenis damps with the real frame time, so this feels identical on 60 Hz and 120 Hz screens.
    lerp: 0.09,
    wheelMultiplier: 1,
    smoothWheel: true,
    syncTouch: false,
    // Let modals, menus, dropdowns and inner scroll areas scroll natively.
    prevent: (node: HTMLElement) => !!(node && node.closest && node.closest('[data-lenis-prevent], .fixed:not(header), [role="dialog"], [role="menu"], select, .overflow-y-auto')),
  } as any);
  // One animation loop only, and it sleeps while the tab is hidden.
  const raf = (time: number) => {
    lenis?.raf(time);
    rafId = requestAnimationFrame(raf);
  };
  const startLoop = () => {
    if (!rafId) rafId = requestAnimationFrame(raf);
  };
  const stopLoop = () => {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
  };
  document.addEventListener('visibilitychange', () => (document.hidden ? stopLoop() : startLoop()));
  if (!document.hidden) startLoop();
};

export const scrollToY = (y: number, smooth = false) => {
  if (lenis) {
    if (smooth) lenis.scrollTo(y, { lerp: 0, duration: GLIDE_SECONDS, easing: expoOut, force: true } as any);
    else lenis.scrollTo(y, { immediate: true, force: true } as any);
  }
  else window.scrollTo({ top: y, behavior: smooth ? 'smooth' : 'auto' });
};

/** Jump straight to y (no animation), after re-measuring the page, so a stale page height from
 *  the previous screen (e.g. the full-screen player) can never clamp the jump to the top. */
export const jumpToY = (y: number) => {
  (lenis as any)?.resize?.();
  window.scrollTo(0, y);
  if (lenis) lenis.scrollTo(y, { immediate: true, force: true } as any);
};

export const pauseScroll = () => lenis?.stop();
export const resumeScroll = () => {
  if (!lenis) return;
  lenis.start();
  // Pick up wherever the page is now (it may have been moved while paused), never an old position.
  (lenis as any).resize?.();
  lenis.scrollTo(window.scrollY, { immediate: true, force: true } as any);
};
