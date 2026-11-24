const cache = new Map<string, string>();
const FALLBACK = '#141414';

const rgbToHsl = (r: number, g: number, b: number): [number, number, number] => {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h *= 60;
  return [Math.round(h), s, l];
};

/**
 * Netflix-style ambient colour: samples a tiny copy of the artwork and returns a deep,
 * muted tint of its dominant colour for the page background behind the billboard.
 */
export const getAmbient = (path: string | null | undefined): Promise<string> => {
  if (!path) return Promise.resolve(FALLBACK);
  const hit = cache.get(path);
  if (hit) return Promise.resolve(hit);
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    img.onload = () => {
      try {
        const w = 24;
        const h = 14;
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) throw new Error('no ctx');
        ctx.drawImage(img, 0, 0, w, h);
        const d = ctx.getImageData(0, 0, w, h).data;
        let r = 0, g = 0, b = 0, total = 0;
        for (let i = 0; i < d.length; i += 4) {
          const R = d[i], G = d[i + 1], B = d[i + 2];
          const max = Math.max(R, G, B);
          const min = Math.min(R, G, B);
          const sat = max ? (max - min) / max : 0;
          const lum = (max + min) / 510;
          const weight = 0.15 + sat * (1 - Math.abs(lum - 0.45));
          r += R * weight; g += G * weight; b += B * weight; total += weight;
        }
        const [hue, s, l] = rgbToHsl(r / total, g / total, b / total);
        const color = `hsl(${hue} ${Math.round(Math.min(s, 0.55) * 100)}% ${Math.round(Math.min(Math.max(l, 0.13), 0.21) * 100)}%)`;
        cache.set(path, color);
        resolve(color);
      } catch {
        resolve(FALLBACK);
      }
    };
    img.onerror = () => resolve(FALLBACK);
    img.src = `https://image.tmdb.org/t/p/w92${path}`;
  });
};
