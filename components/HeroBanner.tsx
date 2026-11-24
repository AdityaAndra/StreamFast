import React, { useEffect, useMemo, useState } from 'react';
import type { SearchResult } from '../types';
import { getImages } from '../services/tmdb';
import { useAppContext } from '../contexts/AppContext';
import { getTitle, getYear, getGenres, tmdbImage } from '../utils/media';
import { PlayIcon, PlusIcon, CheckStaticIcon } from './Icons';

const MAX_SLIDES = 6;
const logoCache = new Map<string, string | null>();

interface HeroBannerProps {
  items: SearchResult[];
  onSelect: (item: SearchResult) => void;
  /** Small label shown above the title, e.g. "Trending this week" */
  eyebrow?: string;
}

export const HeroSkeleton: React.FC = () => (
  <div className="relative h-[80vw] max-h-[95vh] min-h-[440px] w-full overflow-hidden bg-netflix-bg sm:h-[56.25vw]">
    <div className="absolute inset-0 shimmer" />
    <div className="absolute bottom-[32%] left-[4%] w-[80%] space-y-4 sm:w-[40%]">
      <div className="h-16 w-3/4 rounded bg-white/[0.06] sm:h-24" />
      <div className="h-4 w-1/3 rounded bg-white/[0.06]" />
      <div className="hidden h-4 w-full rounded bg-white/[0.06] sm:block" />
      <div className="hidden h-4 w-5/6 rounded bg-white/[0.06] sm:block" />
      <div className="flex gap-3 pt-2">
        <div className="h-11 w-28 rounded bg-white/[0.08]" />
        <div className="h-11 w-36 rounded bg-white/[0.06]" />
      </div>
    </div>
  </div>
);

/** Netflix-style billboard: full-bleed backdrop, title logo, Play / My List and a rotating feature. */
const HeroBanner: React.FC<HeroBannerProps> = ({ items, onSelect, eyebrow }) => {
  const { myList, toggleMyListItem } = useAppContext();
  const slides = useMemo(() => (items || []).filter((i) => i.backdrop_path).slice(0, MAX_SLIDES), [items]);
  const [index, setIndex] = useState(0);
  const [prevIndex, setPrevIndex] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);
  const [logos, setLogos] = useState<Record<string, string | null>>({});

  const current = slides[index] || slides[0];
  const keyOf = (item: SearchResult) => `${item.media_type}-${item.id}`;

  const goTo = (next: number) => {
    if (!slides.length || next === index) return;
    setPrevIndex(index);
    setIndex(((next % slides.length) + slides.length) % slides.length);
  };

  useEffect(() => {
    if (index >= slides.length) {
      setIndex(0);
      setPrevIndex(null);
    }
  }, [slides.length, index]);

  // Fetch the title logo for the current slide (falls back to text).
  useEffect(() => {
    if (!current) return;
    const key = keyOf(current);
    if (logoCache.has(key)) {
      setLogos((l) => ({ ...l, [key]: logoCache.get(key) ?? null }));
      return;
    }
    const controller = new AbortController();
    getImages(current.id, current.media_type, controller.signal)
      .then((images) => {
        const logo = images.logos?.find((l) => l.iso_639_1 === 'en') || images.logos?.[0];
        const path = logo ? logo.file_path : null;
        logoCache.set(key, path);
        setLogos((l) => ({ ...l, [key]: path }));
      })
      .catch(() => {
        // Failed (not just aborted): remember "no logo" so the text title shows.
        if (controller.signal.aborted) return;
        logoCache.set(key, null);
        setLogos((l) => ({ ...l, [key]: null }));
      });
    return () => controller.abort();
  }, [current]);

  // Preload the next backdrop so the crossfade is smooth.
  useEffect(() => {
    if (slides.length < 2) return;
    const next = slides[(index + 1) % slides.length];
    const src = tmdbImage(next?.backdrop_path, 'w1280');
    if (src) {
      const img = new Image();
      img.src = src;
    }
  }, [index, slides]);

  if (!current) return null;

  const key = keyOf(current);
  const logo = logos[key];
  const logoKnown = key in logos;
  const title = getTitle(current);
  const year = getYear(current);
  const genres = getGenres(current, 3);
  const match = typeof current.vote_average === 'number' && current.vote_average > 0 ? Math.round(current.vote_average * 10) : null;
  const inList = myList.some((i) => i.media.id === current.id && i.media.media_type === current.media_type);
  const visible = [prevIndex, index].filter((v, i, arr): v is number => v !== null && v < slides.length && arr.indexOf(v) === i);

  return (
    <section
      className="relative h-[80vw] max-h-[95vh] min-h-[440px] w-full select-none overflow-hidden bg-netflix-bg sm:h-[56.25vw]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-roledescription="carousel"
      aria-label={eyebrow || 'Featured titles'}
    >
      {/* Backdrops: previous stays underneath while the new one fades in */}
      {visible.map((i) => {
        const slide = slides[i];
        return (
          <img
            key={keyOf(slide)}
            src={tmdbImage(slide.backdrop_path, 'w1280') || ''}
            alt=""
            aria-hidden="true"
            className={`billboard-slide absolute inset-0 h-full w-full object-cover object-[center_20%] ${i === index ? 'z-[1]' : 'z-0'}`}
          />
        );
      })}

      <div className="billboard-vignette absolute inset-0 z-[2]" />

      {/* Info */}
      <div key={key} className="billboard-content absolute bottom-[30%] left-[4%] z-[3] w-[88%] sm:bottom-[32%] sm:w-[46%] lg:w-[38%]">
        {eyebrow && (
          <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.25em] text-white/90 text-shadow-netflix sm:text-sm">
            <span className="text-lg font-bold leading-none tracking-tighter text-netflix-red">V</span>
            {eyebrow}
          </p>
        )}

        <div className="mb-3 flex min-h-[4.5rem] items-end sm:mb-5 sm:min-h-[7rem]">
          {logo ? (
            <img
              src={tmdbImage(logo, 'w500') || ''}
              alt={title}
              className="max-h-[4.5rem] max-w-[80%] object-contain object-left drop-shadow-[0_4px_20px_rgba(0,0,0,0.55)] sm:max-h-[7rem] lg:max-h-[9rem] lg:max-w-[90%]"
            />
          ) : (
            <h2
              className={`text-4xl font-bold leading-[1.02] text-white text-shadow-netflix transition-opacity duration-300 sm:text-5xl lg:text-6xl ${
                logoKnown ? 'opacity-100' : 'opacity-0'
              }`}
            >
              {title}
            </h2>
          )}
        </div>

        <div className="mb-3 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm text-white text-shadow-netflix sm:text-base">
          {match !== null && <span className="font-bold text-netflix-green">{match}% Match</span>}
          {year && <span>{year}</span>}
          <span className="rounded-[3px] border border-white/50 px-1 text-[10px] font-bold leading-4">HD</span>
          {genres.length > 0 && <span className="hidden text-white/80 sm:inline">{genres.join(' • ')}</span>}
        </div>

        <p className="mb-5 hidden text-base leading-snug text-white text-shadow-netflix line-clamp-3 sm:block lg:text-[1.2vw] lg:leading-[1.35]">
          {current.overview}
        </p>

        <div className="flex items-center gap-2.5 sm:gap-3">
          <button
            type="button"
            onClick={() => onSelect(current)}
            className="inline-flex items-center gap-2 rounded-[4px] bg-white px-5 py-2 text-base font-bold text-black transition-colors duration-200 hover:bg-white/75 active:scale-[0.97] sm:px-7 sm:py-2.5 sm:text-lg lg:text-xl"
          >
            <PlayIcon className="h-5 w-5 sm:h-7 sm:w-7" />
            Play
          </button>
          <button
            type="button"
            onClick={() => toggleMyListItem(current)}
            aria-pressed={inList}
            className="inline-flex items-center gap-2 rounded-[4px] bg-[rgba(109,109,110,0.7)] px-5 py-2 text-base font-bold text-white transition-colors duration-200 hover:bg-[rgba(109,109,110,0.4)] active:scale-[0.97] sm:px-7 sm:py-2.5 sm:text-lg lg:text-xl"
          >
            {inList ? <CheckStaticIcon className="h-5 w-5 sm:h-7 sm:w-7" /> : <PlusIcon className="h-5 w-5 sm:h-7 sm:w-7" />}
            My List
          </button>
        </div>
      </div>

      {/* Right side: slide timer + type badge (Netflix maturity-badge style) */}
      <div className="absolute bottom-[30%] right-0 z-[3] flex items-center gap-4 sm:bottom-[35%]">
        {slides.length > 1 && (
          <div className="hidden items-center gap-1.5 sm:flex">
            {slides.map((slide, i) => (
              <button
                key={keyOf(slide)}
                type="button"
                onClick={() => goTo(i)}
                aria-label={`Show ${getTitle(slide)}`}
                aria-current={i === index}
                className="group py-2"
              >
                <span className={`relative block h-[3px] overflow-hidden rounded-full bg-white/30 transition-all duration-300 ${i === index ? 'w-8' : 'w-3 group-hover:bg-white/60'}`}>
                  {i === index && (
                    <span
                      key={`${key}-progress`}
                      className="billboard-progress absolute inset-y-0 left-0 bg-white"
                      style={{ animationPlayState: paused ? 'paused' : 'running' }}
                      onAnimationEnd={() => goTo(index + 1)}
                    />
                  )}
                </span>
              </button>
            ))}
          </div>
        )}
        <span className="flex items-center border-l-[3px] border-[#dcdcdc] bg-[rgba(51,51,51,0.6)] py-1.5 pl-3 pr-10 text-sm text-white sm:pr-14 sm:text-base">
          {current.media_type === 'movie' ? 'Movie' : 'Series'}
        </span>
      </div>
    </section>
  );
};

export default HeroBanner;
