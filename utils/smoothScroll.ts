import Lenis from 'lenis';

/** Inertial wheel scrolling (Lenis) on mouse/trackpad devices. Touch keeps native momentum. */
let lenis: Lenis | null = null;

export const initSmoothScroll = () => {
  if (lenis || typeof window === 'undefined' || !window.matchMedia) return;
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (!fine) return;
  lenis = new Lenis({
    lerp: 0.09,
    wheelMultiplier: 1,
    smoothWheel: true,
    // Let modals, menus, dropdowns and inner scroll areas scroll natively.
    prevent: (node: HTMLElement) => !!(node && node.closest && node.closest('[data-lenis-prevent], .fixed:not(header), [role="dialog"], [role="menu"], select, .overflow-y-auto')),
  } as any);
  const raf = (time: number) => {
    lenis?.raf(time);
    requestAnimationFrame(raf);
  };
  requestAnimationFrame(raf);
};

export const scrollToY = (y: number, smooth = false) => {
  if (lenis) lenis.scrollTo(y, { immediate: !smooth, force: true } as any);
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
export const resumeScroll = () => lenis?.start();
