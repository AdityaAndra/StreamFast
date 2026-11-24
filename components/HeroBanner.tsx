import React, { useEffect, useMemo, useState } from 'react';
import type { SearchResult } from '../types';
import { usePlayer } from '../contexts/PlayerContext';
import { getTitle, getYear, getGenres, getMatch, tmdbImage, titlePath } from '../utils/media';
import { useLogo, prefetchLogos } from '../utils/artwork';
import { navigate } from '../utils/router';
import { PlayIcon, InfoIcon } from './Icons';

const MAX_SLIDES = 6;
const SLIDE_MS = 10000;
const COMPACT_AFTER_MS = 4500;

interface HeroBannerProps {
  items: SearchResult[];
  onSelect?: (item: SearchResult) => void;
  eyebrow?: string;
}

export const HeroSkeleton: React.FC = () => (
  <div className="nf-billboard" aria-hidden="true">
    <div className="nf-skel absolute inset-0 rounded-none opacity-60" />
    <div className="nf-billboard-vignette" />
    <div className="nf-billboard-info space-y-4">
      <div className="nf-skel h-[clamp(56px,8vw,140px)] w-3/4" />
      <div className="nf-skel hidden h-4 w-full sm:block" style={{ ['--i' as any]: 1 }} />
      <div className="nf-skel hidden h-4 w-4/5 sm:block" style={{ ['--i' as any]: 2 }} />
      <div className="flex gap-3 pt-2 max-sm:justify-center">
        <div className="nf-skel h-[clamp(40px,3.4vw,60px)] w-[clamp(110px,9vw,170px)]" style={{ ['--i' as any]: 3 }} />
        <div className="nf-skel h-[clamp(40px,3.4vw,60px)] w-[clamp(130px,11vw,210px)]" style={{ ['--i' as any]: 4 }} />
      </div>
    </div>
  </div>
);

const BillboardLogo: React.FC<{ item: SearchResult }> = ({ item }) => {
  const logo = useLogo(item);
  const [loaded, setLoaded] = useState(false);
  const title = getTitle(item);
  if (logo === undefined) return <div className="h-[clamp(64px,9vw,170px)]" />;
  if (!logo) {
    return (
      <h2 className="text-[clamp(2.2rem,4.6vw,5.5rem)] font-black leading-[0.95] tracking-[-0.03em] text-white text-shadow-netflix">
        {title}
      </h2>
    );
  }
  const tall = logo.r > 0 && logo.r < 1.8;
  return (
    <img
      src={tmdbImage(logo.p, 'w780') || ''}
      alt={title}
      onLoad={() => setLoaded(true)}
      className={`max-w-full object-contain object-left drop-shadow-[0_4px_24px_rgba(0,0,0,0.5)] transition-opacity duration-500 max-sm:mx-auto max-sm:object-center ${
        tall ? 'max-h-[clamp(90px,13vw,240px)]' : 'max-h-[clamp(64px,9vw,170px)]'
      } ${loaded ? 'opacity-100' : 'opacity-0'}`}
    />
  );
};

const HeroBanner: React.FC<HeroBannerProps> = ({ items, eyebrow }) => {
  const { openPlayer } = usePlayer();
  const slides = useMemo(() => (items || []).filter((i) => i.backdrop_path && i.overview).slice(0, MAX_SLIDES), [items]);
  const [index, setIndex] = useState(0);
  const [loaded, setLoaded] = useState<Record<number, boolean>>({});
  const [compact, setCompact] = useState(false);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (slides.length) prefetchLogos(slides);
  }, [slides]);

  useEffect(() => {
    if (index >= slides.length) setIndex(0);
  }, [slides.length, index]);

  // Netflix shrinks the logo and hides the synopsis after a few seconds.
  useEffect(() => {
    setCompact(false);
    const t = window.setTimeout(() => setCompact(true), COMPACT_AFTER_MS);
    return () => window.clearTimeout(t);
  }, [index]);

  // Pause rotation when the tab is hidden.
  useEffect(() => {
    const onVis = () => setPaused(document.hidden);
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  const current = slides[index] || slides[0];
  if (!current) return null;

  const next = () => setIndex((i) => (i + 1) % slides.length);
  const year = getYear(current);
  const genres = getGenres(current, 3);
  const match = getMatch(current);

  return (
    <section
      className={`nf-billboard ${compact ? 'is-compact' : ''}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-roledescription="carousel"
      aria-label={eyebrow || 'Featured'}
    >
      {slides.map((slide, i) => {
        // Keep only the active, previous and next images in the DOM.
        const near = i === index || i === (index + 1) % slides.length || i === (index - 1 + slides.length) % slides.length;
        if (!near) return null;
        return (
          <img
            key={`${slide.media_type}-${slide.id}`}
            src={tmdbImage(slide.backdrop_path, 'w1280') || ''}
            srcSet={`${tmdbImage(slide.backdrop_path, 'w780')} 780w, ${tmdbImage(slide.backdrop_path, 'w1280')} 1280w`}
            sizes="100vw"
            alt=""
            aria-hidden="true"
            fetchPriority={i === index ? 'high' : 'low'}
            onLoad={() => setLoaded((l) => ({ ...l, [i]: true }))}
            className={`nf-billboard-img ${i === index ? 'is-active' : ''} ${loaded[i] ? 'is-loaded' : ''}`}
          />
        );
      })}
      <div className="nf-billboard-vignette" />

      <div className="nf-billboard-info">
        <div key={`${current.media_type}-${current.id}`} className="nf-billboard-swap">
          {eyebrow && (
            <p className="mb-[1.2vw] flex items-center gap-2 text-[max(11px,0.95vw)] font-semibold uppercase tracking-[0.3em] text-white/85 text-shadow-netflix max-sm:justify-center">
              <span className="text-[1.5em] font-black leading-none tracking-[-0.08em] text-netflix-red">V</span>
              {eyebrow}
            </p>
          )}
          <div className="nf-billboard-logo mb-[1.2vw] max-sm:mb-4">
            <BillboardLogo item={current} />
          </div>
          <div className="nf-billboard-collapse">
            <div>
              <div className="mb-[0.8vw] flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[max(13px,1.05vw)] font-medium text-white text-shadow-netflix max-sm:justify-center">
                {match !== null && <span className="font-bold text-netflix-green">{match}% Match</span>}
                {year && <span>{year}</span>}
                <span className="rounded-[3px] border border-white/60 px-1 text-[0.72em] font-bold leading-[1.45]">HD</span>
                {genres.length > 0 && <span className="text-white/80">{genres.join(' • ')}</span>}
              </div>
              <p className="mb-[1.5vw] hidden overflow-hidden text-[max(14px,1.2vw)] leading-[1.35] text-white text-shadow-netflix [-webkit-box-orient:vertical] [-webkit-line-clamp:3] sm:[display:-webkit-box]">
                {current.overview}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-[0.7vw] max-sm:justify-center max-sm:gap-3">
            <button type="button" className="nf-btn nf-btn-white" onClick={() => openPlayer(current, { tab: 'watch' })}>
              <PlayIcon />
              Play
            </button>
            <button type="button" className="nf-btn nf-btn-grey" onClick={() => navigate(titlePath(current))}>
              <InfoIcon />
              More Info
            </button>
          </div>
        </div>
      </div>

      {/* Right edge: slide timer + type flag (where Netflix shows the maturity rating) */}
      <div className="absolute bottom-[35%] right-0 z-[3] flex items-center gap-4 max-sm:hidden">
        {slides.length > 1 && (
          <div className="flex items-center gap-1.5">
            {slides.map((slide, i) => (
              <button
                key={`${slide.media_type}-${slide.id}`}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Show ${getTitle(slide)}`}
                aria-current={i === index}
                className="group py-2"
              >
                <span className={`relative block h-[3px] overflow-hidden rounded-full bg-white/30 transition-[width,background-color] duration-300 ${i === index ? 'w-8' : 'w-3 group-hover:bg-white/60'}`}>
                  {i === index && (
                    <span
                      key={`t-${index}`}
                      className="nf-billboard-timer absolute inset-0 origin-left bg-white"
                      style={{ ['--dur' as any]: `${SLIDE_MS}ms`, animationPlayState: paused ? 'paused' : 'running' }}
                      onAnimationEnd={next}
                    />
                  )}
                </span>
              </button>
            ))}
          </div>
        )}
        <span className="flex items-center border-l-[3px] border-[#dcdcdc] bg-[rgba(51,51,51,0.6)] py-[0.45em] pl-[0.8em] pr-[3.5vw] text-[max(13px,1.05vw)] text-white">
          {current.media_type === 'movie' ? 'Movie' : 'Series'}
        </span>
      </div>
    </section>
  );
};

export default HeroBanner;
