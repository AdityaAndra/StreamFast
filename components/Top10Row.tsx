import React, { useId } from 'react';
import type { SearchResult } from '../types';
import ResultCard from './ResultCard';
import { RowShell } from './ContentCarousel';

interface Top10RowProps {
  title: string;
  items: SearchResult[];
  onSelect?: (item: SearchResult) => void;
}

/** Rank numbers get dimmer down the list (#1 brightest), like Netflix. */
const rankOpacity = (n: number) => Math.max(0.3, 0.55 - n * 0.05);

/**
 * Our own heavy geometric digits, drawn as centre-line strokes in an 85×148 box.
 * The stroke (WEIGHT wide) forms the bold glyph; an erode filter keeps only its outer edge,
 * giving a clean thin outline with no overlapping-contour artefacts (any font, any device).
 */
const WEIGHT = 22;
const OUTLINE = 1.6;
const DIGITS: Record<number, string> = {
  1: 'M26 46 L66 15 L66 142',
  2: 'M24 46 A23 25 0 1 1 68 54 C64 74 44 96 22 131 L84 131',
  3: 'M21 38 C26 23 36 17 47 17 C61 17 70 27 70 41 C70 57 59 68 41 69 C62 69 73 82 73 100 C73 120 60 131 46 131 C33 131 24 123 20 109',
  4: 'M60 142 L60 8 L16 102 L85 102',
  5: 'M78 17 L30 17 L26 70 C33 63 41 60 49 60 C64 60 73 73 73 95 C73 117 61 131 46 131 C34 131 25 124 21 111',
  6: 'M68 28 C62 20 55 17 48 17 C32 17 23 35 23 72 L23 98 C23 118 34 131 48 131 C62 131 72 119 72 100 C72 81 62 70 48 70 C36 70 26 77 23 88',
  7: 'M16 17 L82 17 L40 142',
  8: 'M26 43 A21 26 0 1 0 68 43 A21 26 0 1 0 26 43 Z M22 101 A25 30 0 1 0 72 101 A25 30 0 1 0 22 101 Z',
  9: 'M26 120 C32 128 39 131 46 131 C62 131 71 113 71 76 L71 50 C71 30 60 17 46 17 C32 17 22 29 22 48 C22 67 33 78 47 78 C59 78 68 71 71 60',
  // "10": the 0 runs on under the poster (clipped), as on Netflix
  10: 'M6 46 L36 15 L36 142 M60 41 A24 24 0 0 1 108 41 L108 107 A24 24 0 0 1 60 107 Z',
};

const RankNumber: React.FC<{ n: number }> = ({ n }) => {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const clip = `vfc${uid}`;
  const grad = `vfg${uid}`;
  const filt = `vff${uid}`;
  const mask = `vfm${uid}`;
  return (
    <svg
      className="nf-top10-num"
      viewBox="0 0 85 148"
      preserveAspectRatio="xMaxYMid meet"
      fill="none"
      aria-hidden="true"
      style={{ opacity: rankOpacity(n) }}
    >
      <defs>
        <clipPath id={clip}>
          <rect width="85" height="148" />
        </clipPath>
        <linearGradient id={grad} x1="50" y1="58" x2="85" y2="58" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fff" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <filter id={filt} x="-20" y="-20" width="140" height="190" filterUnits="userSpaceOnUse">
          <feMorphology in="SourceAlpha" operator="erode" radius={OUTLINE} result="inner" />
          <feComposite in="SourceGraphic" in2="inner" operator="out" />
        </filter>
        <mask id={mask} maskUnits="userSpaceOnUse" x="-20" y="-20" width="140" height="190">
          <g filter={`url(#${filt})`}>
            <path
              d={DIGITS[n] || DIGITS[10]}
              stroke="#fff"
              strokeWidth={WEIGHT}
              strokeLinejoin="miter"
              strokeMiterlimit={3}
              strokeLinecap="butt"
              fill="none"
            />
          </g>
        </mask>
      </defs>
      <g clipPath={`url(#${clip})`}>
        <rect x="-20" y="-20" width="125" height="190" fill={`url(#${grad})`} mask={`url(#${mask})`} />
      </g>
    </svg>
  );
};

const Top10Row: React.FC<Top10RowProps> = ({ title, items }) => {
  const top = (items || []).filter((i) => i.poster_path).slice(0, 10);
  if (top.length === 0) return null;

  return (
    <RowShell title={title} itemCount={top.length}>
      {top.map((item, index) => (
        <div key={`${item.media_type}-${item.id}`} className="nf-item">
          <div className="nf-top10-item">
            <div className="nf-top10-numbox">
              <RankNumber n={index + 1} />
            </div>
            <div className="nf-top10-poster">
              <ResultCard item={item} variant="poster" />
            </div>
          </div>
        </div>
      ))}
    </RowShell>
  );
};

export default Top10Row;
