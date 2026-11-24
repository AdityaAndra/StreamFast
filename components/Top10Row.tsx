import React, { useId } from 'react';
import type { SearchResult } from '../types';
import ResultCard from './ResultCard';
import { RowShell } from './ContentCarousel';

interface Top10RowProps {
  title: string;
  items: SearchResult[];
  onSelect?: (item: SearchResult) => void;
}

/** Same structure as Netflix's Top 10 tile: rank opacity steps 0.5 → 0.3. */
const rankOpacity = (n: number) => Math.max(0.3, 0.55 - n * 0.05);

/**
 * Rank number in an 85×148 box (right-aligned, vertically centred, clipped), drawn as a clean outline:
 * an SVG mask keeps only the outer stroke of the glyph (the fill erases inner/overlapping contours),
 * and a white → transparent gradient (x 50 → 85) fades it out toward the poster.
 */
const RankNumber: React.FC<{ n: number }> = ({ n }) => {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const maskId = `vf-m-${uid}`;
  const gradId = `vf-g-${uid}`;
  const clipId = `vf-c-${uid}`;
  const ten = n === 10;
  const glyph = {
    x: ten ? 3 : 83,
    y: 144,
    textAnchor: (ten ? 'start' : 'end') as 'start' | 'end',
    fontSize: 194,
    fontFamily: '"Inter Variable", Inter, "Helvetica Neue", Arial, sans-serif',
    fontWeight: 700,
    textLength: ten ? 112 : 78,
    lengthAdjust: 'spacingAndGlyphs' as const,
  };
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
        <clipPath id={clipId}>
          <rect width="85" height="148" />
        </clipPath>
        <linearGradient id={gradId} x1="50" y1="58" x2="85" y2="58" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fff" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <mask id={maskId} maskUnits="userSpaceOnUse" x="-20" y="-20" width="140" height="190">
          <text {...glyph} fill="none" stroke="#fff" strokeWidth={3.4} strokeLinejoin="round">
            {n}
          </text>
          <text {...glyph} fill="#000" stroke="none">
            {n}
          </text>
        </mask>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <rect x="-20" y="-20" width="125" height="190" fill={`url(#${gradId})`} mask={`url(#${maskId})`} />
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
