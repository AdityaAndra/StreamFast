import React from 'react';
import type { SearchResult } from '../types';
import ResultCard from './ResultCard';
import { RowShell } from './ContentCarousel';
import { usePerRow } from '../utils/artwork';

interface Top10RowProps {
  title: string;
  items: SearchResult[];
  onSelect?: (item: SearchResult) => void;
}

/** Netflix's outlined rank numbers (SVG so the stroke stays crisp at any size). */
const RankNumber: React.FC<{ n: number }> = ({ n }) => (
  <svg className="nf-top10-num" viewBox="0 0 120 150" preserveAspectRatio="xMaxYMax meet" aria-hidden="true">
    <text
      x="119"
      y="147"
      textAnchor="end"
      fontSize={n === 10 ? 160 : 178}
      {...(n === 10 ? { textLength: 118, lengthAdjust: 'spacingAndGlyphs' } : {})}
    >
      {n}
    </text>
  </svg>
);

const Top10Row: React.FC<Top10RowProps> = ({ title, items }) => {
  const perRow = usePerRow();
  const top = (items || []).filter((i) => i.poster_path).slice(0, 10);
  if (top.length === 0) return null;

  return (
    <RowShell title={title} itemCount={top.length} perRow={Math.max(2, perRow - 1)}>
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
