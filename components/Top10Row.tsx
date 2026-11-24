import React from 'react';
import type { SearchResult } from '../types';
import ResultCard from './ResultCard';
import { RowShell } from './ContentCarousel';

interface Top10RowProps {
  title: string;
  items: SearchResult[];
  onSelect: (item: SearchResult) => void;
}

/** Netflix "Top 10" row: big outlined rank numbers with the poster tucked over them. */
const Top10Row: React.FC<Top10RowProps> = ({ title, items, onSelect }) => {
  const top = (items || []).filter((i) => i.poster_path).slice(0, 10);
  if (top.length === 0) return null;

  return (
    <RowShell title={title} itemCount={top.length} gapClass="gap-1 sm:gap-2">
      {top.map((item, index) => (
        <div
          key={`${item.media_type}-${item.id}`}
          className="row-item-in flex flex-shrink-0 snap-start items-end w-[58%] sm:w-[40%] md:w-[30%] lg:w-[23.5%] xl:w-[19.5%]"
          style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}
        >
          <span
            aria-hidden="true"
            className={`top10-number relative z-0 flex-shrink-0 select-none text-[8.5rem] sm:text-[10rem] lg:text-[12rem] xl:text-[13.5rem] ${
              index === 9 ? '-mr-[14%]' : '-mr-[7%]'
            }`}
          >
            {index + 1}
          </span>
          <div className="relative z-10 w-[54%] flex-shrink-0">
            <ResultCard item={item} onSelect={onSelect} variant="poster" />
          </div>
        </div>
      ))}
    </RowShell>
  );
};

export default Top10Row;
