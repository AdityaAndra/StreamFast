import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { SearchResult } from '../types';
import { loadCached, useCachedData } from '../utils/useCachedData';
import { tmdbGet } from '../services/tmdb';
import { tmdbImage, titlePath } from '../utils/media';
import { Link, goBack, readEntryState, saveEntryState, useCloseOnBack, useQueryParam } from '../utils/router';
import { scrollToY } from '../utils/smoothScroll';
import ContentCarousel from '../components/ContentCarousel';
import ErrorState from '../components/ErrorState';
import Overlay from '../components/Overlay';
import { ImdbRating } from '../components/Imdb';
import { ChevronLeftIcon, ChevronRightIcon, CloseIcon, PlayIcon, SearchIcon } from '../components/Icons';
import {
  PersonDetails, PersonExtra, CreditRow, CreditSort, CREDIT_SORTS, isCreditSort, getPerson, getPersonExtra, buildRows, deptCounts, sortRows, knownFor,
  deptLabel, creditTitle, creditYear, isUpcoming, fmtDate, ageOf, fmtHeight, buildTrivia,
} from '../utils/person';

type Tab = 'overview' | 'credits' | 'awards' | 'trivia' | 'photos' | 'videos';
type Media = 'all' | 'movie' | 'tv';
const TABS: [Tab, string][] = [
  ['overview', 'Overview'],
  ['credits', 'Credits'],
  ['awards', 'Awards'],
  ['trivia', 'Trivia'],
  ['photos', 'Photos'],
  ['videos', 'Videos'],
];
const PAGE = 40;
/** How many credits the Overview's "Movies & TV Shows" list shows before "All credits". */
const PREVIEW = 10;

/* ---------------- small pieces ---------------- */

const SectionTitle: React.FC<{ children: React.ReactNode; action?: React.ReactNode }> = ({ children, action }) => (
  <div className="mb-[max(12px,1vw)] flex items-end justify-between gap-4">
    <h2 className="text-[max(20px,1.6vw)] font-semibold tracking-[-0.01em] text-white">{children}</h2>
    {action}
  </div>
);

const MoreLink: React.FC<{ onClick: () => void; children: React.ReactNode }> = ({ onClick, children }) => (
  <button type="button" onClick={onClick} className="flex items-center gap-1 text-[max(13px,0.95vw)] font-semibold text-[#54b9c5] hover:underline">
    {children}
    <ChevronRightIcon className="h-4 w-4" />
  </button>
);

const Detail: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) =>
  children ? (
    <div className="grid grid-cols-[minmax(7.5rem,34%)_1fr] gap-3 border-b border-white/[0.07] py-[0.7em] last:border-0">
      <dt className="text-[#8c8c8c]">{label}</dt>
      <dd className="min-w-0 text-[#e5e5e5]">{children}</dd>
    </div>
  ) : null;

const Skeleton: React.FC = () => (
  <div className="px-[4%] pt-28" aria-hidden="true">
    <div className="flex gap-[3vw] max-md:flex-col max-md:items-center">
      <div className="nf-skel aspect-[2/3] w-[clamp(150px,17vw,290px)] !rounded-xl" />
      <div className="flex-1 space-y-4 pt-4">
        <div className="nf-skel h-4 w-28" />
        <div className="nf-skel h-14 w-2/3" style={{ ['--i' as any]: 1 }} />
        <div className="nf-skel h-4 w-1/2" style={{ ['--i' as any]: 2 }} />
        <div className="nf-skel h-24 w-full" style={{ ['--i' as any]: 3 }} />
      </div>
    </div>
  </div>
);

/* ---------------- credits list (IMDb-style) ---------------- */

const CreditItem: React.FC<{ row: CreditRow }> = ({ row }) => {
  const c = row.item;
  const upcoming = isUpcoming(c);
  const roleText =
    row.dept === 'Acting'
      ? row.roles.filter(Boolean).join(' / ')
      : row.roles.join(', ');
  return (
    <li className="border-b border-white/[0.07]">
      <Link to={titlePath(c as any)} className="group grid grid-cols-[3.4rem_2.9rem_1fr] items-center gap-x-[max(12px,1vw)] rounded-md px-2 py-2.5 transition-colors duration-150 hover:bg-white/[0.05] sm:grid-cols-[4rem_3.2rem_1fr_auto]">
        <span className={`text-[max(13px,0.95vw)] tabular-nums ${upcoming ? 'font-semibold text-netflix-red' : 'text-[#bcbcbc]'}`}>
          {creditYear(c) || '—'}
        </span>
        <span className="aspect-[2/3] overflow-hidden rounded-[4px] bg-[#232323]">
          {c.poster_path && <img src={tmdbImage(c.poster_path, 'w92') || ''} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[max(14px,1.02vw)] font-semibold text-white group-hover:underline">{creditTitle(c)}</span>
          <span className="block truncate text-[max(13px,0.9vw)] text-[#a3a3a3]">
            <span className="mr-1.5 rounded-[3px] border border-white/25 px-1 text-[0.82em]">{c.media_type === 'movie' ? 'Movie' : 'TV'}</span>
            {roleText && (row.dept === 'Acting' ? `as ${roleText}` : roleText)}
            {row.episodes ? ` · ${row.episodes} episode${row.episodes === 1 ? '' : 's'}` : ''}
            {upcoming ? ' · Upcoming' : ''}
          </span>
        </span>
        <span className="col-start-3 justify-self-start sm:col-start-auto sm:justify-self-end">
          <ImdbRating item={c as any} size="sm" />
        </span>
      </Link>
    </li>
  );
};

/** Credits list. On the Overview (`preview`) it's "Movies & TV Shows": the first few credits with sort and
 *  filters and an "All credits" button; on the Credits tab it's everything, by department, with search.
 *  Department and sort live in the page's address and the list length on its history step, so Back,
 *  a refresh or a shared link shows the same list. */
const CreditsPanel: React.FC<{ person: PersonDetails; media: Media; onMedia: (m: Media) => void; preview?: boolean; onSeeAll?: () => void }> = ({ person, media, onMedia, preview, onSeeAll }) => {
  const rows = useMemo(() => buildRows(person, media), [person, media]);
  const depts = useMemo(() => deptCounts(rows), [rows]);
  const [deptParam, setDeptParam] = useQueryParam('dept');
  const [sortParam, setSortParam] = useQueryParam('sort', 'released');
  const sort: CreditSort = isCreditSort(sortParam) ? sortParam : 'released';
  // Their main department, or (after the Movies/TV filter leaves it empty) the first one that has credits.
  const mainDept: string = (depts.some(([d]) => d === person.known_for_department) && person.known_for_department) || depts[0]?.[0] || 'Acting';
  const dept = depts.some(([d]) => d === deptParam) ? deptParam : mainDept;
  const setDept = (d: string) => setDeptParam(d === mainDept ? '' : d);
  const [q, setQ] = useState('');
  const [limit, setLimit] = useState(() => {
    const kept = readEntryState<number>('cLimit');
    return typeof kept === 'number' && kept > PAGE ? kept : PAGE;
  });
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    setLimit(PAGE);
    saveEntryState({ cLimit: PAGE });
  }, [dept, sort, q, media]);

  const shown = useMemo(() => {
    let list = rows.filter((r) => r.dept === dept);
    const needle = q.trim().toLowerCase();
    if (needle) list = list.filter((r) => creditTitle(r.item).toLowerCase().includes(needle) || r.roles.join(' ').toLowerCase().includes(needle));
    return sortRows(list, sort);
  }, [rows, dept, sort, q]);

  const sortSelect = (
    <select aria-label="Sort credits" value={sort} onChange={(e) => setSortParam(e.target.value)} className={`nf-select ${sort !== 'released' ? 'is-active' : ''}`}>
      {CREDIT_SORTS.map(([v, l]) => (
        <option key={v} value={v}>{l}</option>
      ))}
    </select>
  );
  const none = <p className="py-8 text-netflix-muted">No {media === 'movie' ? 'movie' : media === 'tv' ? 'TV' : ''} credits listed.</p>;

  if (preview) {
    return (
      <div>
        <div className="mb-[max(12px,1vw)] flex flex-wrap items-center gap-2.5" role="toolbar" aria-label="Sort and filter credits">
          {sortSelect}
          <select aria-label="Movies or TV shows" value={media} onChange={(e) => onMedia(e.target.value as Media)} className={`nf-select ${media !== 'all' ? 'is-active' : ''}`}>
            <option value="all">Movies &amp; TV shows</option>
            <option value="movie">Movies</option>
            <option value="tv">TV shows</option>
          </select>
          {depts.length > 1 && (
            <select aria-label="Department" value={dept} onChange={(e) => setDept(e.target.value)} className={`nf-select ${dept !== mainDept ? 'is-active' : ''}`}>
              {depts.map(([d, n]) => (
                <option key={d} value={d}>{deptLabel(d, person.gender)} ({n})</option>
              ))}
            </select>
          )}
          {onSeeAll && (
            <button type="button" onClick={onSeeAll} className="nf-tool-btn">
              All credits
              <ChevronRightIcon />
            </button>
          )}
        </div>
        {shown.length ? <ol>{shown.slice(0, PREVIEW).map((r) => <CreditItem key={r.key} row={r} />)}</ol> : none}
        {onSeeAll && shown.length > PREVIEW && (
          <div className="mt-4">
            <MoreLink onClick={onSeeAll}>See all {shown.length} credits</MoreLink>
          </div>
        )}
      </div>
    );
  }

  if (!rows.length) return none;

  return (
    <div>
      <div className="mb-[max(14px,1.2vw)] flex flex-wrap gap-2" role="tablist" aria-label="Department">
        {depts.map(([d, n]) => (
          <button
            key={d}
            type="button"
            role="tab"
            aria-selected={dept === d}
            onClick={() => setDept(d)}
            className={`rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition-colors duration-150 ${
              dept === d ? 'border-white bg-white text-black' : 'border-white/25 text-netflix-text hover:border-white'
            }`}
          >
            {deptLabel(d, person.gender)} <span className={dept === d ? 'text-black/55' : 'text-[#8c8c8c]'}>{n}</span>
          </button>
        ))}
      </div>
      <div className="mb-[max(12px,1vw)] flex flex-wrap items-center gap-2.5">
        {sortSelect}
        <label className="relative min-w-[12rem] flex-1 sm:max-w-[20rem]">
          <span className="sr-only">Search credits</span>
          <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8c8c8c]" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search titles or roles" className="nf-input" />
        </label>
        <span className="text-sm text-[#8c8c8c]">{shown.length} credits</span>
      </div>
      <ol>{shown.slice(0, limit).map((r) => <CreditItem key={r.key} row={r} />)}</ol>
      {shown.length > limit && (
        <button
          type="button"
          onClick={() => {
            const n = limit + PAGE;
            setLimit(n);
            saveEntryState({ cLimit: n });
          }}
          className="nf-btn nf-btn-grey mx-auto mt-6 flex !text-sm"
        >
          Show more ({shown.length - limit} left)
        </button>
      )}
    </div>
  );
};

/* ---------------- awards ---------------- */

const AwardsPanel: React.FC<{ extra?: PersonExtra; loading: boolean; hasWikidata: boolean; compact?: boolean; onSeeAll?: () => void }> = ({ extra, loading, hasWikidata, compact, onSeeAll }) => {
  const [filterParam, setFilterParam] = useQueryParam('awards');
  const filter: 'all' | 'won' | 'nom' = filterParam === 'won' || filterParam === 'nom' ? filterParam : 'all';
  const setFilter = (f: 'all' | 'won' | 'nom') => setFilterParam(f === 'all' ? '' : f);
  const awards = extra?.awards || [];
  const won = awards.filter((a) => a.won).length;
  const groups = useMemo(() => {
    const list = awards.filter((a) => (filter === 'all' ? true : filter === 'won' ? a.won : !a.won));
    const m = new Map<string, typeof list>();
    list.forEach((a) => {
      const i = a.a.indexOf(' for ');
      const org = i > 0 ? a.a.slice(0, i) : a.a;
      if (!m.has(org)) m.set(org, []);
      m.get(org)!.push(a);
    });
    return [...m.entries()]
      .map(([org, items]) => ({ org, items: items.sort((x, y) => (y.y || '').localeCompare(x.y || '') || Number(y.won) - Number(x.won)) }))
      .sort((a, b) => b.items.filter((x) => x.won).length - a.items.filter((x) => x.won).length || b.items.length - a.items.length);
  }, [awards, filter]);

  if (loading) return <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="nf-skel h-12 w-full" style={{ ['--i' as any]: i }} />)}</div>;
  if (!hasWikidata || !awards.length) return <p className="py-6 text-netflix-muted">No award records found for this person.</p>;

  if (compact) {
    return (
      <div>
        <p className="mb-3 text-[max(15px,1.1vw)] text-white">
          <span className="font-bold text-[#f5c518]">{won}</span> {won === 1 ? 'win' : 'wins'} &amp;{' '}
          <span className="font-bold">{awards.length - won}</span> nominations
        </p>
        <ul className="space-y-2">
          {awards.filter((a) => a.won).slice(0, 5).map((a, i) => (
            <li key={i} className="flex items-baseline gap-3 text-[max(14px,0.98vw)]">
              <span className="w-12 flex-shrink-0 tabular-nums text-[#8c8c8c]">{a.y || ''}</span>
              <span className="text-[#e5e5e5]">{a.a}{a.f ? <span className="text-[#8c8c8c]"> — {a.f}</span> : null}</span>
            </li>
          ))}
        </ul>
        {onSeeAll && <div className="mt-4"><MoreLink onClick={onSeeAll}>See all awards</MoreLink></div>}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-[max(16px,1.4vw)] flex flex-wrap items-center gap-4">
        <div className="rounded-xl bg-white/[0.05] px-5 py-3 ring-1 ring-white/10">
          <span className="text-[max(22px,1.8vw)] font-bold text-[#f5c518]">{won}</span>
          <span className="ml-1.5 text-netflix-muted">{won === 1 ? 'win' : 'wins'}</span>
          <span className="mx-3 text-[#4d4d4d]">|</span>
          <span className="text-[max(22px,1.8vw)] font-bold text-white">{awards.length - won}</span>
          <span className="ml-1.5 text-netflix-muted">nominations</span>
        </div>
        <div className="nf-seg" role="group" aria-label="Filter awards">
          {(['all', 'won', 'nom'] as const).map((f) => (
            <button key={f} type="button" className={filter === f ? 'on' : ''} onClick={() => setFilter(f)}>
              {f === 'all' ? 'All' : f === 'won' ? 'Won' : 'Nominated'}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-[max(18px,1.6vw)]">
        {groups.map((g) => (
          <section key={g.org}>
            <h3 className="mb-2 text-[max(16px,1.15vw)] font-semibold text-white">{g.org}</h3>
            <ul className="divide-y divide-white/[0.07] rounded-lg bg-white/[0.03] ring-1 ring-white/[0.06]">
              {g.items.map((a, i) => {
                const idx = a.a.indexOf(' for ');
                const category = idx > 0 ? a.a.slice(idx + 5) : '';
                return (
                  <li key={i} className="flex items-baseline gap-3 px-4 py-2.5 text-[max(14px,0.95vw)]">
                    <span className="w-11 flex-shrink-0 tabular-nums text-[#8c8c8c]">{a.y || '—'}</span>
                    <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${a.won ? 'bg-[#f5c518] text-black' : 'bg-white/10 text-[#cfcfcf]'}`}>
                      {a.won ? 'Winner' : 'Nominee'}
                    </span>
                    <span className="min-w-0 text-[#e5e5e5]">
                      {category ? category.charAt(0).toUpperCase() + category.slice(1) : a.a}
                      {a.f && <span className="text-[#8c8c8c]"> — {a.f}</span>}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
      <p className="mt-6 text-xs text-[#6b6b6b]">Awards data from Wikidata (CC0). It may be incomplete for some people.</p>
    </div>
  );
};

/* ---------------- photos / videos ---------------- */

const Lightbox: React.FC<{ images: string[]; index: number; onClose: () => void; onIndex: (i: number) => void }> = ({ images, index, onClose, onIndex }) => {
  useCloseOnBack(true, onClose);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') onIndex((index + 1) % images.length);
      if (e.key === 'ArrowLeft') onIndex((index - 1 + images.length) % images.length);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, images.length, onClose, onIndex]);
  return (
    <Overlay>
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 p-4 animate-fade-in-fast" onClick={onClose} role="dialog" aria-modal="true" aria-label="Photo">
      <img key={index} src={images[index]} alt="" className="max-h-[calc(100vh-7rem)] max-w-[calc(100vw-10rem)] rounded-lg object-contain shadow-2xl animate-zoom-in max-sm:max-w-[94vw]" onClick={(e) => e.stopPropagation()} />
      <button type="button" className="nf-circle absolute right-5 top-5 text-base" onClick={onClose} aria-label="Close"><CloseIcon className="h-5 w-5" /></button>
      {images.length > 1 && (
        <>
          <button type="button" className="nf-circle absolute left-5 top-1/2 -translate-y-1/2 text-lg" aria-label="Previous" onClick={(e) => { e.stopPropagation(); onIndex((index - 1 + images.length) % images.length); }}><ChevronLeftIcon className="h-6 w-6" /></button>
          <button type="button" className="nf-circle absolute right-5 top-1/2 -translate-y-1/2 text-lg" aria-label="Next" onClick={(e) => { e.stopPropagation(); onIndex((index + 1) % images.length); }}><ChevronRightIcon className="h-6 w-6" /></button>
        </>
      )}
      <span className="absolute bottom-5 rounded-full bg-black/60 px-3 py-1 text-sm tabular-nums text-white/80">{index + 1} / {images.length}</span>
    </div>
    </Overlay>
  );
};

const PhotosPanel: React.FC<{ person: PersonDetails; compact?: boolean; onSeeAll?: () => void }> = ({ person, compact, onSeeAll }) => {
  const photos = person.images?.profiles || [];
  const [open, setOpen] = useState<number | null>(null);
  if (!photos.length) return <p className="py-6 text-netflix-muted">No photos available.</p>;
  const list = compact ? photos.slice(0, 8) : photos;
  return (
    <>
      <div className={`grid gap-[max(8px,0.6vw)] ${compact ? 'grid-cols-4 sm:grid-cols-8' : 'grid-cols-3 sm:grid-cols-4 md:grid-cols-6'}`}>
        {list.map((ph, i) => (
          <button key={ph.file_path} type="button" onClick={() => setOpen(i)} className="group aspect-[2/3] overflow-hidden rounded-lg bg-[#232323]" aria-label={`Photo ${i + 1}`}>
            <img src={tmdbImage(ph.file_path, 'w342') || ''} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-500 ease-out-expo group-hover:scale-105" />
          </button>
        ))}
      </div>
      {compact && onSeeAll && photos.length > 8 && <div className="mt-4"><MoreLink onClick={onSeeAll}>See all {photos.length} photos</MoreLink></div>}
      {open !== null && <Lightbox images={photos.map((p) => tmdbImage(p.file_path, 'original') || '')} index={open} onIndex={setOpen} onClose={() => setOpen(null)} />}
    </>
  );
};

interface Video { key: string; name: string; title: string; titleItem: SearchResult }

const VideosPanel: React.FC<{ person: PersonDetails; media: Media }> = ({ person, media }) => {
  const titles = useMemo(() => knownFor(person, media, 8), [person, media]);
  const { data, loading } = useCachedData<Video[]>(titles.length ? `person-videos:${person.id}:${media}` : null, async () => {
    const lists = await Promise.all(
      titles.map(async (t) => {
        try {
          // Cached per title, so switching Movies/TV or coming back doesn't fetch the same videos again.
          const v = await loadCached<any>(`videos:${t.media_type}:${t.id}`, () => tmdbGet(`/${t.media_type}/${t.id}/videos`));
          const yt = (v.results || []).filter((x: any) => x.site === 'YouTube' && ['Trailer', 'Teaser', 'Clip', 'Featurette'].includes(x.type));
          yt.sort((a: any, b: any) => Number(b.official) - Number(a.official) || (a.type === 'Trailer' ? -1 : 1));
          return yt.slice(0, 2).map((x: any) => ({ key: x.key, name: x.name, title: (t as any).title || (t as any).name, titleItem: t }));
        } catch {
          return [];
        }
      })
    );
    return lists.flat();
  });
  const [playing, setPlaying] = useState<Video | null>(null);
  useCloseOnBack(!!playing, () => setPlaying(null));

  useEffect(() => {
    if (!playing) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setPlaying(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [playing]);

  if (loading) return <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className="nf-skel aspect-video" style={{ ['--i' as any]: i }} />)}</div>;
  if (!data?.length) return <p className="py-6 text-netflix-muted">No videos found.</p>;

  return (
    <>
      <p className="mb-3 text-sm text-[#8c8c8c]">Trailers and clips from {person.name.split(' ')[0]}&apos;s best-known work.</p>
      <div className="grid grid-cols-1 gap-[max(10px,0.8vw)] sm:grid-cols-2 lg:grid-cols-4">
        {data.map((v) => (
          <button key={v.key} type="button" onClick={() => setPlaying(v)} className="group text-left">
            <span className="relative block aspect-video overflow-hidden rounded-lg bg-[#232323]">
              <img src={`https://i.ytimg.com/vi/${v.key}/hqdefault.jpg`} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-500 ease-out-expo group-hover:scale-105" />
              <span className="absolute inset-0 flex items-center justify-center bg-black/20 transition-colors group-hover:bg-black/35">
                <span className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-white bg-black/50"><PlayIcon className="ml-0.5 h-5 w-5 text-white" /></span>
              </span>
            </span>
            <span className="mt-2 block truncate text-sm font-semibold text-white">{v.title}</span>
            <span className="block truncate text-xs text-[#8c8c8c]">{v.name}</span>
          </button>
        ))}
      </div>
      {playing && (
        <Overlay>
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 p-4 animate-fade-in-fast" onClick={() => setPlaying(null)} role="dialog" aria-modal="true" aria-label={playing.name}>
          <div className="relative aspect-video w-full max-w-5xl overflow-hidden rounded-md bg-black shadow-2xl animate-zoom-in" onClick={(e) => e.stopPropagation()}>
            <iframe className="absolute inset-0 h-full w-full" src={`https://www.youtube-nocookie.com/embed/${playing.key}?autoplay=1&rel=0&modestbranding=1`} title={playing.name} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen />
            <button type="button" onClick={() => setPlaying(null)} className="nf-circle absolute right-3 top-3 z-10 text-base" aria-label="Close video"><CloseIcon className="h-5 w-5" /></button>
          </div>
        </div>
        </Overlay>
      )}
    </>
  );
};

/* ---------------- page ---------------- */

const PersonPage: React.FC<{ id: number }> = ({ id }) => {
  const { data: person, error, reload } = useCachedData<PersonDetails>(`person:${id}`, () => getPerson(id));
  const wd = person?.external_ids?.wikidata_id || null;
  const extra = useCachedData<PersonExtra>(wd ? `person-extra:${wd}` : null, () => getPersonExtra(wd!));
  // The tab is part of the address (?tab=credits): each tab is its own step, so Back / the trackpad swipe
  // goes from "All credits" to the Overview, then to the title or page you came from.
  const [tabParam, setTabParam] = useQueryParam('tab');
  const tab: Tab = TABS.some(([t]) => t === tabParam) ? (tabParam as Tab) : 'overview';
  const [mediaParam, setMediaParam] = useQueryParam('type');
  const media: Media = mediaParam === 'movie' || mediaParam === 'tv' ? mediaParam : 'all';
  const setMedia = (m: Media) => setMediaParam(m === 'all' ? '' : m);
  const [bioOpen, setBioOpen] = useState(false);
  const [heroLoaded, setHeroLoaded] = useState(false);
  const tabsRef = useRef<HTMLDivElement>(null);

  const kf = useMemo(() => (person ? knownFor(person, media) : []), [person, media]);
  const allRows = useMemo(() => (person ? buildRows(person, 'all') : []), [person]);
  const trivia = useMemo(() => (person ? buildTrivia(person, extra.data) : []), [person, extra.data]);
  const backdrop = useMemo(() => (person ? knownFor(person, 'all', 4).find((t) => t.backdrop_path)?.backdrop_path : null), [person]);

  useEffect(() => {
    if (!person) return;
    const label = tab === 'overview' ? '' : TABS.find(([t]) => t === tab)?.[1];
    document.title = `${person.name}${label ? ` · ${label}` : ''} — StreamFast`;
  }, [person, tab]);

  const go = (t: Tab) => {
    if (t !== tab) setTabParam(t === 'overview' ? '' : t, { push: true });
    const el = tabsRef.current;
    if (el) {
      const top = el.getBoundingClientRect().top + window.scrollY - 70;
      if (window.scrollY > top) scrollToY(top, true);
    }
  };

  if (error) {
    return (
      <div className="pt-28">
        <ErrorState title="Person unavailable" message="We couldn't load this profile right now." onRetry={reload} />
      </div>
    );
  }
  if (!person) return <Skeleton />;

  const age = ageOf(person.birthday, person.deathday);
  const role = deptLabel(person.known_for_department || 'Acting', person.gender);
  const ext = person.external_ids || {};
  const f = extra.data?.facts;
  const awards = extra.data?.awards || [];
  const wins = awards.filter((a) => a.won).length;
  const movieCount = new Set(allRows.filter((r) => r.item.media_type === 'movie').map((r) => r.item.id)).size;
  const tvCount = new Set(allRows.filter((r) => r.item.media_type === 'tv').map((r) => r.item.id)).size;
  const links: [string, string][] = [
    ext.imdb_id ? ['IMDb', `https://www.imdb.com/name/${ext.imdb_id}/`] : null,
    ext.instagram_id ? ['Instagram', `https://www.instagram.com/${ext.instagram_id}/`] : null,
    ext.twitter_id ? ['X', `https://x.com/${ext.twitter_id}`] : null,
    ext.facebook_id ? ['Facebook', `https://www.facebook.com/${ext.facebook_id}`] : null,
    ext.tiktok_id ? ['TikTok', `https://www.tiktok.com/@${ext.tiktok_id}`] : null,
    ext.youtube_id ? ['YouTube', `https://www.youtube.com/${ext.youtube_id}`] : null,
    person.homepage ? ['Website', person.homepage] : null,
  ].filter(Boolean) as [string, string][];

  const bio = person.biography || '';

  const details = (
    <dl className="text-[max(14px,0.95vw)]">
      <Detail label="Known for">{role}</Detail>
      <Detail label="Born">
        {person.birthday ? `${fmtDate(person.birthday)}${!person.deathday && age !== null ? ` (age ${age})` : ''}` : ''}
        {person.place_of_birth ? <span className="block text-[#a3a3a3]">{person.place_of_birth}</span> : null}
      </Detail>
      <Detail label="Died">{person.deathday ? `${fmtDate(person.deathday)}${age !== null ? ` (aged ${age})` : ''}` : ''}</Detail>
      <Detail label="Birth name">{f?.birthName && f.birthName !== person.name ? f.birthName : ''}</Detail>
      <Detail label="Nickname">{f?.nickname || ''}</Detail>
      <Detail label="Height">{fmtHeight(f?.heightCm)}</Detail>
      <Detail label="Citizenship">{f?.citizenship?.join(', ') || ''}</Detail>
      <Detail label="Spouse">
        {f?.spouses?.length
          ? f.spouses.map((s) => (
              <span key={s.name} className="block">
                {s.name}
                {s.from || s.to ? <span className="text-[#8c8c8c]"> ({s.from || '?'}–{s.to || 'present'})</span> : null}
              </span>
            ))
          : ''}
      </Detail>
      <Detail label="Children">{f?.children ? String(f.children) : ''}</Detail>
      <Detail label="Education">{f?.education?.slice(0, 3).join(', ') || ''}</Detail>
      <Detail label="Occupation">{f?.occupations?.slice(0, 6).join(', ') || ''}</Detail>
      <Detail label="Also known as">{person.also_known_as?.length ? person.also_known_as.slice(0, 4).join(', ') : ''}</Detail>
      <Detail label="Credits">{`${movieCount} movies · ${tvCount} TV shows`}</Detail>
    </dl>
  );

  return (
    <div>
      {/* ---------- hero ---------- */}
      <section className="relative overflow-hidden">
        {backdrop && (
          <img
            src={tmdbImage(backdrop, 'w1280') || ''}
            alt=""
            aria-hidden="true"
            decoding="async"
            onLoad={() => setHeroLoaded(true)}
            className={`absolute inset-0 h-full w-full object-cover object-[center_25%] transition-opacity duration-700 ${heroLoaded ? 'opacity-30' : 'opacity-0'}`}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-[#141414]/40 via-[#141414]/75 to-[#141414]" aria-hidden="true" />
        <div className="relative px-[4%] pb-[max(22px,2vw)] pt-[5.25rem] sm:pt-[5.9rem]">
          {/* Back sits on its own row: 1rem under the header and above the photo, lined up with the page edge. */}
          <button type="button" onClick={() => goBack('/')} aria-label="Back" className="nf-circle relative z-[4] mb-[max(14px,1.1vw)] text-base">
            <ChevronLeftIcon className="h-5 w-5" />
          </button>
          <div className="flex gap-[max(20px,3vw)] max-md:flex-col max-md:items-center max-md:text-center">
          <div className="w-[clamp(150px,16vw,280px)] flex-shrink-0 animate-fade-in">
            <div className="aspect-[2/3] overflow-hidden rounded-2xl bg-[#232323] shadow-[0_20px_50px_-12px_rgba(0,0,0,0.8)] ring-1 ring-white/10">
              {person.profile_path && <img src={tmdbImage(person.profile_path, 'w500') || ''} alt={person.name} decoding="async" className="h-full w-full object-cover" />}
            </div>
          </div>
          <div className="min-w-0 flex-1 animate-fade-in-up self-end">
            <p className="mb-1 text-[max(12px,0.85vw)] font-semibold uppercase tracking-[0.22em] text-[#a3a3a3]">{role}</p>
            <h1 className="text-[clamp(2.1rem,4.4vw,4.8rem)] font-black leading-[0.98] tracking-[-0.035em] text-white">{person.name}</h1>
            <div className="mt-[max(10px,0.9vw)] flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[max(14px,1vw)] font-medium text-[#e5e5e5] max-md:justify-center">
              {person.birthday && <span>Born {fmtDate(person.birthday)}{!person.deathday && age !== null ? ` (${age})` : ''}</span>}
              {person.place_of_birth && <><span className="nf-dot" aria-hidden="true" /><span className="text-[#bcbcbc]">{person.place_of_birth}</span></>}
              {person.deathday && <><span className="nf-dot" aria-hidden="true" /><span>Died {fmtDate(person.deathday)}</span></>}
            </div>
            <div className="mt-[max(10px,0.9vw)] flex flex-wrap gap-2 max-md:justify-center">
              <span className="rounded-full bg-white/10 px-3 py-1 text-[13px] font-semibold text-white">{movieCount} movies</span>
              <span className="rounded-full bg-white/10 px-3 py-1 text-[13px] font-semibold text-white">{tvCount} TV shows</span>
              {wins > 0 && <button type="button" onClick={() => go('awards')} className="rounded-full bg-[#f5c518] px-3 py-1 text-[13px] font-bold text-black">{wins} wins · {awards.length - wins} nominations</button>}
            </div>
            {bio && (
              <div className="mt-[max(12px,1.1vw)] max-w-[60rem] text-left">
                <p className={`text-[max(14px,1.02vw)] leading-[1.6] text-[#d2d2d2] ${bioOpen ? 'whitespace-pre-line' : 'line-clamp-4'}`}>
                  {/* Collapsed: paragraphs run together so the 4th line ends in a clean "…" (not a lone "..." line). */}
                  {bioOpen ? bio : bio.replace(/\s*\n+\s*/g, ' ').replace(/(\s*\.{3}|\s*…)\s*$/, '')}
                </p>
                {bio.length > 380 && (
                  <button type="button" onClick={() => setBioOpen((o) => !o)} className="mt-1 text-[max(13px,0.95vw)] font-semibold text-white hover:underline">
                    {bioOpen ? 'Show less' : 'Read more'}
                  </button>
                )}
              </div>
            )}
            {links.length > 0 && (
              <div className="mt-[max(12px,1.1vw)] flex flex-wrap gap-2 max-md:justify-center">
                {links.map(([l, href]) => (
                  <a
                    key={l}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${l === 'IMDb' ? 'bg-[#f5c518] text-black hover:bg-[#ffd84d]' : 'bg-white/10 text-white hover:bg-white/20'}`}
                  >
                    {l}
                  </a>
                ))}
              </div>
            )}
          </div>
          </div>
        </div>
      </section>

      {/* ---------- tabs + main filter ---------- */}
      <div ref={tabsRef} className="sticky top-[4.25rem] z-30 border-b border-white/10 bg-[#141414]/[0.97] sm:top-[4.9rem]">
        <div className="flex flex-wrap items-center justify-between gap-3 px-[4%] py-2">
          <div className="-mx-1 flex overflow-x-auto scrollbar-hide" role="tablist" aria-label="Profile sections">
            {TABS.map(([t, l]) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={tab === t}
                onClick={() => go(t)}
                className={`relative whitespace-nowrap px-3 py-2 text-[max(14px,1vw)] font-semibold transition-colors ${tab === t ? 'text-white' : 'text-[#8c8c8c] hover:text-white'}`}
              >
                {l}
                {tab === t && <span className="absolute inset-x-3 -bottom-[9px] h-[3px] rounded-full bg-netflix-red" />}
              </button>
            ))}
          </div>
          {['overview', 'credits', 'videos'].includes(tab) && (
            <div className="nf-seg" role="group" aria-label="Movies or TV shows">
              {([['all', 'All'], ['movie', 'Movies'], ['tv', 'TV Shows']] as const).map(([v, l]) => (
                <button key={v} type="button" className={media === v ? 'on' : ''} aria-pressed={media === v} onClick={() => setMedia(v)}>
                  {l}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ---------- content ---------- */}
      <div key={tab} className="page-in pt-[max(22px,2vw)]">
        {tab === 'overview' && (
          <>
            {kf.length > 0 && <ContentCarousel title="Known For" items={kf} />}
            <div className="grid gap-[max(24px,3vw)] px-[4%] lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
              <div className="space-y-[max(28px,2.6vw)]">
                <section>
                  <SectionTitle>Movies &amp; TV Shows</SectionTitle>
                  <CreditsPanel person={person} media={media} onMedia={setMedia} preview onSeeAll={() => go('credits')} />
                </section>
                <section>
                  <SectionTitle>Photos</SectionTitle>
                  <PhotosPanel person={person} compact onSeeAll={() => go('photos')} />
                </section>
              </div>
              <div className="space-y-[max(28px,2.6vw)]">
                <section>
                  <SectionTitle>Personal Details</SectionTitle>
                  {details}
                </section>
                <section>
                  <SectionTitle>Awards &amp; Nominations</SectionTitle>
                  <AwardsPanel extra={extra.data} loading={extra.loading} hasWikidata={!!wd} compact onSeeAll={() => go('awards')} />
                </section>
                {trivia.length > 0 && (
                  <section>
                    <SectionTitle action={<MoreLink onClick={() => go('trivia')}>More</MoreLink>}>Trivia</SectionTitle>
                    <ul className="space-y-2.5 text-[max(14px,0.98vw)] text-[#d2d2d2]">
                      {trivia.slice(0, 3).map((t) => <li key={t} className="border-l-2 border-netflix-red/70 pl-3">{t}</li>)}
                    </ul>
                  </section>
                )}
              </div>
            </div>
          </>
        )}

        {tab === 'credits' && (
          <div className="px-[4%]">
            <SectionTitle>Credits</SectionTitle>
            <CreditsPanel person={person} media={media} onMedia={setMedia} />
          </div>
        )}

        {tab === 'awards' && (
          <div className="px-[4%]">
            <SectionTitle>Awards &amp; Nominations</SectionTitle>
            <AwardsPanel extra={extra.data} loading={extra.loading} hasWikidata={!!wd} />
          </div>
        )}

        {tab === 'trivia' && (
          <div className="max-w-4xl px-[4%]">
            <SectionTitle>Trivia</SectionTitle>
            {trivia.length ? (
              <ul className="space-y-3 text-[max(15px,1.05vw)] leading-relaxed text-[#d2d2d2]">
                {trivia.map((t) => <li key={t} className="rounded-lg bg-white/[0.04] px-4 py-3 ring-1 ring-white/[0.06]">{t}</li>)}
              </ul>
            ) : (
              <p className="text-netflix-muted">No trivia yet.</p>
            )}
            <p className="mt-5 text-xs text-[#6b6b6b]">Facts worked out from TMDB filmography data and Wikidata.</p>
          </div>
        )}

        {tab === 'photos' && (
          <div className="px-[4%]">
            <SectionTitle>Photos</SectionTitle>
            <PhotosPanel person={person} />
          </div>
        )}

        {tab === 'videos' && (
          <div className="px-[4%]">
            <SectionTitle>Videos</SectionTitle>
            <VideosPanel person={person} media={media} />
          </div>
        )}
      </div>
    </div>
  );
};

export default PersonPage;
