import type { SearchResult } from '../types';
import * as tmdb from '../services/tmdb';
import { toQuery, BrowseParams } from './browse';
import type { BrandKind } from './router';
import { onlyOut } from './release';

export interface RowDef {
  id: string;
  title: string;
  kind?: 'row' | 'top10' | 'brands';
  load?: () => Promise<SearchResult[]>;
  /** "View all" destination (omitted for Top 10 rows). */
  viewAll?: string;
  brand?: BrandKind;
  mediaType?: 'movie' | 'tv';
  /** A Coming Soon row: shows only titles that aren't out yet (every other row leaves them out). */
  soon?: boolean;
}

const browse = (p: Partial<BrowseParams>) => `/browse${toQuery({ type: 'all', sort: 'popular', ...p })}`;

const genre = (type: 'movie' | 'tv', withGenres: string, extra: Record<string, string> = {}) => () =>
  tmdb.discover(type, { with_genres: withGenres, ...extra });

const anime = () => tmdb.discover('tv', { with_genres: '16', with_original_language: 'ja', 'vote_count.gte': '40' });
const kdramas = () => tmdb.discover('tv', { with_genres: '18', with_original_language: 'ko', 'vote_count.gte': '20' });

const g = (id: string, title: string, type: 'movie' | 'tv', withGenres: string, extra: Record<string, string> = {}, browseExtra: Partial<BrowseParams> = {}): RowDef => ({
  id, title, load: genre(type, withGenres, extra), viewAll: browse({ type, genre: withGenres, ...browseExtra }),
});

const brands = (brand: BrandKind, title: string, mediaType?: 'movie' | 'tv'): RowDef => ({ id: `brands-${brand}`, title, kind: 'brands', brand, mediaType });

// Banners only feature titles that are out (in cinemas or digitally); coming-soon ones stay in Coming Soon.
export const HOME_HERO = async () => onlyOut(await tmdb.getTrending());

export const HOME_ROWS: RowDef[] = [
  { id: 'top10-tv', title: 'Top 10 TV Shows Today', kind: 'top10', load: () => tmdb.getTrendingTv('day') },
  { id: 'trending', title: 'Trending Now', load: () => tmdb.getTrending(), viewAll: browse({ list: 'trending', window: 'week' }) },
  { id: 'new-releases', title: 'New Releases', load: () => tmdb.getNowPlayingMovies(), viewAll: browse({ type: 'movie', list: 'new' }) },
  { id: 'top10-movies', title: 'Top 10 Movies Today', kind: 'top10', load: () => tmdb.getTrendingMovies('day') },
  { id: 'popular-movies', title: 'Popular Movies', load: () => tmdb.getPopularMovies(), viewAll: browse({ type: 'movie' }) },
  brands('providers', 'Streaming Services'),
  { id: 'bingeworthy', title: 'Bingeworthy TV Shows', load: () => tmdb.getPopularTvShows(), viewAll: browse({ type: 'tv' }) },
  g('action', 'Action & Adventure Movies', 'movie', '28|12'),
  { id: 'acclaimed-movies', title: 'Critically Acclaimed Movies', load: () => tmdb.getTopRatedMovies(), viewAll: browse({ type: 'movie', sort: 'rating' }) },
  brands('studios', 'Studios'),
  g('comedies', 'Comedies', 'movie', '35'),
  { id: 'anime', title: 'Anime', load: anime, viewAll: browse({ type: 'tv', genre: '16', lang: 'ja' }) },
  g('scifi', 'Sci-Fi & Fantasy Movies', 'movie', '878|14'),
  brands('franchises', 'Popular Franchises'),
  g('thrillers', 'Thrillers', 'movie', '53'),
  { id: 'kdramas', title: 'K-Dramas', load: kdramas, viewAll: browse({ type: 'tv', genre: '18', lang: 'ko' }) },
  g('crime-tv', 'Crime TV Shows', 'tv', '80'),
  brands('production', 'Production Houses'),
  g('horror', 'Horror Movies', 'movie', '27'),
  g('romance', 'Romantic Movies', 'movie', '10749'),
  { id: 'acclaimed-tv', title: 'Critically Acclaimed TV Shows', load: () => tmdb.getTopRatedTvShows(), viewAll: browse({ type: 'tv', sort: 'rating' }) },
  g('family', 'Family Movie Night', 'movie', '10751'),
  g('animation', 'Animated Movies', 'movie', '16'),
  g('mystery-tv', 'Mystery TV Shows', 'tv', '9648'),
  g('docs', 'Documentaries', 'movie', '99'),
  { id: 'coming-soon', title: 'Coming Soon', soon: true, load: () => tmdb.getComingSoonMovies(), viewAll: browse({ type: 'movie', list: 'upcoming' }) },
];

export const MOVIES_HERO = async () => onlyOut(await tmdb.getPopularMovies());

export const MOVIES_ROWS: RowDef[] = [
  { id: 'm-top10', title: 'Top 10 Movies Today', kind: 'top10', load: () => tmdb.getTrendingMovies('day') },
  { id: 'm-popular', title: 'Popular Movies', load: () => tmdb.getPopularMovies(), viewAll: browse({ type: 'movie' }) },
  { id: 'm-new', title: 'New Releases', load: () => tmdb.getNowPlayingMovies(), viewAll: browse({ type: 'movie', list: 'new' }) },
  { id: 'm-trending', title: 'Trending This Week', load: () => tmdb.getTrendingMovies('week'), viewAll: browse({ type: 'movie', list: 'trending', window: 'week' }) },
  brands('providers', 'Streaming Services', 'movie'),
  g('m-action', 'Action Movies', 'movie', '28'),
  g('m-comedy', 'Comedies', 'movie', '35'),
  brands('studios', 'Studios', 'movie'),
  g('m-drama', 'Dramas', 'movie', '18'),
  g('m-thriller', 'Thrillers', 'movie', '53'),
  g('m-scifi', 'Sci-Fi Movies', 'movie', '878'),
  brands('franchises', 'Popular Franchises'),
  g('m-fantasy', 'Fantasy Movies', 'movie', '14'),
  g('m-horror', 'Horror Movies', 'movie', '27'),
  brands('production', 'Production Houses', 'movie'),
  g('m-romance', 'Romantic Movies', 'movie', '10749'),
  g('m-crime', 'Crime Movies', 'movie', '80'),
  g('m-mystery', 'Mysteries', 'movie', '9648'),
  g('m-animation', 'Animated Movies', 'movie', '16'),
  g('m-family', 'Family Movies', 'movie', '10751'),
  g('m-war', 'War & History', 'movie', '10752|36'),
  g('m-docs', 'Documentaries', 'movie', '99'),
  { id: 'm-acclaimed', title: 'Critically Acclaimed Movies', load: () => tmdb.getTopRatedMovies(), viewAll: browse({ type: 'movie', sort: 'rating' }) },
  { id: 'm-soon', title: 'Coming Soon', soon: true, load: () => tmdb.getComingSoonMovies(), viewAll: browse({ type: 'movie', list: 'upcoming' }) },
];

export const TV_HERO = async () => onlyOut(await tmdb.getPopularTvShows());

export const TV_ROWS: RowDef[] = [
  { id: 't-top10', title: 'Top 10 TV Shows Today', kind: 'top10', load: () => tmdb.getTrendingTv('day') },
  { id: 't-popular', title: 'Bingeworthy TV Shows', load: () => tmdb.getPopularTvShows(), viewAll: browse({ type: 'tv' }) },
  { id: 't-new', title: 'New Episodes This Week', load: () => tmdb.getOnTheAirTvShows(), viewAll: browse({ type: 'tv', list: 'on_the_air' }) },
  { id: 't-today', title: 'Airing Today', load: () => tmdb.getAiringTodayTv(), viewAll: browse({ type: 'tv', list: 'airing_today' }) },
  brands('providers', 'Streaming Services', 'tv'),
  { id: 't-anime', title: 'Anime Series', load: anime, viewAll: browse({ type: 'tv', genre: '16', lang: 'ja' }) },
  { id: 't-kdrama', title: 'K-Dramas', load: kdramas, viewAll: browse({ type: 'tv', genre: '18', lang: 'ko' }) },
  g('t-crime', 'Crime TV Shows', 'tv', '80'),
  brands('studios', 'Studios', 'tv'),
  g('t-drama', 'TV Dramas', 'tv', '18'),
  g('t-comedy', 'TV Comedies', 'tv', '35'),
  g('t-scifi', 'Sci-Fi & Fantasy TV', 'tv', '10765'),
  brands('production', 'Production Houses', 'tv'),
  g('t-action', 'Action & Adventure TV', 'tv', '10759'),
  g('t-mystery', 'Mystery TV Shows', 'tv', '9648'),
  g('t-animation', 'Animated Series', 'tv', '16', { without_genres: '10762' }),
  g('t-reality', 'Reality TV', 'tv', '10764', { 'vote_count.gte': '10' }),
  g('t-docs', 'Docuseries', 'tv', '99', { 'vote_count.gte': '20' }),
  g('t-kids', 'Kids TV', 'tv', '10762', { 'vote_count.gte': '20' }),
  { id: 't-acclaimed', title: 'Critically Acclaimed TV Shows', load: () => tmdb.getTopRatedTvShows(), viewAll: browse({ type: 'tv', sort: 'rating' }) },
];

export const LATEST_ROWS: RowDef[] = [
  { id: 'l-new', title: 'New on StreamFast', load: () => tmdb.getNowPlayingMovies(), viewAll: browse({ type: 'movie', list: 'new' }) },
  { id: 'l-top10-tv', title: 'Top 10 TV Shows Today', kind: 'top10', load: () => tmdb.getTrendingTv('day') },
  { id: 'l-top10-movies', title: 'Top 10 Movies Today', kind: 'top10', load: () => tmdb.getTrendingMovies('day') },
  { id: 'l-episodes', title: 'New Episodes This Week', load: () => tmdb.getOnTheAirTvShows(), viewAll: browse({ type: 'tv', list: 'on_the_air' }) },
  brands('providers', 'Streaming Services'),
  { id: 'l-soon', title: 'Worth the Wait', soon: true, load: () => tmdb.getComingSoonMovies(), viewAll: browse({ type: 'movie', list: 'upcoming' }) },
  { id: 'l-trending', title: 'Trending This Week', load: () => tmdb.getTrending(), viewAll: browse({ list: 'trending', window: 'week' }) },
  { id: 'l-today', title: 'Airing Today', load: () => tmdb.getAiringTodayTv(), viewAll: browse({ type: 'tv', list: 'airing_today' }) },
];

export const EXPLORE_ROWS: RowDef[] = [
  { id: 'x-trending', title: 'Trending Now', load: () => tmdb.getTrending(), viewAll: browse({ list: 'trending', window: 'week' }) },
  { id: 'x-new', title: 'New Releases', load: () => tmdb.getNowPlayingMovies(), viewAll: browse({ type: 'movie', list: 'new' }) },
  { id: 'x-popular-movies', title: 'Popular Movies', load: () => tmdb.getPopularMovies(), viewAll: browse({ type: 'movie' }) },
  { id: 'x-popular-tv', title: 'Popular TV Shows', load: () => tmdb.getPopularTvShows(), viewAll: browse({ type: 'tv' }) },
  brands('providers', 'Streaming Services'),
  brands('studios', 'Studios'),
  brands('production', 'Production Houses'),
  brands('franchises', 'Popular Franchises'),
  { id: 'x-top-movies', title: 'Highest Rated Movies', load: () => tmdb.getTopRatedMovies(), viewAll: browse({ type: 'movie', sort: 'rating' }) },
  { id: 'x-top-tv', title: 'Highest Rated TV Shows', load: () => tmdb.getTopRatedTvShows(), viewAll: browse({ type: 'tv', sort: 'rating' }) },
  { id: 'x-soon', title: 'Coming Soon', soon: true, load: () => tmdb.getComingSoonMovies(), viewAll: browse({ type: 'movie', list: 'upcoming' }) },
];
