import { useCachedData } from './useCachedData';

export interface Brand {
  key: string;
  name: string;
  /** TMDB company ids, pipe = OR (e.g. all DC labels) */
  ids: string;
  /** company whose logo represents the brand */
  logoId: number;
}

/** Franchise studios (Marvel, DC, Pixar…) */
export const STUDIOS: Brand[] = [
  { key: 'marvel', name: 'Marvel Studios', ids: '420|7505|38679', logoId: 420 },
  { key: 'dc', name: 'DC', ids: '429|9993|128064', logoId: 429 },
  { key: 'pixar', name: 'Pixar', ids: '3', logoId: 3 },
  { key: 'disney-animation', name: 'Walt Disney Animation Studios', ids: '6125', logoId: 6125 },
  { key: 'lucasfilm', name: 'Lucasfilm', ids: '1', logoId: 1 },
  { key: 'dreamworks', name: 'DreamWorks Animation', ids: '521', logoId: 521 },
  { key: 'illumination', name: 'Illumination', ids: '6704', logoId: 6704 },
  { key: 'ghibli', name: 'Studio Ghibli', ids: '10342', logoId: 10342 },
  { key: 'sony-animation', name: 'Sony Pictures Animation', ids: '2251', logoId: 2251 },
  { key: 'laika', name: 'Laika', ids: '11537', logoId: 11537 },
  { key: 'blue-sky', name: 'Blue Sky Studios', ids: '9383', logoId: 9383 },
  { key: 'aardman', name: 'Aardman', ids: '297', logoId: 297 },
  { key: 'toho', name: 'Toho', ids: '882', logoId: 882 },
];

/** Big production companies */
export const PRODUCTION_HOUSES: Brand[] = [
  { key: 'warner-bros', name: 'Warner Bros. Pictures', ids: '174', logoId: 174 },
  { key: 'universal', name: 'Universal Pictures', ids: '33', logoId: 33 },
  { key: 'paramount', name: 'Paramount Pictures', ids: '4', logoId: 4 },
  { key: 'disney', name: 'Walt Disney Pictures', ids: '2', logoId: 2 },
  { key: 'columbia', name: 'Columbia Pictures', ids: '5', logoId: 5 },
  { key: '20th-century', name: '20th Century Studios', ids: '25|127928', logoId: 25 },
  { key: 'lionsgate', name: 'Lionsgate', ids: '1632', logoId: 1632 },
  { key: 'a24', name: 'A24', ids: '41077', logoId: 41077 },
  { key: 'legendary', name: 'Legendary Pictures', ids: '923', logoId: 923 },
  { key: 'blumhouse', name: 'Blumhouse Productions', ids: '3172', logoId: 3172 },
  { key: 'amblin', name: 'Amblin Entertainment', ids: '56', logoId: 56 },
  { key: 'new-line', name: 'New Line Cinema', ids: '12', logoId: 12 },
  { key: 'mgm', name: 'Metro-Goldwyn-Mayer', ids: '21', logoId: 21 },
  { key: 'skydance', name: 'Skydance', ids: '82819', logoId: 82819 },
  { key: 'bad-robot', name: 'Bad Robot', ids: '11461', logoId: 11461 },
  { key: 'plan-b', name: 'Plan B Entertainment', ids: '81', logoId: 81 },
  { key: 'working-title', name: 'Working Title Films', ids: '10163', logoId: 10163 },
  { key: 'focus', name: 'Focus Features', ids: '10146', logoId: 10146 },
  { key: 'miramax', name: 'Miramax', ids: '14', logoId: 14 },
];

/** TMDB collections ("Popular Franchises") */
export const FRANCHISE_IDS = [
  86311, 1241, 10, 645, 9485, 119, 87359, 328, 404609, 263, 131635, 295, 2344, 10194, 8650, 531241, 748, 87096, 726871, 448150,
  2150, 86066, 84, 264, 8091, 528, 313086, 535313, 77816, 386382, 284433, 121938,
];

export const findBrand = (key: string) => [...STUDIOS, ...PRODUCTION_HOUSES].find((b) => b.key === key);

export interface CompanyInfo { name: string; logo: string | null }
export interface CollectionInfo { name: string; overview: string; poster: string | null; backdrop: string | null; count: number }
export interface ProviderInfo { id: number; name: string; logo: string | null }

const getJSON = async <T,>(url: string): Promise<T> => {
  const r = await fetch(url);
  if (!r.ok) throw new Error('Failed to load');
  return r.json();
};

export const useCompanies = (ids: number[]) =>
  useCachedData<Record<string, CompanyInfo | null>>(ids.length ? `brands:c:${ids.join(',')}` : null, () =>
    getJSON(`/api/brands?kind=companies&ids=${ids.join(',')}`)
  );

export const useCollections = (ids: number[]) =>
  useCachedData<Record<string, CollectionInfo | null>>(ids.length ? `brands:f:${ids.join(',')}` : null, () =>
    getJSON(`/api/brands?kind=collections&ids=${ids.join(',')}`)
  );

export const useProviders = (region: string | null) =>
  useCachedData<{ region: string; providers: ProviderInfo[] }>(region ? `brands:p:${region}` : null, () => getJSON(`/api/brands?kind=providers&region=${region}`));

/* ---------- Watch region (for "Streaming on…" availability) ---------- */

export const REGIONS: [string, string][] = [
  ['US', 'United States'], ['GB', 'United Kingdom'], ['CA', 'Canada'], ['AU', 'Australia'], ['IN', 'India'], ['IE', 'Ireland'],
  ['NZ', 'New Zealand'], ['DE', 'Germany'], ['FR', 'France'], ['ES', 'Spain'], ['IT', 'Italy'], ['NL', 'Netherlands'],
  ['SE', 'Sweden'], ['NO', 'Norway'], ['DK', 'Denmark'], ['PL', 'Poland'], ['BR', 'Brazil'], ['MX', 'Mexico'],
  ['AR', 'Argentina'], ['JP', 'Japan'], ['KR', 'South Korea'], ['SG', 'Singapore'], ['PH', 'Philippines'],
  ['AE', 'United Arab Emirates'], ['ZA', 'South Africa'], ['TR', 'Turkey'],
];

const REGION_KEY = 'sf_region';

export const getRegion = (): string => {
  try {
    const saved = localStorage.getItem(REGION_KEY);
    if (saved && REGIONS.some((r) => r[0] === saved)) return saved;
  } catch {
    /* ignore */
  }
  const m = (navigator.language || '').match(/-([a-z]{2})$/i);
  const guess = m ? m[1].toUpperCase() : 'US';
  return REGIONS.some((r) => r[0] === guess) ? guess : 'US';
};

export const saveRegion = (region: string) => {
  try {
    localStorage.setItem(REGION_KEY, region);
  } catch {
    /* ignore */
  }
};

export const regionName = (region: string) => REGIONS.find((r) => r[0] === region)?.[1] || region;
