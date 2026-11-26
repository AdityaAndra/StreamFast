/**
 * Where a title window should grow from: the card (or button) that was clicked to open it.
 * Read once by the title window when it opens; ignored if it is stale (e.g. a Ctrl+click that opened a new tab).
 */
let origin: { x: number; y: number; at: number } | null = null;

export const setTitleOrigin = (el: Element | null | undefined) => {
  if (!el) return;
  const r = el.getBoundingClientRect();
  if (!r.width || !r.height) return;
  origin = { x: r.left + r.width / 2, y: r.top + r.height / 2, at: Date.now() };
};

export const takeTitleOrigin = (): { x: number; y: number } | null => {
  const o = origin;
  origin = null;
  return o && Date.now() - o.at < 1500 ? { x: o.x, y: o.y } : null;
};
