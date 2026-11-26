import React, { useEffect, useRef, useState } from 'react';
import { Link } from '../utils/router';
import { ChevronDownIcon } from './Icons';

interface MenuItem {
  label: string;
  to: string;
}

const q = (o: Record<string, string>) => '?' + new URLSearchParams(o).toString();
const b = (o: Record<string, string>) => `/browse${q(o)}`;

/** Netflix's Movies "Genres" menu (holidays, languages, then genres). */
const MOVIE_ITEMS: MenuItem[] = [
  { label: 'Holidays', to: b({ type: 'movie', keyword: '207317|65', title: 'Holiday Movies' }) },
  { label: 'Hindi', to: b({ type: 'movie', lang: 'hi', title: 'Hindi Movies' }) },
  { label: 'Tamil', to: b({ type: 'movie', lang: 'ta', title: 'Tamil Movies' }) },
  { label: 'Telugu', to: b({ type: 'movie', lang: 'te', title: 'Telugu Movies' }) },
  { label: 'Malayalam', to: b({ type: 'movie', lang: 'ml', title: 'Malayalam Movies' }) },
  { label: 'Kannada', to: b({ type: 'movie', lang: 'kn', title: 'Kannada Movies' }) },
  { label: 'English', to: b({ type: 'movie', lang: 'en', title: 'English Movies' }) },
  { label: 'International', to: `/languages${q({ type: 'movie', lang: 'ko' })}` },
  { label: 'Independent', to: b({ type: 'movie', keyword: '281237', title: 'Independent Movies' }) },
  { label: 'Comedies', to: b({ type: 'movie', genre: '35', title: 'Comedies' }) },
  { label: 'Action', to: b({ type: 'movie', genre: '28', title: 'Action Movies' }) },
  { label: 'Romance', to: b({ type: 'movie', genre: '10749', title: 'Romantic Movies' }) },
  { label: 'Dramas', to: b({ type: 'movie', genre: '18', title: 'Dramas' }) },
  { label: 'Thrillers', to: b({ type: 'movie', genre: '53', title: 'Thrillers' }) },
  { label: 'Horror', to: b({ type: 'movie', genre: '27', title: 'Horror Movies' }) },
  { label: 'Sci-Fi', to: b({ type: 'movie', genre: '878', title: 'Sci-Fi Movies' }) },
  { label: 'Fantasy', to: b({ type: 'movie', genre: '14', title: 'Fantasy Movies' }) },
  { label: 'Crime', to: b({ type: 'movie', genre: '80', title: 'Crime Movies' }) },
  { label: 'Mysteries', to: b({ type: 'movie', genre: '9648', title: 'Mysteries' }) },
  { label: 'Adventure', to: b({ type: 'movie', genre: '12', title: 'Adventure Movies' }) },
  { label: 'Children & Family', to: b({ type: 'movie', genre: '10751', title: 'Children & Family Movies' }) },
  { label: 'Anime', to: b({ type: 'movie', genre: '16', lang: 'ja', title: 'Anime Movies' }) },
  { label: 'Animation', to: b({ type: 'movie', genre: '16', title: 'Animated Movies' }) },
  { label: 'Documentaries', to: b({ type: 'movie', genre: '99', title: 'Documentaries' }) },
  { label: 'Music & Musicals', to: b({ type: 'movie', genre: '10402', title: 'Music & Musicals' }) },
  { label: 'History', to: b({ type: 'movie', genre: '36', title: 'History Movies' }) },
  { label: 'War', to: b({ type: 'movie', genre: '10752', title: 'War Movies' }) },
  { label: 'Westerns', to: b({ type: 'movie', genre: '37', title: 'Westerns' }) },
];

/** Netflix's Shows "Genres" menu. */
const TV_ITEMS: MenuItem[] = [
  { label: 'Hindi', to: b({ type: 'tv', lang: 'hi', title: 'Hindi TV Shows' }) },
  { label: 'Tamil', to: b({ type: 'tv', lang: 'ta', title: 'Tamil TV Shows' }) },
  { label: 'Telugu', to: b({ type: 'tv', lang: 'te', title: 'Telugu TV Shows' }) },
  { label: 'Malayalam', to: b({ type: 'tv', lang: 'ml', title: 'Malayalam TV Shows' }) },
  { label: 'English', to: b({ type: 'tv', lang: 'en', title: 'English TV Shows' }) },
  { label: 'K-Dramas', to: b({ type: 'tv', genre: '18', lang: 'ko', title: 'K-Dramas' }) },
  { label: 'Anime', to: b({ type: 'tv', genre: '16', lang: 'ja', title: 'Anime Series' }) },
  { label: 'International', to: `/languages${q({ type: 'tv', lang: 'ko' })}` },
  { label: 'Comedies', to: b({ type: 'tv', genre: '35', title: 'TV Comedies' }) },
  { label: 'Dramas', to: b({ type: 'tv', genre: '18', title: 'TV Dramas' }) },
  { label: 'Crime', to: b({ type: 'tv', genre: '80', title: 'Crime TV Shows' }) },
  { label: 'Action & Adventure', to: b({ type: 'tv', genre: '10759', title: 'Action & Adventure TV' }) },
  { label: 'Sci-Fi & Fantasy', to: b({ type: 'tv', genre: '10765', title: 'Sci-Fi & Fantasy TV' }) },
  { label: 'Mysteries', to: b({ type: 'tv', genre: '9648', title: 'Mystery TV Shows' }) },
  { label: 'Reality', to: b({ type: 'tv', genre: '10764', title: 'Reality TV' }) },
  { label: 'Docuseries', to: b({ type: 'tv', genre: '99', title: 'Docuseries' }) },
  { label: 'Kids', to: b({ type: 'tv', genre: '10762', title: 'Kids TV' }) },
  { label: 'Animation', to: b({ type: 'tv', genre: '16', title: 'Animated Series' }) },
  { label: 'Family', to: b({ type: 'tv', genre: '10751', title: 'Family TV' }) },
  { label: 'Soaps', to: b({ type: 'tv', genre: '10766', title: 'Soaps' }) },
  { label: 'Talk Shows', to: b({ type: 'tv', genre: '10767', title: 'Talk Shows' }) },
  { label: 'War & Politics', to: b({ type: 'tv', genre: '10768', title: 'War & Politics TV' }) },
  { label: 'Westerns', to: b({ type: 'tv', genre: '37', title: 'TV Westerns' }) },
];

/** Netflix-style "Genres ▾" pill with a dark dropdown list. */
const GenresMenu: React.FC<{ mediaType: 'movie' | 'tv' }> = ({ mediaType }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const items = mediaType === 'tv' ? TV_ITEMS : MOVIE_ITEMS;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="pointer-events-auto relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`flex items-center gap-2 rounded-full border px-[1.1em] py-[0.5em] text-[max(15px,1.05vw)] font-bold text-white backdrop-blur-sm transition-colors duration-200 ${
          open ? 'border-white/40 bg-white/20' : 'border-white/30 bg-white/[0.06] hover:border-white/60 hover:bg-white/10'
        }`}
      >
        Genres
        <ChevronDownIcon className={`h-[1em] w-[1em] transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div
          role="menu"
          data-lenis-prevent
          className="absolute left-0 top-[calc(100%+0.6rem)] z-50 max-h-[min(70vh,640px)] w-[min(86vw,22rem)] overflow-y-auto overscroll-contain rounded-2xl bg-[#262626]/[0.97] py-2.5 shadow-[0_16px_48px_rgba(0,0,0,0.6)] ring-1 ring-white/10 animate-dropdown-in sm:left-[calc(100%-6.5rem)]"
        >
          {items.map((it) => (
            <Link
              key={it.label}
              to={it.to}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="block px-5 py-[0.7em] text-[max(15px,1.05vw)] font-bold text-white transition-colors duration-150 hover:bg-white/10"
            >
              {it.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default GenresMenu;
