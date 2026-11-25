import { createContext, useContext } from 'react';
import type { SearchResult, WatchProgress } from '../types';

export type PlayerTab = 'episodes' | 'watch' | 'actions';

export interface PlayerApi {
  /** Opens StreamFast's player page (VidFast embed) or the link panel. */
  openPlayer: (item: SearchResult, opts?: { progress?: WatchProgress; tab?: PlayerTab }) => void;
}

export const PlayerContext = createContext<PlayerApi>({ openPlayer: () => {} });
export const usePlayer = () => useContext(PlayerContext);
