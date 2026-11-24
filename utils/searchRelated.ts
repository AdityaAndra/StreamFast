import type { SearchResult } from '../types';
import { tmdbGet } from '../services/tmdb';
import { getTitle, titlePath } from './media';
import { personPath, PersonSummary } from './person';

/**
 * Netflix-style search: the best matches first, then titles actually related to the
 * top match (recommendations / similar), and an "Explore titles related to:" line of
 * real links (the title, its franchise, director, genres and themes).
 */

export interface ExploreLink {
  label: string;
  to: string;
}

const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

/** Real, findable titles (not obscure one-offs with no artwork or votes). */
const isSolid = (r: SearchResult) => !!(r.poster_path || r.backdrop_path) && ((r as any).vote_count >= 20 || r.popularity >= 4);

const score = (r: SearchResult, q: string) => {
  const t = norm(getTitle(r) || '');
  const o = norm((r as any).original_title || (r as any).original_name || '');
  const nq = norm(q);
  let s = Math.log10(1 + ((r as any).vote_count || 0)) * 2 + Math.log10(1 + (r.popularity || 0));
  if (t === nq || o === nq) s += 6;
  else if (t.startsWith(nq)) s += 3;
  else if (t.includes(nq)) s += 1;
  if (!(r.poster_path || r.backdrop_path)) s -= 4;
  return s;
};

/** Strong matches (best first) and weak ones (obscure, kept for the end). */
export const rankSearch = (results: SearchResult[], q: string) => {
  const ranked = [...results].sort((a, b) => score(b, q) - score(a, q));
  const strong = ranked.filter(isSolid);
  const weak = ranked.filter((r) => !isSolid(r));
  return { strong: strong.length ? strong : weak.slice(0, 6), weak: strong.length ? weak : weak.slice(6) };
};

// Keywords that describe production trivia rather than what a title is about.
const JUNK_KEYWORDS = /stinger|woman director|based on|sequel|remake|3d|imax|duringcredits|aftercredits|anime|live action|short film|^(usa|new york city|london)$/i;

const keywordTitle = (name: string, type: 'movie' | 'tv') => {
  const nice = name.replace(/\b\w/g, (c) => c.toUpperCase());
  return `${nice} ${type === 'movie' ? 'Movies' : 'TV Shows'}`;
};

export interface SearchRelated {
  titles: SearchResult[];
  explore: ExploreLink[];
}

export const fetchSearchRelated = async (top: SearchResult): Promise<SearchRelated> => {
  const type = top.media_type;
  const d: any = await tmdbGet(`/${type}/${top.id}`, { append_to_response: 'keywords,recommendations,similar,credits' });

  const seen = new Set<string>([`${type}:${top.id}`]);
  const titles: SearchResult[] = [];
  const add = (list: any[] = []) =>
    list.forEach((r) => {
      const mt = r.media_type === 'movie' || r.media_type === 'tv' ? r.media_type : type;
      const key = `${mt}:${r.id}`;
      if (seen.has(key) || !(r.backdrop_path || r.poster_path)) return;
      seen.add(key);
      titles.push({ ...r, media_type: mt });
    });
  add(d.recommendations?.results);
  add(d.similar?.results);

  const explore: ExploreLink[] = [{ label: getTitle(top), to: titlePath(top) }];
  if (d.belongs_to_collection?.id) {
    explore.push({ label: String(d.belongs_to_collection.name).replace(/\s*-\s*Collection$/i, ' Collection'), to: `/franchise/${d.belongs_to_collection.id}` });
  }
  const lead =
    type === 'tv'
      ? (d.created_by || [])[0]
      : (d.credits?.crew || []).find((c: any) => c.job === 'Director');
  if (lead?.id) explore.push({ label: lead.name, to: personPath(lead) });
  const star = (d.credits?.cast || [])[0];
  if (star?.id) explore.push({ label: star.name, to: personPath(star) });
  (d.genres || []).slice(0, 2).forEach((g: any) =>
    explore.push({ label: `${g.name} ${type === 'movie' ? 'Movies' : 'TV Shows'}`, to: `/browse?type=${type}&genre=${g.id}` })
  );
  const kws: any[] = d.keywords?.keywords || d.keywords?.results || [];
  kws
    .filter((k) => k?.id && k.name && !JUNK_KEYWORDS.test(k.name))
    .slice(0, 3)
    .forEach((k) => {
      const title = keywordTitle(k.name, type);
      explore.push({ label: title, to: `/browse?type=${type}&keyword=${k.id}&title=${encodeURIComponent(title)}` });
    });

  return { titles, explore };
};

/** When the search is a person ("hans zimmer"): link them and what they're known for. */
export const personExplore = (p: PersonSummary): ExploreLink[] => [
  { label: p.name, to: personPath(p) },
  ...(p.known_for || [])
    .filter((k: any) => k && (k.media_type === 'movie' || k.media_type === 'tv'))
    .slice(0, 4)
    .map((k: any) => ({ label: k.title || k.name, to: titlePath(k) })),
];
