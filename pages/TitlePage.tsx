import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { SearchResult, SeasonDetails, WatchProgress } from '../types';
import { getTitleDetails, getSeasonDetails, TitleDetails } from '../services/tmdb';
import { useCachedData } from '../utils/useCachedData';
import { useAppContext } from '../contexts/AppContext';
import { usePlayer } from '../contexts/PlayerContext';
import { getTitle, getYear, tmdbImage, titlePath, watchPath } from '../utils/media';
import { ImdbRating } from '../components/Imdb';
import { CardLogo } from '../components/ResultCard';
import ErrorState from '../components/ErrorState';
import Overlay from '../components/Overlay';
import { prefetchLogos } from '../utils/artwork';
import { Link, navigate, readEntryState, saveEntryState, useCloseOnBack } from '../utils/router';
import { personPath } from '../utils/person';
import { takeTitleOrigin } from '../utils/motion';
import { PlayIcon, PlusIcon, CheckStaticIcon, LinkIcon, CloseIcon, ChevronDownIcon } from '../components/Icons';
import { useTrailer } from '../utils/trailer';
import { holdPreviews, PREVIEW_LEVEL, PREVIEWS_SAVE_DATA, useAutoplayPreviews, usePageHidden, usePreviewMuted, usePreviewsBlocked } from '../utils/previews';
import { PreviewReplayButton, PreviewSoundButton, TrailerFrame, type TrailerPhase, useArmAfter } from '../components/TrailerPreview';
import { QualityPill } from '../components/ReleaseBadge';
import { comingDate, loadReleases, releaseOf, seedRelease, useRelease, useReleaseVersion } from '../utils/release';

/** The hero picture shows this long before the trailer fades in behind the logo and buttons. */
const TRAILER_DELAY_MS = 0;  // starts loading at once; it plays hidden for its first ~4s (see TrailerFrame)

/**
 * Netflix-style title window ("jbv" modal): opens over the page you were browsing.
 * Hero + Play/Resume, details, Episodes, More Like This, Trailers & More, About (with photos).
 */

/* ---------------------------------------------------------------- helpers */

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

const hm = (m?: number) => (m ? (m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`) : '');

const lengthText = (d: TitleDetails) => {
  if (d.media_type === 'movie') return hm(d.runtime);
  if (d.number_of_seasons && d.number_of_seasons > 1) return `${d.number_of_seasons} Seasons`;
  return d.number_of_episodes ? `${d.number_of_episodes} Episodes` : '';
};

const mins = (s?: number) => Math.max(1, Math.round((s || 0) / 60));
const progressText = (p?: WatchProgress) => (p?.watched && p.duration ? `${mins(p.watched)} of ${mins(p.duration)}m` : '');
const progressPct = (p?: WatchProgress) => (p?.watched && p.duration ? Math.min(100, Math.max(2, (p.watched / p.duration) * 100)) : null);

const uniqPeople = <T extends { id: number }>(list: T[]) => {
  const seen = new Set<number>();
  return list.filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true)));
};

const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

interface Person {
  id: number;
  name: string;
  profile_path?: string | null;
  sub?: string;
  /** Short character name for the cast line ("Lola Tung as Belly"). */
  role?: string;
  /** Custom link (genres); people link to their person page. */
  to?: string;
}

/** The short name a character goes by, for "Lola Tung as Belly, Christopher Briney as Conrad":
 *  a nickname in quotes ("Isabel 'Belly' Conklin" -> Belly, but not "'The Halfman'"), else the first name
 *  ("Conrad Fisher" -> Conrad).
 *  Titles and descriptions stay whole ("Dr. Strange", "Young Belly", "The Narrator"). */
const TITLE_WORD = /^(dr|mr|mrs|ms|miss|mx|prof|professor|sir|dame|lady|lord|king|queen|prince|princess|captain|capt|agent|detective|det|officer|sergeant|sgt|general|gen|colonel|col|major|lieutenant|lt|commander|admiral|father|mother|sister|brother|uncle|aunt|young|old|little|baby|big|the|a|an|saint|st|judge|coach|nurse|doctor|president|senator|chief|sheriff|deputy|grandma|grandpa|mama|papa|count|duke|baron|reverend|rev|officer)\.?$/i;
const NAME_PARTICLE = /^(de|da|del|della|di|du|van|von|der|den|la|le|bin|al|el|mac|mc|o)$/i;
const shortRole = (character?: string | null): string => {
  if (!character) return '';
  let c = character.split(/\s+\/\s+|;/)[0];
  c = c.replace(/\s*\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
  if (!c) return '';
  if (/^(self|himself|herself|themselves|themself)\b/i.test(c)) return 'Self';
  const nick = c.match(/["\u201c]([^"\u201d]{2,24})["\u201d]/) || c.match(/(?:^|\s)['\u2018]([^'\u2019]{2,24})['\u2019](?:\s|$)/);
  // A nickname that is a title ("Tyrion 'The Halfman' Lannister") isn't what people call them: use the first name.
  if (nick && !/^the\s/i.test(nick[1].trim())) return nick[1].trim();
  // Drop a quoted nickname before taking the first name (only real quotes, not the apostrophe in "O'Brien").
  const plain = c.replace(/["\u201c][^"\u201d]{2,24}["\u201d]/g, ' ').replace(/(^|\s)['\u2018][^'\u2019]{2,24}['\u2019](?=\s|$)/g, ' ').replace(/\s+/g, ' ').trim() || c;
  const words = plain.split(' ');
  if (words.length === 1) return words[0];
  if (TITLE_WORD.test(words[0])) return words.slice(0, 3).join(' ');
  if (words.every((w) => /^[A-Z\u00c0-\u024f]/.test(w) || NAME_PARTICLE.test(w))) return words[0];
  return c.length > 28 ? `${c.slice(0, 26).trim()}\u2026` : c;
};

/* ---------------------------------------------------------------- small pieces */

/** "Cast: A, B, C, more" — Netflix's plain-text credit line. */
const TextCredits: React.FC<{ label: string; items: (string | Person)[]; onMore?: () => void }> = ({ label, items, onMore }) =>
  items.length ? (
    <p className="leading-[1.45]">
      <span className="text-[#777]">{label}: </span>
      {items.map((it, i) => (
        <React.Fragment key={typeof it === 'string' ? it : it.id}>
          {i > 0 && <span className="text-[#ddd]">, </span>}
          {typeof it === 'string' ? (
            <span className="text-[#ddd]">{it}</span>
          ) : (
            // "Name as Role" stays on one line (it used to break between first and last name).
            <span className="inline-block max-w-full overflow-hidden text-ellipsis whitespace-nowrap align-bottom">
              <Link to={it.to || personPath(it)} className="text-[#ddd] transition-colors hover:text-white hover:underline">
                {it.name}
              </Link>
              {it.role && <span className="text-[#a3a3a3]"> as {it.role}</span>}
            </span>
          )}
        </React.Fragment>
      ))}
      {onMore && (
        <>
          <span className="text-[#ddd]">, </span>
          <button type="button" onClick={onMore} className="italic text-[#ddd] hover:text-white hover:underline">
            more
          </button>
        </>
      )}
    </p>
  ) : null;

/** About section line with a small round photo beside every name. */
const PeopleCredits: React.FC<{ label: string; people: Person[] }> = ({ label, people }) =>
  people.length ? (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-3">
      <span className="flex-shrink-0 pt-[7px] text-[#777] sm:w-[7.5rem]">{label}:</span>
      <div className="flex flex-wrap gap-2">
        {people.map((p) => (
          <Link key={`${p.id}-${p.sub || ''}`} to={personPath(p)} className="nf-chip">
            <span className="nf-chip-img">
              {p.profile_path ? <img src={tmdbImage(p.profile_path, 'w185') || ''} alt="" loading="lazy" decoding="async" /> : initials(p.name)}
            </span>
            <span className="truncate">{p.name}</span>
          </Link>
        ))}
      </div>
    </div>
  ) : null;

const ExpandToggle: React.FC<{ open: boolean; onToggle: () => void; label: string }> = ({ open, onToggle, label }) => (
  <div className="relative mt-2 flex h-[2px] items-center justify-center bg-[#404040]">
    <span className="absolute top-1/2 -translate-y-1/2">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-label={open ? `Show fewer ${label}` : `Show more ${label}`}
        className="nf-circle !bg-[#2a2a2a] text-[15px]"
      >
        <ChevronDownIcon className={`h-[1.2em] w-[1.2em] transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
      </button>
    </span>
  </div>
);

const TrailerOverlay: React.FC<{ videoKey: string; title: string; onClose: () => void }> = ({ videoKey, title, onClose }) => {
  useCloseOnBack(true, onClose);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);
  return (
    <Overlay>
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 p-4 animate-fade-in-fast" onClick={onClose} role="dialog" aria-modal="true" aria-label={`${title} video`}>
      <div className="relative aspect-video w-full max-w-5xl overflow-hidden rounded-md bg-black shadow-2xl animate-zoom-in" onClick={(e) => e.stopPropagation()}>
        <iframe
          className="absolute inset-0 h-full w-full"
          src={`https://www.youtube-nocookie.com/embed/${videoKey}?autoplay=1&rel=0&modestbranding=1`}
          title={`${title} video`}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
        />
        <button type="button" onClick={onClose} className="nf-circle absolute right-3 top-3 z-10 text-base" aria-label="Close video">
          <CloseIcon className="h-5 w-5" />
        </button>
      </div>
    </div>
    </Overlay>
  );
};

/* ---------------------------------------------------------------- episodes */

const Episodes: React.FC<{ item: SearchResult; seasons: TitleDetails['seasons']; saved?: WatchProgress; showTitle: string }> = ({ item, seasons, saved, showTitle }) => {
  const { openPlayer } = usePlayer();
  const options = useMemo(() => {
    const all = seasons || [];
    const regular = all.filter((s) => s.season_number > 0 && s.episode_count > 0);
    return regular.length ? regular : all;
  }, [seasons]);
  // The season you picked and "show all episodes" are kept on this history step, so coming Back
  // (from a person page, the player…) shows the same season again.
  const [season, setSeason] = useState<number>(() => {
    const kept = readEntryState<number>('tSeason');
    if (typeof kept === 'number' && options.some((s) => s.season_number === kept)) return kept;
    return saved?.season && options.some((s) => s.season_number === saved.season) ? saved.season : options[0]?.season_number ?? 1;
  });
  const [open, setOpen] = useState(() => readEntryState<boolean>('tEpsAll') === true);
  const { data, error, reload } = useCachedData<SeasonDetails>(`season:${item.id}:${season}`, () => getSeasonDetails(item.id, season));
  const episodes = data?.episodes || [];
  const shown = open ? episodes : episodes.slice(0, 10);
  if (!options.length) return null;

  return (
    <section className="px-[5%] pt-8" aria-labelledby="nf-episodes">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 id="nf-episodes" className="text-[24px] font-bold text-white">Episodes</h3>
        {options.length > 1 ? (
          <select value={season} onChange={(e) => { const s = Number(e.target.value); setSeason(s); setOpen(false); saveEntryState({ tSeason: s, tEpsAll: false }); }} aria-label="Season" className="nf-season-select">
            {options.map((s) => (
              <option key={s.season_number} value={s.season_number}>
                {s.name} ({s.episode_count} Episodes)
              </option>
            ))}
          </select>
        ) : (
          <span className="text-[18px] text-white">{showTitle}</span>
        )}
      </div>

      {error ? (
        <button type="button" onClick={reload} className="py-6 text-[#bcbcbc] underline">Couldn't load episodes. Tap to retry.</button>
      ) : !data ? (
        <div className="space-y-2" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => <div key={i} className="nf-skel h-[104px] w-full" style={{ ['--i' as any]: i }} />)}
        </div>
      ) : (
        <ol>
          {shown.map((ep) => {
            const isCur = saved?.season === season && saved?.episode === ep.episode_number;
            const pct = isCur ? progressPct(saved) : null;
            const still = tmdbImage(ep.still_path, 'w300');
            const runtime = (ep as any).runtime as number | undefined;
            return (
              <li key={ep.id} className="border-b border-[#404040] last:border-b-0">
                <button
                  type="button"
                  onClick={() => openPlayer(item, { tab: 'watch', progress: isCur ? saved : { season, episode: ep.episode_number } })}
                  className={`group/ep grid w-full grid-cols-[8rem_1fr] items-center gap-4 rounded-[4px] px-3 py-5 text-left transition-colors hover:bg-white/[0.05] sm:grid-cols-[2.5rem_9.5rem_1fr] sm:px-5 ${isCur ? '!bg-[#333]' : ''}`}
                  aria-label={`Play episode ${ep.episode_number}: ${ep.name}`}
                >
                  <span className="hidden text-center text-[24px] text-[#d2d2d2] sm:block">{ep.episode_number}</span>
                  <span className="relative block aspect-video overflow-hidden rounded-[4px] bg-[#232323]">
                    {still && <img src={still} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" />}
                    <span className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-200 group-hover/ep:opacity-100">
                      <span className="flex h-10 w-10 items-center justify-center rounded-full border border-white bg-black/50">
                        <PlayIcon className="ml-0.5 h-4 w-4 text-white" />
                      </span>
                    </span>
                    {pct !== null && (
                      <span className="absolute inset-x-[6%] bottom-[8%] h-[3px] bg-[#4d4d4d]">
                        <span className="block h-full bg-netflix-red" style={{ width: `${pct}%` }} />
                      </span>
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="truncate text-[16px] font-bold text-white">
                        <span className="sm:hidden">{ep.episode_number}. </span>
                        {ep.name}
                      </span>
                      {runtime ? <span className="flex-shrink-0 text-[15px] text-white">{hm(runtime)}</span> : null}
                    </span>
                    <span className="mt-1.5 overflow-hidden text-[14px] leading-[1.45] text-[#d2d2d2] [-webkit-box-orient:vertical] [-webkit-line-clamp:3] [display:-webkit-box]">
                      {ep.overview || 'No description available.'}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      )}
      {episodes.length > 10 && <ExpandToggle open={open} onToggle={() => { saveEntryState({ tEpsAll: !open }); setOpen(!open); }} label="episodes" />}
    </section>
  );
};

/* ---------------------------------------------------------------- more like this */

const MoreCard: React.FC<{ r: SearchResult }> = ({ r }) => {
  const { myList, toggleMyListItem } = useAppContext();
  const inList = myList.some((i) => i.media.id === r.id && i.media.media_type === r.media_type);
  const img = tmdbImage(r.backdrop_path, 'w500') || tmdbImage(r.poster_path, 'w500');
  const title = getTitle(r);
  return (
    <div className="group/mc relative overflow-hidden rounded-[4px] bg-[#2f2f2f] transition-colors hover:bg-[#383838] has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-white">
      {/* A real link covering the whole card; the My List button sits above it (not inside it). */}
      <Link to={titlePath(r)} aria-label={title} className="absolute inset-0 z-[1] outline-none" />
      <div className="relative aspect-video overflow-hidden bg-[#232323]">
        {img && <img src={img} alt="" loading="lazy" decoding="async" className={`absolute inset-0 h-full w-full object-cover ${r.backdrop_path ? '' : 'object-[center_25%]'}`} />}
        <span className="nf-card-shade" />
        <CardLogo item={r} />
      </div>
      <div className="p-[0.9rem]">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 text-[12px] text-[#bcbcbc]">
              <ImdbRating item={r} size="sm" />
              <span className="border border-white/40 px-1 leading-[1.5]">{r.media_type === 'movie' ? 'Movie' : 'Series'}</span>
              <QualityPill item={r} className="rounded-[3px] border border-white/40 px-1 text-[10px] font-bold leading-[1.6]" />
            </div>
            {getYear(r) && <p className="mt-1 text-[15px] text-white">{getYear(r)}</p>}
          </div>
          <button
            type="button"
            className="nf-circle relative z-[2] flex-shrink-0 text-[14px]"
            onClick={() => toggleMyListItem(r)}
            aria-pressed={inList}
            aria-label={inList ? `Remove ${title} from My List` : `Add ${title} to My List`}
          >
            {inList ? <CheckStaticIcon className="h-[1em] w-[1em]" /> : <PlusIcon className="h-[1.1em] w-[1.1em]" />}
          </button>
        </div>
        <p className="mt-3 overflow-hidden text-[13px] leading-[1.45] text-[#d2d2d2] [-webkit-box-orient:vertical] [-webkit-line-clamp:5] [display:-webkit-box]">
          {r.overview || 'No description available.'}
        </p>
      </div>
    </div>
  );
};

/* ---------------------------------------------------------------- content */

const TitleSkeleton: React.FC = () => (
  <div aria-hidden="true">
    <div className="nf-skel aspect-video w-full rounded-none opacity-60" />
    <div className="space-y-3 px-[5%] py-6">
      <div className="nf-skel h-4 w-1/3" />
      <div className="nf-skel h-4 w-2/3" style={{ ['--i' as any]: 1 }} />
      <div className="nf-skel h-4 w-1/2" style={{ ['--i' as any]: 2 }} />
    </div>
  </div>
);

const TitleContent: React.FC<{ mediaType: 'movie' | 'tv'; id: number; autoPlay?: boolean; closing?: boolean; scrollTo: (elId: string) => void; onReady?: () => void }> = ({ mediaType, id, autoPlay, closing, scrollTo, onReady }) => {
  const { data, error, reload } = useCachedData<TitleDetails>(`title:${mediaType}:${id}`, () => getTitleDetails(mediaType, id));
  const hasData = !!data;
  useEffect(() => {
    if (hasData) onReady?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasData]);
  const { myList, toggleMyListItem, continueWatchingList } = useAppContext();
  const { openPlayer } = usePlayer();
  const [heroLoaded, setHeroLoaded] = useState(false);
  const [video, setVideo] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(() => readEntryState<boolean>('tMore') === true);

  const item = useMemo(() => (data ? toSearchResult(data) : null), [data]);
  // The title window already has this movie's release dates: they decide coming soon / CAM / HD.
  useEffect(() => {
    if (data && mediaType === 'movie') seedRelease(id, (data as any).release_dates?.results);
  }, [data, mediaType, id]);
  const release = useRelease(item);
  const saved = continueWatchingList.find((cw) => cw.media.id === id && cw.media.media_type === mediaType);
  const allRecs = useMemo(() => {
    const raw = data?.recommendations?.results?.length ? data.recommendations.results : data?.similar?.results || [];
    return raw
      .filter((r: any) => r.backdrop_path || r.poster_path)
      .slice(0, 18)
      .map((r: any) => ({ ...r, media_type: r.media_type === 'tv' || r.media_type === 'movie' ? r.media_type : mediaType })) as SearchResult[];
  }, [data, mediaType]);
  // More Like This leaves out titles that aren't out yet (they're in Coming Soon).
  useReleaseVersion();
  useEffect(() => {
    void loadReleases(allRecs);
  }, [allRecs]);
  const recs = allRecs.filter((r) => releaseOf(r) !== 'soon');

  // Current episode name + synopsis for a show you're part-way through.
  const curSeason = mediaType === 'tv' && saved?.progress.season ? saved.progress.season : undefined;
  const seasonData = useCachedData<SeasonDetails>(curSeason ? `season:${id}:${curSeason}` : null, () => getSeasonDetails(id, curSeason!));
  const curEpisode = curSeason ? seasonData.data?.episodes?.find((e) => e.episode_number === saved?.progress.episode) : undefined;

  useEffect(() => {
    if (item) document.title = `${getTitle(item)} — StreamFast`;
  }, [item]);
  useEffect(() => {
    if (allRecs.length) prefetchLogos(allRecs);
  }, [allRecs]);
  useEffect(() => {
    if (item && autoPlay && releaseOf(item) !== 'soon') navigate(watchPath(item, saved?.progress), { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item, autoPlay]);

  /* ---- trailer preview in the hero (behind the logo and buttons) ---- */
  const [autoplayPreviews] = useAutoplayPreviews();
  const [muted, setMuted] = usePreviewMuted();
  const blocked = usePreviewsBlocked(PREVIEW_LEVEL.window);
  const tabHidden = usePageHidden();
  const previewsOn = autoplayPreviews && !PREVIEWS_SAVE_DATA && !autoPlay;
  const trailer = useTrailer(item, previewsOn);
  const heroRef = useRef<HTMLDivElement>(null);
  // Scrolled down past the hero (inside the window): the trailer pauses.
  const [heroInView, setHeroInView] = useState(true);
  useEffect(() => {
    const el = heroRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      (entries) => {
        const e = entries[entries.length - 1];
        if (e) setHeroInView(e.isIntersecting && e.intersectionRatio >= 0.3);
      },
      { threshold: [0, 0.3, 0.6] }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasData]);
  const heroReady = heroLoaded || (!!data && !data.backdrop_path);
  // Paused while the trailer / Get Link / another dialog is open over the window, or the window is closing.
  const canPlay = previewsOn && !blocked && !tabHidden && heroInView && !video && !closing;
  const armed = useArmAfter(trailer ? `${mediaType}-${id}` : null, TRAILER_DELAY_MS, canPlay && heroReady);
  const [replay, setReplay] = useState(0);
  const [phaseOf, setPhaseOf] = useState<{ run: number; phase: TrailerPhase } | null>(null);
  const phase: TrailerPhase = phaseOf && phaseOf.run === replay ? phaseOf.phase : 'loading';
  const showTrailer = armed && previewsOn && !!trailer;
  const trailerPlaying = showTrailer && phase === 'playing' && canPlay;

  if (error) {
    return (
      <div className="px-[5%] py-16">
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
  const pct = progressPct(saved?.progress);
  const pText = progressText(saved?.progress);
  const genres: Person[] = (data.genres || []).map((g) => ({ id: g.id, name: g.name, to: `/browse?type=${mediaType}&genre=${g.id}` }));

  const crew = data.credits?.crew || [];
  const byJobs = (jobs: string[], n = 6): Person[] =>
    uniqPeople(crew.filter((c) => jobs.includes(c.job))).slice(0, n).map((c) => ({ id: c.id, name: c.name, profile_path: c.profile_path, sub: c.job }));
  const cast: Person[] = uniqPeople(data.credits?.cast || []).slice(0, 15).map((c) => ({ id: c.id, name: c.name, profile_path: c.profile_path, sub: c.character ? `as ${c.character}` : undefined, role: shortRole(c.character) || undefined }));
  const directors = byJobs(['Director']);
  const creators: Person[] = (data.created_by || []).map((c) => ({ id: c.id, name: c.name, profile_path: c.profile_path, sub: 'Creator' }));
  const writers = byJobs(['Screenplay', 'Writer', 'Novel', 'Story', 'Teleplay'], 5);
  const producers = byJobs(['Producer', 'Executive Producer'], 5);
  const composers = byJobs(['Original Music Composer', 'Music', 'Composer'], 3);
  const dop = byJobs(['Director of Photography', 'Cinematography'], 3);

  const videos = (data.videos?.results || [])
    .filter((v) => v.site === 'YouTube')
    .sort((a, b) => Number(b.type === 'Trailer') - Number(a.type === 'Trailer') || Number(!!b.official) - Number(!!a.official))
    .slice(0, 6);

  const playLabel = saved ? 'Resume' : 'Play';
  const shownRecs = moreOpen ? recs : recs.slice(0, 9);

  return (
    <>
      {/* ---- hero ---- */}
      <div ref={heroRef} className="relative aspect-video w-full overflow-hidden bg-black">
        {data.backdrop_path && (
          <img
            src={tmdbImage(data.backdrop_path, 'w1280') || ''}
            alt=""
            fetchPriority="high"
            decoding="async"
            onLoad={() => setHeroLoaded(true)}
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${heroLoaded ? 'opacity-100' : 'opacity-0'}`}
          />
        )}
        {showTrailer && trailer && (
          <TrailerFrame
            key={`${trailer}-${replay}`}
            videoKey={trailer}
            play={canPlay}
            muted={muted}
            title={`${title} trailer`}
            onPhase={(p) => setPhaseOf({ run: replay, phase: p })}
            onSoundBlocked={() => setMuted(true)}
          />
        )}
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(0deg,#181818_0%,rgba(24,24,24,0.55)_22%,rgba(24,24,24,0)_50%)]" />
        <div className="absolute inset-x-[5%] bottom-[7%] z-[2]">
          <div className={`sf-rise sf-title-logo mb-[4%] w-[min(42%,380px)] max-sm:w-[60%] ${trailerPlaying ? 'is-small' : ''}`}>
            {logo ? (
              <img
                src={tmdbImage(logo.file_path, 'w500') || ''}
                alt={title}
                decoding="async"
                className={`w-full object-contain object-left drop-shadow-[0_2px_14px_rgba(0,0,0,0.55)] ${logo.aspect_ratio < 1.8 ? 'max-h-[clamp(70px,12vw,170px)]' : 'max-h-[clamp(52px,8vw,120px)]'}`}
              />
            ) : (
              <h2 className="text-[clamp(1.6rem,4vw,2.8rem)] font-black leading-[1] tracking-[-0.02em] text-white text-shadow-netflix">{title}</h2>
            )}
          </div>
          {pct !== null && (
            <div className="mb-3 flex w-[min(100%,360px)] items-center gap-3">
              <div className="h-[3px] flex-1 bg-[#4d4d4d]" aria-hidden="true">
                <div className="h-full bg-netflix-red" style={{ width: `${pct}%` }} />
              </div>
              <span className="flex-shrink-0 text-[13px] text-[#ddd]">{pText}</span>
            </div>
          )}
          <div className="sf-rise flex flex-wrap items-center gap-2" style={{ ['--d' as any]: 1 }}>
            {release === 'soon' ? (
              // Not out yet: its date instead of Play (adding it to My List gets a bell alert when it's out).
              <span className="nf-btn nf-btn-white !h-[2.6rem] cursor-default !px-6 !text-[16px] opacity-90">
                {comingDate(item) ? `Coming ${comingDate(item)}` : 'Coming soon'}
              </span>
            ) : (
              <button type="button" className="nf-btn nf-btn-white !h-[2.6rem] !px-6 !text-[16px]" onClick={() => openPlayer(item, { tab: 'watch', progress: saved?.progress })}>
                <PlayIcon />
                {playLabel}
              </button>
            )}
            <button
              type="button"
              className="nf-circle text-[16px]"
              onClick={() => toggleMyListItem(item)}
              aria-pressed={inList}
              aria-label={inList ? 'Remove from My List' : 'Add to My List'}
            >
              {inList ? <CheckStaticIcon className="h-[1.1em] w-[1.1em]" /> : <PlusIcon className="h-[1.2em] w-[1.2em]" />}
            </button>
            {release !== 'soon' && (
              <button
                type="button"
                className="nf-circle text-[16px]"
                onClick={() => openPlayer(item, { progress: saved?.progress, tab: item.media_type === 'tv' ? 'episodes' : 'actions' })}
                aria-label="Get Link"
              >
                <LinkIcon className="h-[1.05em] w-[1.05em]" />
              </button>
            )}
          </div>
        </div>
        {showTrailer && (trailerPlaying || phase === 'ended') && (
          <div className="absolute bottom-[7%] right-[5%] z-[3] text-[13px] sm:text-[15px]">
            {phase === 'ended' ? (
              <PreviewReplayButton key="replay" className="sf-pop-in" onReplay={() => setReplay((r) => r + 1)} />
            ) : (
              <PreviewSoundButton key="sound" className="sf-pop-in" muted={muted} onToggle={() => setMuted(!muted)} />
            )}
          </div>
        )}
      </div>

      {/* ---- details ---- */}
      <div className="sf-rise grid gap-x-8 gap-y-5 px-[5%] pb-2 pt-1 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]" style={{ ['--d' as any]: 2 }}>
        <div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[15px] text-[#bcbcbc]">
            <ImdbRating item={item} size="sm" />
            {year && <span>{year}</span>}
            {length && <span>{length}</span>}
            <QualityPill item={item} className="rounded-[3px] border border-white/40 px-1 text-[11px] font-bold leading-[1.5]" />
          </div>
          {rating && (
            <div className="mt-1.5 text-[14px]">
              <span className="border border-white/40 px-1.5 py-px text-[12px] text-white">{rating}</span>
            </div>
          )}
          {curEpisode ? (
            <>
              <p className="mt-5 text-[17px] font-bold text-white">
                S{saved!.progress.season}:E{saved!.progress.episode} “{curEpisode.name}”
              </p>
              <p className="mt-2 text-[15px] leading-[1.55] text-white">{curEpisode.overview || data.overview}</p>
            </>
          ) : (
            <p className="mt-5 text-[15px] leading-[1.55] text-white">{data.overview}</p>
          )}
        </div>
        <div className="space-y-3 text-[14px]">
          <TextCredits label="Cast" items={cast.slice(0, 3)} onMore={cast.length > 3 ? () => scrollTo('nf-about') : undefined} />
          <TextCredits label="Genres" items={genres.slice(0, 3)} />
          <TextCredits label={item.media_type === 'tv' ? 'Creators' : 'Director'} items={item.media_type === 'tv' ? creators.slice(0, 2) : directors.slice(0, 2)} />
        </div>
      </div>

      {/* ---- episodes ---- */}
      {item.media_type === 'tv' && <Episodes item={item} seasons={data.seasons} saved={saved?.progress} showTitle={title} />}

      {/* ---- more like this ---- */}
      {recs.length > 0 && (
        <section className="px-[5%] pt-10" aria-labelledby="nf-more">
          <h3 id="nf-more" className="mb-5 text-[24px] font-bold text-white">More Like This</h3>
          <div className="grid grid-cols-2 gap-[1em] sm:grid-cols-3">
            {shownRecs.map((r) => <MoreCard key={`${r.media_type}-${r.id}`} r={r} />)}
          </div>
          {recs.length > 9 && <ExpandToggle open={moreOpen} onToggle={() => { saveEntryState({ tMore: !moreOpen }); setMoreOpen(!moreOpen); }} label="titles" />}
        </section>
      )}

      {/* ---- trailers & more ---- */}
      {videos.length > 0 && (
        <section className="px-[5%] pt-10" aria-labelledby="nf-videos">
          <h3 id="nf-videos" className="mb-5 text-[24px] font-bold text-white">Trailers &amp; More</h3>
          <div className="grid grid-cols-2 gap-[1em] sm:grid-cols-3">
            {videos.map((v) => (
              <button key={v.key} type="button" onClick={() => setVideo(v.key)} className="group/v text-left" aria-label={`Play ${v.name}`}>
                <span className="relative block aspect-video overflow-hidden rounded-[4px] bg-[#232323]">
                  <img src={`https://i.ytimg.com/vi/${v.key}/hqdefault.jpg`} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full scale-[1.34] object-cover" />
                  <span className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition duration-200 group-hover/v:bg-black/25 group-hover/v:opacity-100">
                    <span className="flex h-11 w-11 items-center justify-center rounded-full border border-white bg-black/50">
                      <PlayIcon className="ml-0.5 h-4 w-4 text-white" />
                    </span>
                  </span>
                </span>
                <span className="mt-2 block truncate text-[14px] font-medium text-white">{v.name}</span>
                <span className="block text-[12px] text-[#a3a3a3]">{v.type}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* ---- about ---- */}
      <section id="nf-about" className="px-[5%] pb-10 pt-10" aria-labelledby="nf-about-h">
        <h3 id="nf-about-h" className="mb-5 text-[24px] text-white">
          <span className="font-normal">About </span>
          <span className="font-bold">{title}</span>
        </h3>
        <div className="space-y-4 text-[14px]">
          {item.media_type === 'tv' ? <PeopleCredits label="Creators" people={creators} /> : <PeopleCredits label="Director" people={directors} />}
          <PeopleCredits label="Cast" people={cast} />
          <PeopleCredits label="Writer" people={writers} />
          <PeopleCredits label="Producers" people={producers} />
          <PeopleCredits label="Music" people={composers} />
          <PeopleCredits label="Cinematography" people={dop} />
          <div className="flex flex-col gap-1 sm:flex-row sm:gap-3">
            <span className="flex-shrink-0 text-[#777] sm:w-[7.5rem]">Genres:</span>
            <span className="text-[#ddd]">
              {genres.length
                ? genres.map((g, i) => (
                    <React.Fragment key={g.id}>
                      {i > 0 && ', '}
                      <Link to={g.to!} className="transition-colors hover:text-white hover:underline">{g.name}</Link>
                    </React.Fragment>
                  ))
                : '—'}
            </span>
          </div>
          {rating && (
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
              <span className="flex-shrink-0 text-[#777] sm:w-[7.5rem]">Maturity Rating:</span>
              <span><span className="border border-white/40 px-1.5 py-px text-[12px] text-white">{rating}</span></span>
            </div>
          )}
        </div>
      </section>

      {video && <TrailerOverlay videoKey={video} title={title} onClose={() => setVideo(null)} />}
    </>
  );
};

/* ---------------------------------------------------------------- modal shell */

interface TitlePageProps {
  mediaType: 'movie' | 'tv';
  id: number;
  autoPlay?: boolean;
  onClose: () => void;
}

const TitlePage: React.FC<TitlePageProps> = ({ mediaType, id, autoPlay, onClose }) => {
  const scroller = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  // Opened from a card: the window grows out of that card (and shrinks back into it on close).
  const [origin] = useState(() => takeTitleOrigin());

  // The close animation timer is kept so it can be cancelled if another title opens or the window unmounts.
  const closeTimer = useRef<number | undefined>(undefined);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const close = useCallback(() => {
    if (closing) return;
    setClosing(true);
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => onCloseRef.current(), 200);
  }, [closing]);
  useEffect(() => () => window.clearTimeout(closeTimer.current), []);

  // Trailer previews on the page behind (billboard, hover cards) pause while the window is open.
  useEffect(() => holdPreviews(PREVIEW_LEVEL.page), []);

  // Focus moves into the window when it opens, stays inside while Tab is pressed, and returns on close.
  const modalRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    modalRef.current?.focus({ preventScroll: true });
    const onTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !modalRef.current) return;
      const items = Array.from(
        modalRef.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])')
      ).filter((el) => el.offsetParent !== null);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === modalRef.current)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      } else if (!modalRef.current.contains(active)) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onTab);
    return () => {
      window.removeEventListener('keydown', onTab);
      if (before && document.contains(before)) before.focus?.({ preventScroll: true });
    };
  }, []);

  // Point the grow animation at the card it came from (before the first paint, in the modal's own coordinates).
  useLayoutEffect(() => {
    const modal = modalRef.current;
    const box = scroller.current;
    if (!origin || !modal || !box) return;
    modal.style.transformOrigin = `${Math.round(origin.x - modal.offsetLeft)}px ${Math.round(origin.y - modal.offsetTop + box.scrollTop)}px`;
  }, [origin]);

  useEffect(() => {
    // Two frames, so the start state is painted before the transition begins (smooth on 120 Hz too).
    let raf2 = 0;
    const raf = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setOpen(true));
    });
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = 'hidden';
    return () => {
      cancelAnimationFrame(raf);
      cancelAnimationFrame(raf2);
      html.style.overflow = prev;
    };
  }, []);

  // How far the window is scrolled is kept on its history step: Back (from a person page, the player…)
  // reopens it at the same spot. Opening another title from inside the window starts that one at the top.
  const wantY = useRef(0);
  const restoring = useRef(false);
  const stopRestore = useRef(false);
  const restoreScroll = useCallback(() => {
    const y = wantY.current;
    if (y <= 0) return;
    restoring.current = true;
    stopRestore.current = false;
    let tries = 0;
    const step = () => {
      const box = scroller.current;
      if (!box || stopRestore.current) return void (restoring.current = false);
      box.scrollTop = y;
      // Images and episodes may still be loading in, so try again for a moment until it fits.
      if (Math.abs(box.scrollTop - y) > 2 && ++tries < 30) window.setTimeout(step, 60);
      else restoring.current = false;
    };
    step();
  }, []);
  const saveRaf = useRef(0);
  const onScroll = useCallback(() => {
    if (saveRaf.current || restoring.current) return;
    saveRaf.current = requestAnimationFrame(() => {
      saveRaf.current = 0;
      const box = scroller.current;
      // Only while this title's own step is the current one.
      if (box && !restoring.current && /^\/(?:title\/)?(movie|tv)\/\d+/.test(window.location.pathname)) saveEntryState({ tY: Math.round(box.scrollTop) });
    });
  }, []);
  useEffect(() => () => cancelAnimationFrame(saveRaf.current), []);

  useEffect(() => {
    wantY.current = Number(readEntryState<number>('tY')) || 0;
    scroller.current?.scrollTo({ top: 0 });
    window.clearTimeout(closeTimer.current);
    setClosing(false);
    restoreScroll();
  }, [mediaType, id, restoreScroll]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close]);

  const scrollTo = useCallback((elId: string) => {
    const box = scroller.current;
    const el = document.getElementById(elId);
    if (box && el) box.scrollTo({ top: el.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop - 16, behavior: 'smooth' });
  }, []);

  return (
    <div
      ref={scroller}
      className={`nf-title-overlay ${open && !closing ? 'is-open' : ''}`}
      data-lenis-prevent
      onScroll={onScroll}
      onWheel={() => (stopRestore.current = true)}
      onTouchStart={() => (stopRestore.current = true)}
      onMouseDown={(e) => e.target === e.currentTarget && close()}
    >
      <div ref={modalRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Title details" className={`nf-title-modal outline-none ${origin ? 'is-from-card' : ''}`}>
        <button type="button" onClick={close} className="nf-title-close" aria-label="Close">
          <CloseIcon className="h-5 w-5" />
        </button>
        <TitleContent key={`${mediaType}-${id}`} mediaType={mediaType} id={id} autoPlay={autoPlay} closing={closing} scrollTo={scrollTo} onReady={restoreScroll} />
      </div>
    </div>
  );
};

export default TitlePage;
