import React from 'react';
import type { SearchResult } from '../types';
import ResultCard from './ResultCard';
import { RowShell } from './ContentCarousel';

interface Top10RowProps {
  title: string;
  items: SearchResult[];
  onSelect?: (item: SearchResult) => void;
}

/** Rank numbers get dimmer down the list (Netflix: #1 brightest). */
const rankOpacity = (n: number) => Math.max(0.3, 0.55 - n * 0.05);

/** Outlined rank number that fades out toward the poster. Our own SVG (text glyph + gradient stroke). */
const RankNumber: React.FC<{ n: number }> = ({ n }) => {
  const id = `vf-rank-fade-${n}`;
  return (
    <svg className="nf-top10-num" viewBox="0 0 100 143" preserveAspectRatio="xMidYMax meet" aria-hidden="true" style={{ opacity: rankOpacity(n) }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="0" gradientUnits="objectBoundingBox">
          <stop offset="0.55" stopColor="#fff" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <text
        x={n === 10 ? 2 : 98}
        y="139"
        textAnchor={n === 10 ? 'start' : 'end'}
        fontSize={n === 10 ? 150 : 176}
        letterSpacing={n === 10 ? -12 : 0}
        stroke={`url(#${id})`}
      >
        {n}
      </text>
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
            <RankNumber n={index + 1} />
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
