import React, { useEffect, useMemo, useState } from 'react';
import type { SearchResult } from '../types';
import { getTitleDetails, TitleDetails } from '../services/tmdb';
import { useCachedData } from '../utils/useCachedData';
import { useAppContext } from '../contexts/AppContext';
import { usePlayer } from '../contexts/PlayerContext';
import { getTitle, getYear, tmdbImage, titlePath } from '../utils/media';
import { ImdbRating } from '../components/Imdb';
import { prefetchLogos } from '../utils/artwork';
import { goBack, navigate } from '../utils/router';
import EpisodeList from '../components/EpisodeList';
import ResultCard from '../components/ResultCard';
import ErrorState from '../components/ErrorState';
import { PlayIcon, PlusIcon, CheckStaticIcon, LinkIcon, ChevronLeftIcon, CloseIcon, FilmIcon } from '../components/Icons';

const toSearchResult = (d: TitleDetails): SearchResult => {
  const base = {
    id: d.id,
    poster_path: d.poster_path,
    backdrop_path: d.backdrop_path,
    overview: d.overview,
    popularity: d.popularity,
    vote_average: d.vote_average,
    genre_ids: (d.genres || []).map((g) => g.id),
  };
  return d.media_type === 'movie'
    ? { ...base, media_type: 'movie', title: d.title || '', original_title: d.original_title || '', release_date: d.release_date || '' }
    : { ...base, media_type: 'tv', name: d.name || '', original_name: d.original_name || '', first_air_date: d.first_air_date || '' };
};

const pickLogo = (d: TitleDetails) => {
  const logos = d.images?.logos || [];
  const en = logos.filter((l) => l.iso_639_1 === 'en');
  const pool = en.length ? en : logos.filter((l) => !l.iso_639_1);
  return [...pool].sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0))[0] || null;
};

const certification = (d: TitleDetails): string | undefined =>
  d.media_type === 'tv'
    ? d.content_ratings?.results?.find((r) => r.iso_3166_1 === 'US')?.rating || undefined
    : d.release_dates?.results?.find((r) => r.iso_3166_1 === 'US')?.release_dates?.find((x) => x.certification)?.certification || undefined;

const lengthText = (d: TitleDetails) => {
  if (d.media_type === 'movie') return d.runtime ? `${Math.floor(d.runtime / 60) ? `${Math.floor(d.runtime / 60)}h ` : ''}${d.runtime % 60}m` : '';
  const n = d.number_of_seasons || 0;
  return n ? `${n} Season${n > 1 ? 's' : ''}` : d.number_of_episodes ? `${d.number_of_episodes} Episodes` : '';
};

const TitleSkeleton: React.FC = () => (
  <div aria-hidden="true">
    <div className="relative h-[min(56.25vw,92vh)] min-h-[520px] w-full max-sm:h-[118vw] max-sm:min-h-0">
      <div className="nf-skel absolute inset-0 rounded-none opacity-60" />
      <div className="nf-billboard-vignette" />
      <div className="absolute bottom-[12%] left-[4%] w-[min(46%,720px)] space-y-4 max-sm:left-[6%] max-sm:right-[6%] max-sm:w-auto">
        <div className="nf-skel h-[clamp(60px,8vw,150px)] w-3/4" />
        <div className="nf-skel h-4 w-1/2" style={{ ['--i' as any]: 1 }} />
        <div className="flex gap-3">
          <div className="nf-skel h-12 w-36" style={{ ['--i' as any]: 2 }} />
          <div className="nf-skel h-12 w-12 rounded-full" style={{ ['--i' as any]: 3 }} />
        </div>
      </div>
    </div>
    <div className="space-y-3 px-[4%] pt-6">
      <div className="nf-skel h-4 w-2/3" />
      <div className="nf-skel h-4 w-1/2" style={{ ['--i' as any]: 1 }} />
    </div>
  </div>
);

const Credits: React.FC<{ label: string; items: string[] }> = ({ label, items }) =>
  items.length ? (
    <p className="leading-relaxed">
      <span className="text-[#777]">{label}: </span>
      <span className="text-[#ddd]">{items.join(', ')}</span>
    </p>
  ) : null;

const TrailerOverlay: React.FC<{ videoKey: string; title: string; onClose: () => void }> = ({ videoKey, title, onClose }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-4 animate-fade-in-fast" onClick={onClose} role="dialog" aria-label={`${title} trailer`}>
      <div className="relative aspect-video w-full max-w-5xl overflow-hidden rounded-md bg-black shadow-2xl animate-zoom-in" onClick={(e) => e.stopPropagation()}>
        <iframe
          className="absolute inset-0 h-full w-full"
          src={`https://www.youtube-nocookie.com/embed/${videoKey}?autoplay=1&rel=0&modestbranding=1`}
          title={`${title} trailer`}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
        />
        <button type="button" onClick={onClose} className="nf-circle absolute right-3 top-3 z-10 text-base" aria-label="Close trailer">
          <CloseIcon className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
};

interface TitlePageProps {
  mediaType: 'movie' | 'tv';
  id: number;
  autoPlay?: boolean;
}

const TitlePage: React.FC<TitlePageProps> = ({ mediaType, id, autoPlay }) => {
  const { data, error, reload } = useCachedData<TitleDetails>(`title:${mediaType}:${id}`, () => getTitleDetails(mediaType, id));
  const { myList, toggleMyListItem, continueWatchingList } = useAppContext();
  const { openPlayer } = usePlayer();
  const [heroLoaded, setHeroLoaded] = useState(false);
  const [trailerOpen, setTrailerOpen] = useState(false);

  const item = useMemo(() => (data ? toSearchResult(data) : null), [data]);
  const recs = useMemo(() => {
    const raw = data?.recommendations?.results?.length ? data.recommendations.results : data?.similar?.results || [];
    return raw
      .filter((r: any) => r.backdrop_path || r.poster_path)
      .slice(0, 18)
      .map((r: any) => ({ ...r, media_type: r.media_type === 'tv' || r.media_type === 'movie' ? r.media_type : mediaType })) as SearchResult[];
  }, [data, mediaType]);

  useEffect(() => {
    if (item) document.title = `${getTitle(item)} — VidFast`;
  }, [item]);

  useEffect(() => {
    if (recs.length) prefetchLogos(recs);
  }, [recs]);

  useEffect(() => {
    if (item && autoPlay) {
      openPlayer(item, { tab: 'watch' });
      navigate(titlePath(item), { replace: true, keepScroll: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item, autoPlay]);

  if (error) {
    return (
      <div className="pt-28">
        <ErrorState title="Title unavailable" message="We couldn't load this title. It may have been removed, or the connection dropped." onRetry={reload} />
      </div>
    );
  }
  if (!data || !item) return <TitleSkeleton />;

  const title = getTitle(item);
  const year = getYear(item);
  const rating = certification(data);
  const length = lengthText(data);
  const logo = pickLogo(data);
  const inList = myList.some((i) => i.media.id === item.id && i.media.media_type === item.media_type);
  const saved = continueWatchingList.find((cw) => cw.media.id === item.id && cw.media.media_type === item.media_type);
  const resumeLabel =
    saved && item.media_type === 'tv' && saved.progress.season && saved.progress.episode ? `Resume S${saved.progress.season}:E${saved.progress.episode}` : saved ? 'Resume' : 'Play';
  const cast = (data.credits?.cast || []).slice(0, 6).map((c) => c.name);
  const genres = (data.genres || []).map((g) => g.name);
  const directors = (data.credits?.crew || []).filter((c) => c.job === 'Director').map((c) => c.name);
  const creators = (data.created_by || []).map((c) => c.name);
  const writers = [...new Set((data.credits?.crew || []).filter((c) => ['Screenplay', 'Writer'].includes(c.job)).map((c) => c.name))].slice(0, 4);
  const trailer =
    data.videos?.results?.find((v) => v.site === 'YouTube' && v.type === 'Trailer' && v.official) ||
    data.videos?.results?.find((v) => v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser'));

  return (
    <div>
      {/* Hero */}
      <section className="relative h-[min(56.25vw,92vh)] min-h-[520px] w-full overflow-hidden bg-black max-sm:h-[118vw] max-sm:min-h-0">
        {data.backdrop_path && (
          <img
            src={tmdbImage(data.backdrop_path, 'w1280') || ''}
            srcSet={`${tmdbImage(data.backdrop_path, 'w780')} 780w, ${tmdbImage(data.backdrop_path, 'w1280')} 1280w`}
            sizes="100vw"
            alt=""
            fetchPriority="high"
            onLoad={() => setHeroLoaded(true)}
            className={`absolute inset-0 h-full w-full object-cover object-[center_20%] transition-opacity duration-700 ${heroLoaded ? 'opacity-100' : 'opacity-0'}`}
          />
        )}
        <div className="nf-billboard-vignette" />

        <button
          type="button"
          onClick={() => goBack('/')}
          aria-label="Back"
          className="nf-circle absolute left-[4%] top-[5.4rem] z-[4] text-base max-sm:top-[4.8rem]"
        >
          <ChevronLeftIcon className="h-5 w-5" />
        </button>

        <div className="absolute bottom-[12%] left-[4%] z-[3] w-[min(46%,720px)] animate-fade-in-up max-sm:bottom-[7%] max-sm:left-[6%] max-sm:right-[6%] max-sm:w-auto max-sm:text-center">
          <div className="mb-[1.4vw] max-sm:mb-4">
            {logo ? (
              <img
                src={tmdbImage(logo.file_path, 'w780') || ''}
                alt={title}
                className={`max-w-[85%] object-contain object-left drop-shadow-[0_4px_24px_rgba(0,0,0,0.5)] max-sm:mx-auto max-sm:object-center ${
                  logo.aspect_ratio < 1.8 ? 'max-h-[clamp(100px,14vw,260px)]' : 'max-h-[clamp(70px,9.5vw,180px)]'
                }`}
              />
            ) : (
              <h1 className="text-[clamp(2.2rem,4.8vw,5.5rem)] font-black leading-[0.95] tracking-[-0.03em] text-white text-shadow-netflix">{title}</h1>
            )}
            {logo && <h1 className="sr-only">{title}</h1>}
          </div>

          <div className="mb-[1.4vw] flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[max(14px,1.1vw)] font-medium text-white text-shadow-netflix max-sm:mb-4 max-sm:justify-center">
            <ImdbRating item={item} size="lg" showVotes />
            {year && <span>{year}</span>}
            {rating && <span className="border border-white/50 px-[0.4em] text-[0.85em] leading-[1.5]">{rating}</span>}
            {length && <span>{length}</span>}
            <span className="rounded-[3px] border border-white/60 px-1 text-[0.7em] font-bold leading-[1.5]">HD</span>
          </div>

          <div className="flex flex-wrap items-center gap-[0.7vw] max-sm:justify-center max-sm:gap-2.5">
            <button type="button" className="nf-btn nf-btn-white" onClick={() => openPlayer(item, { progress: saved?.progress, tab: 'watch' })}>
              <PlayIcon />
              {resumeLabel}
            </button>
            <button type="button" className="nf-btn nf-btn-grey" onClick={() => openPlayer(item, { progress: saved?.progress, tab: item.media_type === 'tv' ? 'episodes' : 'actions' })}>
              <LinkIcon />
              Get Link
            </button>
            <button
              type="button"
              className="nf-circle text-[max(15px,1.2vw)]"
              onClick={() => toggleMyListItem(item)}
              aria-pressed={inList}
              aria-label={inList ? 'Remove from My List' : 'Add to My List'}
              title={inList ? 'Remove from My List' : 'Add to My List'}
            >
              {inList ? <CheckStaticIcon className="h-[1.1em] w-[1.1em]" /> : <PlusIcon className="h-[1.2em] w-[1.2em]" />}
            </button>
            {trailer && (
              <button type="button" className="nf-circle text-[max(15px,1.2vw)]" onClick={() => setTrailerOpen(true)} aria-label="Watch trailer" title="Trailer">
                <FilmIcon className="h-[1.05em] w-[1.05em]" />
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Synopsis + credits */}
      <section className="relative z-[3] grid gap-[3vw] px-[4%] pb-[1vw] pt-[1.5vw] md:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)]">
        <div>
          {data.tagline && <p className="mb-2 text-[max(15px,1.1vw)] italic text-netflix-muted">{data.tagline}</p>}
          <p className="text-[max(15px,1.15vw)] leading-[1.5] text-white">{data.overview}</p>
        </div>
        <div className="space-y-2 text-[max(14px,0.95vw)]">
          <Credits label="Cast" items={cast.slice(0, 4)} />
          <Credits label="Genres" items={genres} />
          <Credits label={item.media_type === 'tv' ? 'Creators' : 'Director'} items={item.media_type === 'tv' ? creators : directors} />
        </div>
      </section>

      {item.media_type === 'tv' && <EpisodeList item={item} seasons={data.seasons} savedProgress={saved?.progress} />}

      {recs.length > 0 && (
        <section className="px-[4%] pb-[1vw] pt-[3vw]" aria-labelledby="more-like-this">
          <h2 id="more-like-this" className="mb-[1.2vw] text-[clamp(1.3rem,1.8vw,1.9rem)] font-bold tracking-[-0.01em] text-white">
            More Like This
          </h2>
          <div className="grid grid-cols-2 gap-x-[0.4vw] gap-y-[2.2vw] sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 max-sm:gap-x-1.5 max-sm:gap-y-4">
            {recs.map((r) => (
              <div key={`${r.media_type}-${r.id}`}>
                <ResultCard item={r} />
                <p className="mt-1.5 flex items-center gap-2 text-[12px] text-netflix-muted">
                  <ImdbRating item={r} size="sm" />
                  <span>{getYear(r)}</span>
                  <span className="border border-white/30 px-1 text-[10px] leading-4">{r.media_type === 'movie' ? 'Movie' : 'Series'}</span>
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* About */}
      <section className="mx-[4%] mt-[2vw] border-t border-white/10 pt-[2vw] text-[max(14px,0.95vw)]">
        <h2 className="mb-3 text-[clamp(1.2rem,1.6vw,1.7rem)] text-white">
          <span className="font-light">About </span>
          <span className="font-bold">{title}</span>
        </h2>
        <div className="space-y-2">
          <Credits label={item.media_type === 'tv' ? 'Creators' : 'Director'} items={item.media_type === 'tv' ? creators : directors} />
          <Credits label="Cast" items={cast} />
          <Credits label="Writer" items={writers} />
          <Credits label="Genres" items={genres} />
          {rating && <Credits label="Maturity rating" items={[rating]} />}
        </div>
      </section>

      {trailerOpen && trailer && <TrailerOverlay videoKey={trailer.key} title={title} onClose={() => setTrailerOpen(false)} />}
    </div>
  );
};

export default TitlePage;
