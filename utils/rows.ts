import type { SearchResult } from '../types';
import * as tmdb from '../services/tmdb';

export interface RowDef {
  id: string;
  title: string;
  kind?: 'row' | 'top10';
  load: () => Promise<SearchResult[]>;
}

const genre = (type: 'movie' | 'tv', withGenres: string, extra: Record<string, string> = {}) => () =>
  tmdb.discover(type, { with_genres: withGenres, ...extra });

const anime = () => tmdb.discover('tv', { with_genres: '16', with_original_language: 'ja', 'vote_count.gte': '40' });
const kdramas = () => tmdb.discover('tv', { with_genres: '18', with_original_language: 'ko', 'vote_count.gte': '20' });

export const HOME_HERO = () => tmdb.getTrending();

export const HOME_ROWS: RowDef[] = [
  { id: 'top10-tv', title: 'Top 10 TV Shows Today', kind: 'top10', load: () => tmdb.getTrendingTv('day') },
  { id: 'trending', title: 'Trending Now', load: () => tmdb.getTrending() },
  { id: 'new-releases', title: 'New Releases', load: () => tmdb.getNowPlayingMovies() },
  { id: 'top10-movies', title: 'Top 10 Movies Today', kind: 'top10', load: () => tmdb.getTrendingMovies('day') },
  { id: 'popular-movies', title: 'Popular Movies', load: () => tmdb.getPopularMovies() },
  { id: 'bingeworthy', title: 'Bingeworthy TV Shows', load: () => tmdb.getPopularTvShows() },
  { id: 'action', title: 'Action & Adventure Movies', load: genre('movie', '28|12') },
  { id: 'acclaimed-movies', title: 'Critically Acclaimed Movies', load: () => tmdb.getTopRatedMovies() },
  { id: 'comedies', title: 'Comedies', load: genre('movie', '35') },
  { id: 'anime', title: 'Anime', load: anime },
  { id: 'scifi', title: 'Sci-Fi & Fantasy Movies', load: genre('movie', '878|14') },
  { id: 'thrillers', title: 'Thrillers', load: genre('movie', '53') },
  { id: 'kdramas', title: 'K-Dramas', load: kdramas },
  { id: 'crime-tv', title: 'Crime TV Shows', load: genre('tv', '80') },
  { id: 'horror', title: 'Horror Movies', load: genre('movie', '27') },
  { id: 'romance', title: 'Romantic Movies', load: genre('movie', '10749') },
  { id: 'acclaimed-tv', title: 'Critically Acclaimed TV Shows', load: () => tmdb.getTopRatedTvShows() },
  { id: 'family', title: 'Family Movie Night', load: genre('movie', '10751') },
  { id: 'animation', title: 'Animated Movies', load: genre('movie', '16') },
  { id: 'mystery-tv', title: 'Mystery TV Shows', load: genre('tv', '9648') },
  { id: 'docs', title: 'Documentaries', load: genre('movie', '99') },
  { id: 'coming-soon', title: 'Coming Soon', load: () => tmdb.getUpcomingMovies() },
];

export const MOVIES_HERO = () => tmdb.getPopularMovies();

export const MOVIES_ROWS: RowDef[] = [
  { id: 'm-top10', title: 'Top 10 Movies Today', kind: 'top10', load: () => tmdb.getTrendingMovies('day') },
  { id: 'm-popular', title: 'Popular Movies', load: () => tmdb.getPopularMovies() },
  { id: 'm-new', title: 'New Releases', load: () => tmdb.getNowPlayingMovies() },
  { id: 'm-trending', title: 'Trending This Week', load: () => tmdb.getTrendingMovies('week') },
  { id: 'm-action', title: 'Action Movies', load: genre('movie', '28') },
  { id: 'm-comedy', title: 'Comedies', load: genre('movie', '35') },
  { id: 'm-drama', title: 'Dramas', load: genre('movie', '18') },
  { id: 'm-thriller', title: 'Thrillers', load: genre('movie', '53') },
  { id: 'm-scifi', title: 'Sci-Fi Movies', load: genre('movie', '878') },
  { id: 'm-fantasy', title: 'Fantasy Movies', load: genre('movie', '14') },
  { id: 'm-horror', title: 'Horror Movies', load: genre('movie', '27') },
  { id: 'm-romance', title: 'Romantic Movies', load: genre('movie', '10749') },
  { id: 'm-crime', title: 'Crime Movies', load: genre('movie', '80') },
  { id: 'm-mystery', title: 'Mysteries', load: genre('movie', '9648') },
  { id: 'm-animation', title: 'Animated Movies', load: genre('movie', '16') },
  { id: 'm-family', title: 'Family Movies', load: genre('movie', '10751') },
  { id: 'm-war', title: 'War & History', load: genre('movie', '10752|36') },
  { id: 'm-docs', title: 'Documentaries', load: genre('movie', '99') },
  { id: 'm-acclaimed', title: 'Critically Acclaimed Movies', load: () => tmdb.getTopRatedMovies() },
  { id: 'm-soon', title: 'Coming Soon', load: () => tmdb.getUpcomingMovies() },
];

export const TV_HERO = () => tmdb.getPopularTvShows();

export const TV_ROWS: RowDef[] = [
  { id: 't-top10', title: 'Top 10 TV Shows Today', kind: 'top10', load: () => tmdb.getTrendingTv('day') },
  { id: 't-popular', title: 'Bingeworthy TV Shows', load: () => tmdb.getPopularTvShows() },
  { id: 't-new', title: 'New Episodes This Week', load: () => tmdb.getOnTheAirTvShows() },
  { id: 't-today', title: 'Airing Today', load: () => tmdb.getAiringTodayTv() },
  { id: 't-anime', title: 'Anime Series', load: anime },
  { id: 't-kdrama', title: 'K-Dramas', load: kdramas },
  { id: 't-crime', title: 'Crime TV Shows', load: genre('tv', '80') },
  { id: 't-drama', title: 'TV Dramas', load: genre('tv', '18') },
  { id: 't-comedy', title: 'TV Comedies', load: genre('tv', '35') },
  { id: 't-scifi', title: 'Sci-Fi & Fantasy TV', load: genre('tv', '10765') },
  { id: 't-action', title: 'Action & Adventure TV', load: genre('tv', '10759') },
  { id: 't-mystery', title: 'Mystery TV Shows', load: genre('tv', '9648') },
  { id: 't-animation', title: 'Animated Series', load: genre('tv', '16', { without_genres: '10762' }) },
  { id: 't-reality', title: 'Reality TV', load: genre('tv', '10764', { 'vote_count.gte': '10' }) },
  { id: 't-docs', title: 'Docuseries', load: genre('tv', '99', { 'vote_count.gte': '20' }) },
  { id: 't-kids', title: 'Kids TV', load: genre('tv', '10762', { 'vote_count.gte': '20' }) },
  { id: 't-acclaimed', title: 'Critically Acclaimed TV Shows', load: () => tmdb.getTopRatedTvShows() },
];

export const LATEST_ROWS: RowDef[] = [
  { id: 'l-new', title: 'New on VidFast', load: () => tmdb.getNowPlayingMovies() },
  { id: 'l-top10-tv', title: 'Top 10 TV Shows Today', kind: 'top10', load: () => tmdb.getTrendingTv('day') },
  { id: 'l-top10-movies', title: 'Top 10 Movies Today', kind: 'top10', load: () => tmdb.getTrendingMovies('day') },
  { id: 'l-episodes', title: 'New Episodes This Week', load: () => tmdb.getOnTheAirTvShows() },
  { id: 'l-soon', title: 'Worth the Wait', load: () => tmdb.getUpcomingMovies() },
  { id: 'l-trending', title: 'Trending This Week', load: () => tmdb.getTrending() },
  { id: 'l-today', title: 'Airing Today', load: () => tmdb.getAiringTodayTv() },
];
