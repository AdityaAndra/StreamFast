import React, { ReactNode, useEffect, useMemo, useState } from 'react';
import type { SearchResult } from '../types';
import { usePlayer } from '../contexts/PlayerContext';
import { getTitleDetails, TitleDetails } from '../services/tmdb';
import { getTitle, getYear, getGenres, tmdbImage, titlePath } from '../utils/media';
import { useLogo, prefetchLogos } from '../utils/artwork';
import { useCachedData } from '../utils/useCachedData';
import { getAmbient } from '../utils/ambient';
import { getRegion } from '../utils/brands';
import { navigate } from '../utils/router';
import { PlayIcon } from './Icons';
import { ImdbRating, useHasImdb } from './Imdb';

const MAX_SLIDES = 6;
const SLIDE_MS = 10000;

interface HeroBannerProps {
  items: SearchResult[];
  /** Content shown above the card (e.g. "Movies [Genres]" on category pages). */
  top?: ReactNode;
  onSelect?: (item: SearchResult) => void;
  eyebrow?: string;
}

/* ---------- metadata line: Film • Action • 2009 • 1h 38m • A ---------- */

const certificationOf = (d: TitleDetails | undefined): string | undefined => {
  if (!d) return undefined;
  const prefs = [getRegion(), 'IN', 'US', 'GB'];
  if (d.media_type === 'tv') {
    const list = d.content_ratings?.results || [];
    for (const r of prefs) {
      const hit = list.find((x) => x.iso_3166_1 === r && x.rating);
      if (hit) return hit.rating;
    }
    return list.find((x) => x.rating)?.rating;
  }
  const list = d.release_dates?.results || [];
  for (const r of prefs) {
    const hit = list.find((x) => x.iso_3166_1 === r)?.release_dates?.find((x) => x.certification)?.certification;
    if (hit) return hit;
  }
  return undefined;
};

const lengthOf = (d: TitleDetails | undefined): string | undefined => {
  if (!d) return undefined;
  if (d.media_type === 'movie') {
    if (!d.runtime) return undefined;
    const h = Math.floor(d.runtime / 60);
    return `${h ? `${h}h ` : ''}${d.runtime % 60}m`;
  }
  const n = d.number_of_seasons || 0;
  return n ? `${n} Season${n > 1 ? 's' : ''}` : undefined;
};

const Meta: React.FC<{ item: SearchResult }> = ({ item }) => {
  const { data } = useCachedData<TitleDetails>(`title:${item.media_type}:${item.id}`, () => getTitleDetails(item.media_type, item.id));
  const parts = [
    item.media_type === 'movie' ? 'Film' : 'Series',
    data?.genres?.[0]?.name || getGenres(item, 1)[0],
    getYear(item),
    lengthOf(data),
    certificationOf(data),
  ].filter(Boolean) as string[];
  const hasImdb = useHasImdb(item);
  return (
    <div className="nf-hero-meta">
      <ImdbRating item={item} size="md" />
      {hasImdb && <span className="nf-dot" aria-hidden="true" />}
      {parts.map((p, i) => (
        <React.Fragment key={`${p}-${i}`}>
          {i > 0 && <span className="nf-dot" aria-hidden="true" />}
          <span>{p}</span>
        </React.Fragment>
      ))}
    </div>
  );
};

/* ---------- title logo ---------- */

const HeroLogo: React.FC<{ item: SearchResult }> = ({ item }) => {
  const logo = useLogo(item);
  const [loaded, setLoaded] = useState(false);
  const title = getTitle(item);
  if (logo === undefined) return <div className="h-[clamp(64px,9vw,170px)]" />;
  if (!logo) return <h2 className="nf-hero-title">{title}</h2>;
  const tall = logo.r > 0 && logo.r < 1.8;
  return (
    <img
      src={tmdbImage(logo.p, 'w780') || ''}
      alt={title}
      onLoad={() => setLoaded(true)}
      className={`nf-hero-logo ${tall ? 'is-tall' : ''} ${loaded ? 'is-loaded' : ''}`}
    />
  );
};

/* ---------- skeleton ---------- */

export const HeroSkeleton: React.FC<{ top?: ReactNode }> = ({ top }) => (
  <section className="nf-hero" aria-hidden="true">
    {top && <div className="nf-hero-top">{top}</div>}
    <div className="nf-hero-card">
      <div className="nf-skel absolute inset-0 rounded-none opacity-50" />
      <div className="nf-hero-info space-y-4">
        <div className="nf-skel h-[clamp(56px,8vw,140px)] w-3/4" />
        <div className="nf-skel h-4 w-1/2" style={{ ['--i' as any]: 1 }} />
        <div className="nf-skel hidden h-4 w-full sm:block" style={{ ['--i' as any]: 2 }} />
        <div className="flex gap-3 pt-2 max-sm:justify-center">
          <div className="nf-skel h-[max(42px,3.3vw)] w-[clamp(104px,8vw,150px)] !rounded-full" style={{ ['--i' as any]: 3 }} />
          <div className="nf-skel h-[max(42px,3.3vw)] w-[clamp(124px,9.5vw,180px)] !rounded-full" style={{ ['--i' as any]: 4 }} />
        </div>
      </div>
    </div>
  </section>
);

/* ---------- banner ---------- */

const HeroBanner: React.FC<HeroBannerProps> = ({ items, top }) => {
  const { openPlayer } = usePlayer();
  const slides = useMemo(() => (items || []).filter((i) => i.backdrop_path && i.overview).slice(0, MAX_SLIDES), [items]);
  const [index, setIndex] = useState(0);
  const [loaded, setLoaded] = useState<Record<number, boolean>>({});
  const [paused, setPaused] = useState(false);
  const [ambient, setAmbient] = useState('#141414');

  useEffect(() => {
    if (slides.length) prefetchLogos(slides);
  }, [slides]);

  useEffect(() => {
    if (index >= slides.length) setIndex(0);
  }, [slides.length, index]);

  useEffect(() => {
    const onVis = () => setPaused(document.hidden);
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  const current = slides[index] || slides[0];

  // Page tint follows the artwork's colour (Netflix ambient background).
  useEffect(() => {
    let alive = true;
    if (current) getAmbient(current.backdrop_path).then((c) => alive && setAmbient(c));
    return () => {
      alive = false;
    };
  }, [current]);

  // Pause button (WCAG 2.2.2) and pause while keyboard focus is inside the banner.
  const [userPaused, setUserPaused] = useState(false);
  const [focusInside, setFocusInside] = useState(false);
  if (!current) return null;
  const next = () => setIndex((i) => (i + 1) % slides.length);
  const halted = paused || userPaused || focusInside;

  return (
    <section className="nf-hero" aria-roledescription="carousel" aria-label="Featured">
      <div className="nf-ambient" style={{ backgroundColor: ambient }} aria-hidden="true" />
      {top && <div className="nf-hero-top">{top}</div>}

      <div
        className="nf-hero-card"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(document.hidden)}
        onFocus={() => setFocusInside(true)}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setFocusInside(false);
        }}
      >
        {slides.map((slide, i) => {
          const near = i === index || i === (index + 1) % slides.length || i === (index - 1 + slides.length) % slides.length;
          if (!near) return null;
          return (
            <img
              key={`${slide.media_type}-${slide.id}`}
              src={tmdbImage(slide.backdrop_path, 'w1280') || ''}
              srcSet={`${tmdbImage(slide.backdrop_path, 'w780')} 780w, ${tmdbImage(slide.backdrop_path, 'w1280')} 1280w`}
              sizes="92vw"
              alt=""
              aria-hidden="true"
              fetchPriority={i === index ? 'high' : 'low'}
              onLoad={() => setLoaded((l) => ({ ...l, [i]: true }))}
              className={`nf-billboard-img ${i === index ? 'is-active' : ''} ${loaded[i] ? 'is-loaded' : ''}`}
            />
          );
        })}
        <div className="nf-hero-shade" />

        <div className="nf-hero-info">
          <div key={`${current.media_type}-${current.id}`} className="nf-billboard-swap">
            <HeroLogo item={current} />
            <Meta item={current} />
            <p className="nf-hero-desc">{current.overview}</p>
            <div className="flex items-center gap-[max(10px,0.8vw)] max-sm:justify-center">
              <button type="button" className="nf-btn nf-btn-white" onClick={() => openPlayer(current, { tab: 'watch' })}>
                <PlayIcon />
                Play
              </button>
              <button type="button" className="nf-btn nf-btn-grey" onClick={() => navigate(titlePath(current))}>
                More Info
              </button>
            </div>
          </div>
        </div>

        {slides.length > 1 && (
          <div className="nf-hero-dots">
            {slides.map((slide, i) => (
              <button
                key={`${slide.media_type}-${slide.id}`}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Show ${getTitle(slide)}`}
                aria-current={i === index}
                className="group py-2"
              >
                <span className={`relative block h-[4px] overflow-hidden rounded-full bg-white/30 transition-[width,background-color] duration-500 ease-out-expo ${i === index ? 'w-7' : 'w-[4px] group-hover:bg-white/60'}`}>
                  {i === index && (
                    <span
                      key={`t-${index}`}
                      className="nf-billboard-timer absolute inset-0 origin-left bg-white"
                      style={{ ['--dur' as any]: `${SLIDE_MS}ms`, animationPlayState: halted ? 'paused' : 'running' }}
                      onAnimationEnd={next}
                    />
                  )}
                </span>
              </button>
            ))}
            <button
              type="button"
              onClick={() => setUserPaused((p) => !p)}
              aria-label={userPaused ? 'Play slideshow' : 'Pause slideshow'}
              aria-pressed={userPaused}
              className="ml-1 flex h-6 w-6 items-center justify-center rounded-full text-white/60 transition-colors hover:text-white"
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
                {userPaused ? <path d="M8 5v14l11-7z" /> : <path d="M7 5h4v14H7zM13 5h4v14h-4z" />}
              </svg>
            </button>
          </div>
        )}
      </div>
    </section>
  );
};

export default HeroBanner;
