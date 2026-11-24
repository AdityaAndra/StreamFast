import type { SearchResult } from '../types';
import { tmdbGet } from '../services/tmdb';

/** Everything a Browse / View-all page can filter by. Serialised in the URL so every view is a shareable link. */
export interface BrowseParams {
  type: 'all' | 'movie' | 'tv';
  list?: 'trending' | 'new' | 'upcoming' | 'on_the_air' | 'airing_today';
  window?: 'day' | 'week';
  sort: SortKey;
  genre?: string;
  year?: string;
  lang?: string;
  rating?: string;
  provider?: string;
  region?: string;
  company?: string;
  network?: string;
  /** TMDB keyword ids (e.g. holidays) */
  keyword?: string;
  /** Optional page heading carried in the URL (e.g. "Hindi Movies") */
  title?: string;
  q?: string;
}

export type SortKey = 'popular' | 'newest' | 'oldest' | 'rating' | 'votes' | 'az' | 'za' | 'revenue';

export const SORTS: { id: SortKey; label: string }[] = [
  { id: 'popular', label: 'Most popular' },
  { id: 'newest', label: 'Newest first' },
  { id: 'oldest', label: 'Oldest first' },
  { id: 'rating', label: 'Highest rated' },
  { id: 'votes', label: 'Most voted' },
  { id: 'az', label: 'Title A–Z' },
  { id: 'za', label: 'Title Z–A' },
  { id: 'revenue', label: 'Box office' },
];

export const LISTS: { id: NonNullable<BrowseParams['list']> | ''; label: string; tvOnly?: boolean }[] = [
  { id: '', label: 'All titles' },
  { id: 'trending', label: 'Trending' },
  { id: 'new', label: 'New releases' },
  { id: 'upcoming', label: 'Coming soon' },
  { id: 'on_the_air', label: 'New episodes', tvOnly: true },
  { id: 'airing_today', label: 'Airing today', tvOnly: true },
];

export const MOVIE_GENRES: [number, string][] = [
  [28, 'Action'], [12, 'Adventure'], [16, 'Animation'], [35, 'Comedy'], [80, 'Crime'], [99, 'Documentary'], [18, 'Drama'],
  [10751, 'Family'], [14, 'Fantasy'], [36, 'History'], [27, 'Horror'], [10402, 'Music'], [9648, 'Mystery'], [10749, 'Romance'],
  [878, 'Science Fiction'], [53, 'Thriller'], [10752, 'War'], [37, 'Western'], [10770, 'TV Movie'],
];

export const TV_GENRES: [number, string][] = [
  [10759, 'Action & Adventure'], [16, 'Animation'], [35, 'Comedy'], [80, 'Crime'], [99, 'Documentary'], [18, 'Drama'],
  [10751, 'Family'], [10762, 'Kids'], [9648, 'Mystery'], [10763, 'News'], [10764, 'Reality'], [10765, 'Sci-Fi & Fantasy'],
  [10766, 'Soap'], [10767, 'Talk'], [10768, 'War & Politics'], [37, 'Western'],
];

/** Genres that only exist on one side, mapped to the closest equivalents. */
const MOVIE_TO_TV: Record<string, string> = { '28': '10759', '12': '10759', '878': '10765', '14': '10765', '10752': '10768', '36': '', '27': '', '10402': '', '10749': '', '53': '', '10770': '' };
const TV_TO_MOVIE: Record<string, string> = { '10759': '28|12', '10765': '878|14', '10768': '10752', '10762': '10751', '10763': '', '10764': '', '10766': '', '10767': '' };

const mapGenres = (raw: string, to: 'movie' | 'tv'): string => {
  const sep = raw.includes('|') ? '|' : ',';
  const table = to === 'tv' ? MOVIE_TO_TV : TV_TO_MOVIE;
  const out = new Set<string>();
  raw.split(/[|,]/).forEach((id) => {
    const mapped = id in table ? table[id] : id;
    mapped.split('|').filter(Boolean).forEach((m) => out.add(m));
  });
  return [...out].join(sep);
};

export const genreLabel = (raw?: string) => {
  if (!raw) return '';
  const names = new Map([...MOVIE_GENRES, ...TV_GENRES].map(([id, n]) => [String(id), n]));
  return raw.split(/[|,]/).map((id) => names.get(id) || '').filter(Boolean).join(' & ');
};

export const LANGUAGES: [string, string][] = [
  ['en', 'English'], ['ja', 'Japanese'], ['ko', 'Korean'], ['hi', 'Hindi'], ['es', 'Spanish'], ['fr', 'French'], ['de', 'German'],
  ['it', 'Italian'], ['zh', 'Mandarin'], ['cn', 'Cantonese'], ['pt', 'Portuguese'], ['ru', 'Russian'], ['tr', 'Turkish'],
  ['th', 'Thai'], ['ta', 'Tamil'], ['te', 'Telugu'], ['ml', 'Malayalam'], ['kn', 'Kannada'], ['bn', 'Bengali'], ['mr', 'Marathi'],
  ['sv', 'Swedish'], ['da', 'Danish'], ['no', 'Norwegian'], ['pl', 'Polish'], ['nl', 'Dutch'], ['ar', 'Arabic'],
  ['id', 'Indonesian'], ['tl', 'Tagalog'], ['fa', 'Persian'], ['he', 'Hebrew'],
];

export const RATINGS: [string, string][] = [['', 'Any rating'], ['6', '6+ ★'], ['7', '7+ ★'], ['8', '8+ ★']];

export const yearOptions = (): [string, string][] => {
  const now = new Date().getFullYear() + 1;
  const years: [string, string][] = [];
  for (let y = now; y >= now - 25; y--) years.push([String(y), String(y)]);
  for (let d = Math.floor((now - 26) / 10) * 10; d >= 1920; d -= 10) years.push([`${d}s`, `${d}s`]);
  return [['', 'Any year'], ...years];
};

const DEFAULTS: Pick<BrowseParams, 'type' | 'sort'> = { type: 'all', sort: 'popular' };
const KEYS: (keyof BrowseParams)[] = ['type', 'list', 'window', 'sort', 'genre', 'year', 'lang', 'rating', 'provider', 'region', 'company', 'network', 'keyword', 'title', 'q'];

export const parseBrowse = (search: string): BrowseParams => {
  const sp = new URLSearchParams(search);
  const p: any = { ...DEFAULTS };
  KEYS.forEach((k) => {
    const v = sp.get(k);
    if (v) p[k] = v;
  });
  if (!['all', 'movie', 'tv'].includes(p.type)) p.type = 'all';
  if (!SORTS.some((s) => s.id === p.sort)) p.sort = 'popular';
  return p;
};

export const toQuery = (p: Partial<BrowseParams>, omit: (keyof BrowseParams)[] = []) => {
  const sp = new URLSearchParams();
  KEYS.forEach((k) => {
    const v = p[k];
    if (!v || omit.includes(k)) return;
    if ((k === 'type' && v === DEFAULTS.type) || (k === 'sort' && v === DEFAULTS.sort)) return;
    sp.set(k, String(v));
  });
  const s = sp.toString();
  return s ? `?${s}` : '';
};

/** Human page title for a filter combination, e.g. "Action Movies", "Coming Soon". */
export const describe = (p: BrowseParams) => {
  if (p.title) return p.title;
  const noun = p.type === 'movie' ? 'Movies' : p.type === 'tv' ? 'TV Shows' : 'Movies & TV';
  const g = genreLabel(p.genre);
  const prefix =
    p.list === 'trending' ? 'Trending' : p.list === 'new' ? 'New' : p.list === 'upcoming' ? 'Upcoming' : p.list === 'on_the_air' ? 'New Episodes:' : p.list === 'airing_today' ? 'Airing Today:' : p.sort === 'rating' ? 'Top Rated' : '';
  return [prefix, g, noun].filter(Boolean).join(' ');
};

const iso = (d: Date) => d.toISOString().slice(0, 10);
const daysFromNow = (n: number) => iso(new Date(Date.now() + n * 86400000));

const discoverParams = (type: 'movie' | 'tv', p: BrowseParams): Record<string, string> | null => {
  const isMovie = type === 'movie';
  const dateKey = isMovie ? 'primary_release_date' : 'first_air_date';
  const out: Record<string, string> = { include_adult: 'false' };

  switch (p.sort) {
    case 'newest': out.sort_by = `${dateKey}.desc`; out[`${dateKey}.lte`] = daysFromNow(0); out['vote_count.gte'] = '5'; break;
    case 'oldest': out.sort_by = `${dateKey}.asc`; out['vote_count.gte'] = '20'; break;
    case 'rating': out.sort_by = 'vote_average.desc'; out['vote_count.gte'] = isMovie ? '300' : '150'; break;
    case 'votes': out.sort_by = 'vote_count.desc'; break;
    case 'az': out.sort_by = isMovie ? 'title.asc' : 'name.asc'; out['vote_count.gte'] = '25'; break;
    case 'za': out.sort_by = isMovie ? 'title.desc' : 'name.desc'; out['vote_count.gte'] = '25'; break;
    case 'revenue': out.sort_by = isMovie ? 'revenue.desc' : 'popularity.desc'; break;
    default: out.sort_by = 'popularity.desc';
  }

  const list = p.list;
  if (list === 'new' || ((list === 'on_the_air' || list === 'airing_today') && isMovie)) {
    out[`${dateKey}.gte`] = daysFromNow(-60);
    out[`${dateKey}.lte`] = daysFromNow(0);
    delete out['vote_count.gte'];
  } else if (list === 'upcoming') {
    out[`${dateKey}.gte`] = daysFromNow(1);
    delete out[`${dateKey}.lte`];
    delete out['vote_count.gte'];
    if (p.sort === 'newest') out.sort_by = `${dateKey}.asc`;
  } else if (list === 'on_the_air') {
    out['air_date.gte'] = daysFromNow(0);
    out['air_date.lte'] = daysFromNow(7);
  } else if (list === 'airing_today') {
    out['air_date.gte'] = daysFromNow(0);
    out['air_date.lte'] = daysFromNow(0);
  }

  if (p.year) {
    if (/^\d{4}$/.test(p.year)) out[isMovie ? 'primary_release_year' : 'first_air_date_year'] = p.year;
    else if (/^\d{4}s$/.test(p.year)) {
      const d = Number(p.year.slice(0, 4));
      out[`${dateKey}.gte`] = `${d}-01-01`;
      out[`${dateKey}.lte`] = `${d + 9}-12-31`;
    }
  }
  if (p.genre) {
    const g = p.type === 'all' ? mapGenres(p.genre, type) : p.genre;
    if (!g) return null; // genre doesn't exist for this media type
    out.with_genres = g;
  }
  if (p.lang) out.with_original_language = p.lang;
  if (p.rating) {
    out['vote_average.gte'] = p.rating;
    if (!out['vote_count.gte'] || Number(out['vote_count.gte']) < 50) out['vote_count.gte'] = '50';
  }
  if (p.provider) {
    out.with_watch_providers = p.provider;
    out.watch_region = p.region || 'US';
    out.with_watch_monetization_types = 'flatrate|free|ads';
  }
  if (p.company) out.with_companies = p.company;
  if (p.keyword) out.with_keywords = p.keyword;
  if (p.network) {
    if (isMovie) return null;
    out.with_networks = p.network;
  }
  return out;
};

const valueOf = (item: SearchResult, sort: SortKey): number | string => {
  const date = item.media_type === 'movie' ? item.release_date : item.first_air_date;
  switch (sort) {
    case 'newest': return date || '';
    case 'oldest': return date || '9999';
    case 'rating': return item.vote_average || 0;
    case 'votes': return (item as any).vote_count || 0;
    case 'az': case 'za': return (item.media_type === 'movie' ? item.title : item.name).toLowerCase();
    default: return item.popularity || 0;
  }
};

const mergeSorted = (lists: SearchResult[][], sort: SortKey) => {
  const all = lists.flat();
  const asc = sort === 'oldest' || sort === 'az';
  return all.sort((a, b) => {
    const va = valueOf(a, sort);
    const vb = valueOf(b, sort);
    if (va === vb) return 0;
    return (va > vb ? 1 : -1) * (asc ? 1 : -1);
  });
};

export interface BrowsePage {
  results: SearchResult[];
  totalPages: number;
}

const withType = (results: any[], type: 'movie' | 'tv') => (results || []).map((r) => ({ ...r, media_type: r.media_type || type }));

export const fetchBrowsePage = async (p: BrowseParams, page: number, signal?: AbortSignal): Promise<BrowsePage> => {
  if (p.list === 'trending') {
    const t = p.type === 'all' ? 'all' : p.type;
    const data = await tmdbGet(`/trending/${t}/${p.window || 'week'}`, { page: String(page) }, signal);
    const results = withType(data.results, p.type === 'tv' ? 'tv' : 'movie').filter(
      (r: any) => (r.media_type === 'movie' || r.media_type === 'tv') && (r.backdrop_path || r.poster_path)
    );
    return { results, totalPages: Math.min(data.total_pages || 1, 500) };
  }

  const types: ('movie' | 'tv')[] = p.network ? ['tv'] : p.type === 'all' ? ['movie', 'tv'] : [p.type];
  const lists = await Promise.all(
    types.map(async (t) => {
      const params = discoverParams(t, p);
      if (!params) return { results: [] as SearchResult[], total: 0 };
      const data = await tmdbGet(`/discover/${t}`, { ...params, page: String(page) }, signal);
      return {
        results: withType(data.results, t).filter((r: any) => r.backdrop_path || r.poster_path) as SearchResult[],
        total: Math.min(data.total_pages || 0, 500),
      };
    })
  );
  return {
    results: lists.length > 1 ? mergeSorted(lists.map((l) => l.results), p.sort) : lists[0].results,
    totalPages: Math.max(0, ...lists.map((l) => l.total)),
  };
};
