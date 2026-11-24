import type { SearchResult } from '../types';
import { tmdbGet } from '../services/tmdb';
import { getTitle, titlePath } from './media';
import { personPath, PersonSummary } from './person';

/**
 * Netflix-style search: the best matches first, then titles actually related to the
 * top match, and an "Explore titles related to:" line of real links (the title, its
 * franchise, director, star, genres and themes).
 *
 * TMDB's own "recommendations"/"similar" lists are often poor (Inception -> Paycheck,
 * The Big Lebowski), so related titles are built from stronger signals and ranked:
 * same franchise > same director/creator > shared themes + genre > TMDB recommendations.
 */

export interface ExploreLink {
  label: string;
  to: string;
}

const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const votes = (r: any) => Number(r?.vote_count || 0);
const hasArt = (r: any) => !!(r?.poster_path || r?.backdrop_path);

const score = (r: SearchResult, q: string) => {
  const t = norm(getTitle(r) || '');
  const o = norm((r as any).original_title || (r as any).original_name || '');
  const nq = norm(q);
  let s = Math.log10(1 + votes(r)) * 2 + Math.log10(1 + (r.popularity || 0));
  if (t === nq || o === nq) s += 6;
  else if (t.startsWith(nq)) s += 3;
  else if (t.includes(nq)) s += 1;
  if (!hasArt(r)) s -= 4;
  return s;
};

/**
 * strong: well-known matches (shown first) · medium: real but minor matches (after the
 * related titles) · weak: obscure one-offs (at the very end).
 */
export const rankSearch = (results: SearchResult[], q: string) => {
  const ranked = [...results].sort((a, b) => score(b, q) - score(a, q));
  const topVotes = Math.max(0, ...ranked.filter(hasArt).map(votes));
  const bar = Math.max(20, topVotes * 0.01);
  const strong: SearchResult[] = [];
  const medium: SearchResult[] = [];
  const weak: SearchResult[] = [];
  ranked.forEach((r) => {
    if (!hasArt(r) || (votes(r) < 5 && (r.popularity || 0) < 2)) weak.push(r);
    else if (votes(r) >= bar || (r.popularity || 0) >= 10) strong.push(r);
    else medium.push(r);
  });
  if (!strong.length) strong.push(...medium.splice(0, 6));
  if (!strong.length) strong.push(...weak.splice(0, 6));
  return { strong, medium, weak };
};

/* ---------------------------------------------------------------- themes */

// Production trivia rather than what a title is about.
const JUNK_KEYWORDS =
  /stinger|woman director|based on|sequel|remake|prequel|3d|imax|duringcredits|aftercredits|live action|short film|anime|cartoon|female protagonist|male protagonist|new york|london|paris|los angeles|tokyo|^\d+(s|th century)$|^(usa|uk|france|japan)$/i;

// Distinctive themes, preferred over generic plot words, with Netflix-style names.
const THEMES: [RegExp, string][] = [
  [/dream|subconscious|lucid|mind ?bend|mindfuck|reality|simulation|virtual reality|parallel (world|universe)|multiverse/i, 'Mind-Bending'],
  [/time travel|time loop|time machine/i, 'Time Travel'],
  [/heist|robbery|bank robber|con artist|caper/i, 'Heist'],
  [/artificial intelligence|\bai\b|android|robot|cyborg/i, 'AI & Robot'],
  [/space|astronaut|outer space|spacecraft|planet/i, 'Space'],
  [/alien/i, 'Alien'],
  [/dystopia|post-apocalyptic|apocalypse/i, 'Dystopian'],
  [/superhero|super power|comic book|based on comic/i, 'Superhero'],
  [/serial killer/i, 'Serial Killer'],
  [/zombie/i, 'Zombie'],
  [/vampire/i, 'Vampire'],
  [/haunted|ghost|possession|demon/i, 'Supernatural'],
  [/revenge|vengeance/i, 'Revenge'],
  [/conspiracy|cover-up/i, 'Conspiracy'],
  [/spy|espionage|secret agent/i, 'Spy'],
  [/survival/i, 'Survival'],
  [/psychological|psychopath|paranoia|mental illness/i, 'Psychological'],
  [/martial arts|kung fu/i, 'Martial Arts'],
  [/gangster|mafia|organized crime|crime boss|drug cartel/i, 'Gangster'],
  [/courtroom|lawyer/i, 'Legal'],
  [/high school|teenager|coming of age/i, 'Coming-of-Age'],
  [/romance|love triangle|forbidden love/i, 'Romantic'],
  [/war|soldier|world war/i, 'War'],
  [/true story|biography|biopic/i, 'Based on a True Story'],
];

interface Theme {
  label: string;
  ids: number[];
}

const pickThemes = (kws: { id: number; name: string }[]): Theme[] => {
  const byLabel = new Map<string, number[]>();
  kws.forEach((k) => {
    const hit = THEMES.find(([re]) => re.test(k.name));
    if (hit) byLabel.set(hit[1], [...(byLabel.get(hit[1]) || []), k.id]);
  });
  const themes: Theme[] = [...byLabel.entries()].map(([label, ids]) => ({ label, ids }));
  // Fall back to the title's own (non-trivial) keywords when no known theme matched.
  if (themes.length < 2) {
    kws
      .filter((k) => !JUNK_KEYWORDS.test(k.name) && !THEMES.some(([re]) => re.test(k.name)))
      .slice(0, 2 - themes.length)
      .forEach((k) => themes.push({ label: k.name.replace(/\b\w/g, (c) => c.toUpperCase()), ids: [k.id] }));
  }
  return themes.slice(0, 3);
};

/* ---------------------------------------------------------------- related titles */

export interface SearchRelated {
  titles: SearchResult[];
  explore: ExploreLink[];
}

export const fetchSearchRelated = async (top: SearchResult): Promise<SearchRelated> => {
  const type = top.media_type;
  const noun = type === 'movie' ? 'Movies' : 'TV Shows';
  const d: any = await tmdbGet(`/${type}/${top.id}`, { append_to_response: 'keywords,recommendations,credits' });

  const genreIds: number[] = (d.genres || []).map((g: any) => g.id);
  const kws: { id: number; name: string }[] = d.keywords?.keywords || d.keywords?.results || [];
  const themes = pickThemes(kws);
  const lead = type === 'tv' ? (d.created_by || [])[0] : (d.credits?.crew || []).find((c: any) => c.job === 'Director');
  const star = (d.credits?.cast || [])[0];
  const leadJobs = type === 'tv' ? ['Creator', 'Executive Producer', 'Writer'] : ['Director'];

  const safe = <T,>(p: Promise<T>) => p.catch(() => null as T | null);
  const [collection, leadCredits, themed] = await Promise.all([
    d.belongs_to_collection?.id ? safe(tmdbGet(`/collection/${d.belongs_to_collection.id}`)) : Promise.resolve(null),
    lead?.id ? safe(tmdbGet(`/person/${lead.id}/combined_credits`)) : Promise.resolve(null),
    themes.length
      ? safe(
          tmdbGet(`/discover/${type}`, {
            with_keywords: themes.flatMap((t) => t.ids).join('|'),
            ...(genreIds[0] ? { with_genres: String(genreIds[0]) } : {}),
            sort_by: 'vote_count.desc',
            'vote_count.gte': '200',
            include_adult: 'false',
          })
        )
      : Promise.resolve(null),
  ]);

  // Score every candidate: where it came from + shared genres + how well-known it is.
  const pool = new Map<string, { r: SearchResult; s: number }>();
  const offer = (list: any[] | undefined, bonus: number, forceType?: 'movie' | 'tv') =>
    (list || []).forEach((r) => {
      const mt = forceType || (r.media_type === 'movie' || r.media_type === 'tv' ? r.media_type : type);
      if (!hasArt(r) || (mt === type && r.id === top.id) || r.adult) return;
      if (votes(r) < 50) return; // skip obscure titles
      const shared = (r.genre_ids || []).filter((g: number) => genreIds.includes(g)).length;
      const s = bonus + shared * 1.2 + Math.log10(1 + votes(r));
      const key = `${mt}:${r.id}`;
      const prev = pool.get(key);
      if (!prev) pool.set(key, { r: { ...r, media_type: mt }, s });
      else prev.s += bonus * 0.5; // found by more than one signal: more related
    });

  offer(collection?.parts, 8, 'movie');
  const leadWorks = ((leadCredits?.crew || []) as any[]).filter((c) => leadJobs.includes(c.job) && (c.media_type === 'movie' || c.media_type === 'tv'));
  offer(leadWorks.sort((a, b) => votes(b) - votes(a)).slice(0, 10), 4);
  offer(themed?.results?.slice(0, 16), 3, type);
  offer(
    (d.recommendations?.results || []).filter((r: any) => (r.genre_ids || []).some((g: number) => genreIds.includes(g)) && votes(r) >= 300),
    1.5
  );

  const titles = [...pool.values()].sort((a, b) => b.s - a.s).map((x) => x.r).slice(0, 30);

  /* ---- "Explore titles related to:" ---- */
  const explore: ExploreLink[] = [{ label: getTitle(top), to: titlePath(top) }];
  if (d.belongs_to_collection?.id) {
    explore.push({ label: String(d.belongs_to_collection.name), to: `/franchise/${d.belongs_to_collection.id}` });
  }
  if (lead?.id) explore.push({ label: lead.name, to: personPath(lead) });
  if (star?.id) explore.push({ label: star.name, to: personPath(star) });
  themes.forEach((t) => {
    const title = `${t.label} ${noun}`;
    explore.push({ label: title, to: `/browse?type=${type}&keyword=${encodeURIComponent(t.ids.join('|'))}&title=${encodeURIComponent(title)}` });
  });
  (d.genres || []).slice(0, 2).forEach((g: any) => explore.push({ label: `${g.name} ${noun}`, to: `/browse?type=${type}&genre=${g.id}` }));

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
