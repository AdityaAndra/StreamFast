import type { SearchResult } from '../types';
import { tmdbGet } from '../services/tmdb';
import { GENRES } from '../constants';

export interface Credit {
  id: number;
  media_type: 'movie' | 'tv';
  title?: string;
  name?: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date?: string;
  first_air_date?: string;
  vote_average?: number;
  vote_count?: number;
  popularity: number;
  genre_ids?: number[];
  overview: string;
  character?: string;
  job?: string;
  department?: string;
  episode_count?: number;
  credit_id: string;
}

export interface PersonDetails {
  id: number;
  name: string;
  biography: string;
  birthday: string | null;
  deathday: string | null;
  place_of_birth: string | null;
  gender: number;
  known_for_department: string;
  also_known_as: string[];
  homepage: string | null;
  profile_path: string | null;
  popularity: number;
  external_ids?: { imdb_id?: string | null; wikidata_id?: string | null; instagram_id?: string | null; twitter_id?: string | null; facebook_id?: string | null; tiktok_id?: string | null; youtube_id?: string | null };
  images?: { profiles: { file_path: string; aspect_ratio: number; width: number; height: number }[] };
  combined_credits?: { cast: Credit[]; crew: Credit[] };
}

export interface PersonSummary {
  id: number;
  name: string;
  profile_path: string | null;
  known_for_department?: string;
  popularity?: number;
  known_for?: any[];
}

export interface Award { a: string; y?: string; f?: string; won: boolean }
export interface PersonExtra {
  awards: Award[];
  facts: {
    birthName?: string;
    nickname?: string;
    heightCm?: number;
    citizenship: string[];
    education: string[];
    spouses: { name: string; from?: string; to?: string }[];
    children?: number;
    occupations: string[];
  };
}

const slug = (s: string) =>
  s.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

export const personPath = (p: { id: number; name: string }) => `/person/${p.id}${slug(p.name) ? `-${slug(p.name)}` : ''}`;

export const getPerson = (id: number): Promise<PersonDetails> =>
  tmdbGet(`/person/${id}`, { append_to_response: 'combined_credits,images,external_ids' });

export const getPersonExtra = async (wd: string): Promise<PersonExtra> => {
  const r = await fetch(`/api/person?wd=${wd}`);
  if (!r.ok) throw new Error('Failed to load awards');
  return r.json();
};

export const searchPeople = async (q: string): Promise<PersonSummary[]> => {
  const data = await tmdbGet('/search/person', { query: q, include_adult: 'false' });
  return ((data.results || []) as PersonSummary[])
    .filter((p) => p.profile_path || (p.known_for && p.known_for.length))
    .sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
};

/* ---------- departments ---------- */

export const DEPT_ORDER = ['Acting', 'Directing', 'Writing', 'Production', 'Sound', 'Camera', 'Editing', 'Creator', 'Art', 'Costume & Make-Up', 'Visual Effects', 'Lighting', 'Crew'];

export const deptLabel = (dept: string, gender?: number) => {
  switch (dept) {
    case 'Acting': return gender === 1 ? 'Actress' : 'Actor';
    case 'Directing': return 'Director';
    case 'Writing': return 'Writer';
    case 'Production': return 'Producer';
    case 'Sound': return 'Music & Sound';
    case 'Camera': return 'Cinematography';
    case 'Editing': return 'Editor';
    case 'Art': return 'Art Department';
    default: return dept;
  }
};

/** Job shown under a person on a title page (crew roles we surface). */
export const KEY_CREW_JOBS: Record<string, string> = {
  Director: 'Director',
  'Original Music Composer': 'Music',
  Music: 'Music',
  Composer: 'Music',
  'Director of Photography': 'Cinematography',
  Cinematography: 'Cinematography',
  Screenplay: 'Writer',
  Writer: 'Writer',
  Novel: 'Novel',
  Story: 'Story',
  Creator: 'Creator',
  Producer: 'Producer',
  'Executive Producer': 'Executive Producer',
  Editor: 'Editor',
};

/* ---------- credits ---------- */

export const creditDate = (c: Credit) => c.release_date || c.first_air_date || '';
export const creditYear = (c: Credit) => creditDate(c).slice(0, 4);
export const creditTitle = (c: Credit) => c.title || c.name || '';
const TALK = new Set([10767, 10763, 10764]);
export const isSelf = (c: Credit) => /\b(him|her|them)sel(f|ves)\b|^self$/i.test((c.character || '').trim());
export const isUpcoming = (c: Credit) => {
  const d = creditDate(c);
  return !d || new Date(d).getTime() > Date.now();
};

export interface CreditRow {
  key: string;
  item: Credit;
  dept: string;
  roles: string[];
  episodes?: number;
}

export const buildRows = (p: PersonDetails, media: 'all' | 'movie' | 'tv'): CreditRow[] => {
  const rows = new Map<string, CreditRow>();
  const push = (c: Credit, dept: string, role: string) => {
    if (media !== 'all' && c.media_type !== media) return;
    const key = `${dept}|${c.media_type}|${c.id}`;
    const r = rows.get(key);
    if (r) {
      if (role && !r.roles.includes(role)) r.roles.push(role);
      if (c.episode_count) r.episodes = (r.episodes || 0) + c.episode_count;
    } else {
      rows.set(key, { key, item: c, dept, roles: role ? [role] : [], episodes: c.episode_count || undefined });
    }
  };
  (p.combined_credits?.cast || []).forEach((c) => push(c, 'Acting', c.character ? c.character : ''));
  (p.combined_credits?.crew || []).forEach((c) => push(c, c.department || 'Crew', c.job || ''));
  return [...rows.values()];
};

export const deptCounts = (rows: CreditRow[]) => {
  const m = new Map<string, number>();
  rows.forEach((r) => m.set(r.dept, (m.get(r.dept) || 0) + 1));
  return DEPT_ORDER.filter((d) => m.has(d)).map((d) => [d, m.get(d)!] as [string, number]);
};

export type CreditSort = 'newest' | 'oldest' | 'popular' | 'rating' | 'az';

export const sortRows = (rows: CreditRow[], sort: CreditSort) => {
  const list = [...rows];
  const d = (r: CreditRow) => creditDate(r.item) || '9999-12-31';
  switch (sort) {
    case 'oldest': return list.sort((a, b) => d(a).localeCompare(d(b)));
    case 'popular': return list.sort((a, b) => (b.item.popularity || 0) - (a.item.popularity || 0));
    case 'rating': {
      const v = (r: CreditRow) => ((r.item.vote_count || 0) >= 20 ? r.item.vote_average || 0 : -1);
      return list.sort((a, b) => v(b) - v(a));
    }
    case 'az': return list.sort((a, b) => creditTitle(a.item).localeCompare(creditTitle(b.item)));
    default: return list.sort((a, b) => d(b).localeCompare(d(a)));
  }
};

/** Netflix-style "Known For": the person's most-seen titles in their main department. */
export const knownFor = (p: PersonDetails, media: 'all' | 'movie' | 'tv', limit = 14): SearchResult[] => {
  const all = buildRows(p, media);
  const main = p.known_for_department || 'Acting';
  let pool = all.filter((r) => r.dept === main);
  if (pool.length < 4) pool = all;
  const score = (r: CreditRow) => {
    const c = r.item;
    let s = (c.vote_count || 0) + (c.popularity || 0) * 3;
    if (isSelf(c)) s *= 0.03;
    if ((c.genre_ids || []).some((g) => TALK.has(g))) s *= 0.02;
    if (c.media_type === 'tv' && r.dept === 'Acting' && (r.episodes || 0) < 3) s *= 0.15;
    if (!c.backdrop_path && !c.poster_path) s = 0;
    return s;
  };
  const seen = new Set<string>();
  return pool
    .sort((a, b) => score(b) - score(a))
    .filter((r) => {
      const k = `${r.item.media_type}-${r.item.id}`;
      if (seen.has(k) || score(r) <= 0) return false;
      seen.add(k);
      return true;
    })
    .slice(0, limit)
    .map((r) => r.item as unknown as SearchResult);
};

/* ---------- personal details ---------- */

export const parseDate = (s?: string | null) => (s ? new Date(`${s}T00:00:00`) : null);
export const fmtDate = (s?: string | null) =>
  s ? parseDate(s)!.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '';
export const ageOf = (birth?: string | null, death?: string | null) => {
  const b = parseDate(birth);
  if (!b) return null;
  const e = parseDate(death) || new Date();
  let age = e.getFullYear() - b.getFullYear();
  const m = e.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && e.getDate() < b.getDate())) age--;
  return age;
};
export const fmtHeight = (cm?: number) => {
  if (!cm) return '';
  const inches = Math.round(cm / 2.54);
  return `${(cm / 100).toFixed(2)} m (${Math.floor(inches / 12)}′ ${inches % 12}″)`;
};

/* ---------- trivia (computed from the filmography) ---------- */

export const buildTrivia = (p: PersonDetails, extra?: PersonExtra): string[] => {
  const rows = buildRows(p, 'all');
  const facts: string[] = [];
  const dated = rows.filter((r) => creditDate(r.item) && !isUpcoming(r.item));
  const movies = new Set(rows.filter((r) => r.item.media_type === 'movie').map((r) => r.item.id)).size;
  const shows = new Set(rows.filter((r) => r.item.media_type === 'tv').map((r) => r.item.id)).size;
  const counts = deptCounts(rows);

  if (rows.length) {
    facts.push(
      `Has ${rows.length} credits across ${movies} movie${movies === 1 ? '' : 's'} and ${shows} TV show${shows === 1 ? '' : 's'}` +
        (counts.length > 1 ? `, working as ${counts.slice(0, 4).map(([d]) => deptLabel(d, p.gender).toLowerCase()).join(', ')}.` : '.')
    );
  }

  const first = [...dated].sort((a, b) => creditDate(a.item).localeCompare(creditDate(b.item)))[0];
  if (first) {
    const age = ageOf(p.birthday, creditDate(first.item));
    facts.push(
      `Earliest credit: ${creditTitle(first.item)} (${creditYear(first.item)})` +
        (first.roles[0] ? `, ${first.dept === 'Acting' ? `as ${first.roles[0]}` : first.roles[0].toLowerCase()}` : '') +
        (age !== null && age >= 0 && age < 100 ? ` — at about ${age} years old.` : '.')
    );
  }

  const rated = dated.filter((r) => (r.item.vote_count || 0) >= 500 && !isSelf(r.item));
  const best = [...rated].sort((a, b) => (b.item.vote_average || 0) - (a.item.vote_average || 0))[0];
  if (best) facts.push(`Highest-rated title on TMDB: ${creditTitle(best.item)} (${creditYear(best.item)}), rated ${best.item.vote_average!.toFixed(1)}/10.`);

  const popular = [...dated].sort((a, b) => (b.item.vote_count || 0) - (a.item.vote_count || 0))[0];
  if (popular && popular !== best) facts.push(`Most widely seen title: ${creditTitle(popular.item)} (${creditYear(popular.item)}), with over ${(popular.item.vote_count || 0).toLocaleString()} TMDB ratings.`);

  const byYear = new Map<string, number>();
  dated.forEach((r) => byYear.set(creditYear(r.item), (byYear.get(creditYear(r.item)) || 0) + 1));
  const busiest = [...byYear.entries()].sort((a, b) => b[1] - a[1])[0];
  if (busiest && busiest[1] >= 3) facts.push(`Busiest year: ${busiest[0]}, with ${busiest[1]} credits.`);

  const genreCount = new Map<number, number>();
  rows.forEach((r) => (r.item.genre_ids || []).forEach((g) => genreCount.set(g, (genreCount.get(g) || 0) + 1)));
  const topGenres = [...genreCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([g]) => GENRES[g]).filter(Boolean);
  if (topGenres.length) facts.push(`Works most often in ${topGenres.join(', ').replace(/, ([^,]*)$/, ' and $1')}.`);

  const longest = rows.filter((r) => r.item.media_type === 'tv' && r.dept === 'Acting' && !isSelf(r.item)).sort((a, b) => (b.episodes || 0) - (a.episodes || 0))[0];
  if (longest && (longest.episodes || 0) >= 5) facts.push(`Longest TV run: ${longest.episodes} episodes of ${creditTitle(longest.item)}${longest.roles[0] ? ` as ${longest.roles[0]}` : ''}.`);

  const span = dated.map((r) => Number(creditYear(r.item))).filter(Boolean);
  if (span.length > 1) {
    const years = Math.max(...span) - Math.min(...span);
    if (years >= 5) facts.push(`Career spans ${years} years on screen (${Math.min(...span)}–${Math.max(...span)}).`);
  }

  const upcoming = new Set(rows.filter((r) => isUpcoming(r.item)).map((r) => `${r.item.media_type}-${r.item.id}`)).size;
  if (upcoming) facts.push(`Has ${upcoming} upcoming project${upcoming === 1 ? '' : 's'} listed.`);

  if (extra?.awards?.length) {
    const won = extra.awards.filter((a) => a.won).length;
    if (won) facts.push(`Has won ${won} award${won === 1 ? '' : 's'} recorded on Wikidata, from ${extra.awards.length} wins and nominations in total.`);
  }
  if (extra?.facts?.birthName && extra.facts.birthName !== p.name) facts.push(`Born ${extra.facts.birthName}.`);
  if ((p.also_known_as || []).length > 2) facts.push(`Also credited under ${p.also_known_as.length} other names and spellings.`);
  return facts;
};
