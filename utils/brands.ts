import { useCachedData } from './useCachedData';
import { notifyLocalDataChange } from '../services/storage';

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

/** Official title logos for the Popular Franchises (TMDB has no logos for collections, so each one uses the
 *  logo of the film that carries the franchise name). Checked by eye; franchises not listed fall back to text. */
export const FRANCHISE_LOGOS: Record<number, string> = {
  86311: '/2VLCNzMOGayRGdiSGyaOD0MzA3Y.png', // The Avengers (from The Avengers)
  1241: '/n7Pj4doQ1yfElCiGTGFTvzoQkpf.png', // Harry Potter (from Harry Potter and the Philosopher's Stone)
  10: '/vswPivs3yuUsk5aW6DbnyeNQ4GX.png', // Star Wars (from Star Wars)
  645: '/kqKmAtdICZFz7dURG0AGoH7Mbbb.png', // James Bond (gold 007 from No Time to Die)
  9485: '/jCbjdbiG1BtiX4aqhvgf6YdXuIq.png', // The Fast and the Furious (from The Fast and the Furious)
  119: '/87sl6r7n7Qx0fALtLZFxM3mU3KM.png', // The Lord of the Rings (from The Lord of the Rings: The Fellowship of the Ring)
  87359: '/d4Nk4FAlEoHLNEny88SQ7Jk9ZsZ.png', // Mission: Impossible (from Mission: Impossible)
  328: '/djIhZiHr974aA5Cyprgal4YAJDl.png', // Jurassic Park (from Jurassic Park)
  404609: '/eVXvH6j4qM8ZEqZfw5bZ6JGQxqZ.png', // John Wick (from John Wick)
  263: '/nO5Uix3Qr4WjOyU1BMPv0okyNWm.png', // The Dark Knight (from The Dark Knight)
  131635: '/hJA3edSToEmAXHKSiDjTb4ZtM7H.png', // The Hunger Games (from The Hunger Games)
  295: '/o0s0xqUcaWWv0Kh3QYmfxSQjmPD.png', // Pirates of the Caribbean (from Pirates of the Caribbean: The Curse of the Black Pearl)
  2344: '/xslT5YyQOaqcVKAZxcoq2YbcbEf.png', // The Matrix (from The Matrix)
  10194: '/eX8LcW1zdjxvWNB5ZsZuhPO7NtP.png', // Toy Story (from Toy Story)
  8650: '/ozzvPYVLxYwXgspOrF5CyDP2A8S.png', // Transformers (from Transformers)
  531241: '/dBuI6v9X484QeG3fb4oH8RJ7021.png', // Spider-Man (MCU) (from Spider-Man: Homecoming)
  748: '/bfUbOGdmttSCvar958KkUJlEOiQ.png', // X-Men (from X-Men)
  87096: '/bET8bJdM8diTCpUVilWqqu0M3EJ.png', // Avatar (from Avatar)
  726871: '/hlnyMaUxeFJTb3QL1hKpHwhWowC.png', // Dune (from Dune)
  448150: '/piuamNKC09lepRcjrWx9GfEa8hN.png', // Deadpool (from Deadpool)
  2150: '/mEtAnquVJzgMwmBeZNw4fhccj2s.png', // Shrek (from Shrek)
  86066: '/hrAeReyKsy89ue9bMWKuTJ57GGz.png', // Despicable Me (from Despicable Me)
  84: '/tPI0BNiiGbVAPIrO8kcBWajM6He.png', // Indiana Jones (from Raiders of the Lost Ark)
  264: '/7hXsyx9em5FhNdeEf0tehFmG06r.png', // Back to the Future (from Back to the Future)
  8091: '/riI33EA1vYQ1szTtMe0NR7TwV1p.png', // Alien (from Alien)
  528: '/6hBVMofGYDOC20yYiQeOnuHmK9d.png', // The Terminator (from The Terminator)
  313086: '/oFieLsWzLyaSh3fywpuSIq3gEit.png', // The Conjuring (from The Conjuring)
  535313: '/z5pLdgfhfLy9vRRyAMgXLy2TFir.png', // Godzilla (from Godzilla)
  77816: '/gkpcd4k3IrkqIAqRBNLLjBHGYyr.png', // Kung Fu Panda (from Kung Fu Panda)
  386382: '/r05nI8WQvBbdvuwVXtXuvOi0cJ9.png', // Frozen (from Frozen)
  284433: '/tikZxXefORICSFaRxEJ01YEfOu1.png', // Guardians of the Galaxy (from Guardians of the Galaxy)
  121938: '/h5DwmLJAw9xr9Sx33G0ckg7yjTB.png', // The Hobbit (from The Hobbit: An Unexpected Journey)
};
export const franchiseLogo = (id: number, size: 'w300' | 'w500' = 'w500') => {
  const p = FRANCHISE_LOGOS[id];
  return p ? `https://image.tmdb.org/t/p/${size}${p}` : null;
};

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
    notifyLocalDataChange('region');
  } catch {
    /* ignore */
  }
};

export const regionName = (region: string) => REGIONS.find((r) => r[0] === region)?.[1] || region;
