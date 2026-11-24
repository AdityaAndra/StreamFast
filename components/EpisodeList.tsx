import React, { useMemo, useState } from 'react';
import type { SearchResult, SeasonDetails, WatchProgress } from '../types';
import type { TitleDetails } from '../services/tmdb';
import { getSeasonDetails } from '../services/tmdb';
import { useCachedData } from '../utils/useCachedData';
import { usePlayer } from '../contexts/PlayerContext';
import { tmdbImage } from '../utils/media';
import { PlayIcon } from './Icons';

interface EpisodeListProps {
  item: SearchResult;
  seasons: TitleDetails['seasons'];
  savedProgress?: WatchProgress;
}

const EpisodeSkeleton: React.FC = () => (
  <div className="space-y-3" aria-hidden="true">
    {Array.from({ length: 4 }).map((_, i) => (
      <div key={i} className="grid grid-cols-[42%_1fr] items-center gap-4 px-[1.5vw] py-3 sm:grid-cols-[3rem_minmax(120px,22%)_1fr]">
        <div className="nf-skel hidden h-6 w-6 sm:block" style={{ ['--i' as any]: i }} />
        <div className="nf-skel aspect-video w-full" style={{ ['--i' as any]: i }} />
        <div className="space-y-2">
          <div className="nf-skel h-4 w-1/2" style={{ ['--i' as any]: i }} />
          <div className="nf-skel h-3 w-full" style={{ ['--i' as any]: i + 1 }} />
          <div className="nf-skel h-3 w-4/5" style={{ ['--i' as any]: i + 2 }} />
        </div>
      </div>
    ))}
  </div>
);

const EpisodeList: React.FC<EpisodeListProps> = ({ item, seasons, savedProgress }) => {
  const { openPlayer } = usePlayer();
  const options = useMemo(() => {
    const all = seasons || [];
    const regular = all.filter((s) => s.season_number > 0 && s.episode_count > 0);
    return regular.length ? regular : all;
  }, [seasons]);

  const [season, setSeason] = useState<number>(() => {
    const saved = savedProgress?.season;
    if (saved && options.some((s) => s.season_number === saved)) return saved;
    return options[0]?.season_number ?? 1;
  });

  const { data, error, reload } = useCachedData<SeasonDetails>(`season:${item.id}:${season}`, () => getSeasonDetails(item.id, season));
  const episodes = data?.episodes || [];

  if (!options.length) return null;

  return (
    <section className="px-[4%] pb-[2vw] pt-[3vw]" aria-labelledby="episodes-heading">
      <div className="mb-[1.2vw] flex flex-wrap items-center justify-between gap-4 pb-2">
        <h2 id="episodes-heading" className="text-[clamp(1.3rem,1.8vw,1.9rem)] font-bold tracking-[-0.01em] text-white">
          Episodes
        </h2>
        {options.length > 1 ? (
          <select
            value={season}
            onChange={(e) => setSeason(Number(e.target.value))}
            aria-label="Season"
            className="cursor-pointer rounded-[4px] border border-[#4d4d4d] bg-[#242424] px-4 py-2 text-[max(14px,1vw)] font-bold text-white transition-colors hover:border-white"
          >
            {options.map((s) => (
              <option key={s.season_number} value={s.season_number}>
                {s.name} ({s.episode_count} Episodes)
              </option>
            ))}
          </select>
        ) : (
          <span className="text-[max(14px,1vw)] font-bold text-netflix-muted">{options[0].name}</span>
        )}
      </div>

      {error ? (
        <button type="button" onClick={reload} className="py-6 text-netflix-muted underline">
          Couldn't load episodes. Tap to retry.
        </button>
      ) : !data ? (
        <EpisodeSkeleton />
      ) : (
        <ol className="border-t border-white/10">
          {episodes.map((ep) => {
            const isCurrent = savedProgress?.season === season && savedProgress?.episode === ep.episode_number;
            const percent =
              isCurrent && savedProgress?.watched && savedProgress?.duration ? Math.min(100, (savedProgress.watched / savedProgress.duration) * 100) : null;
            const runtime = (ep as any).runtime as number | undefined;
            const still = tmdbImage(ep.still_path, 'w300');
            return (
              <li key={ep.id} className="border-b border-white/10">
                <button
                  type="button"
                  onClick={() => openPlayer(item, { progress: { season, episode: ep.episode_number }, tab: 'watch' })}
                  className={`group grid w-full grid-cols-[42%_1fr] items-center gap-x-4 gap-y-2 rounded-[4px] px-[1.5vw] py-[max(12px,1.4vw)] text-left transition-colors duration-150 hover:bg-white/[0.06] sm:grid-cols-[3rem_minmax(120px,22%)_1fr] ${
                    isCurrent ? 'bg-[#333]' : ''
                  }`}
                >
                  <span className="hidden text-center text-[clamp(1.2rem,1.6vw,1.6rem)] text-[#d2d2d2] sm:block">{ep.episode_number}</span>
                  <span className="relative block aspect-video overflow-hidden rounded-[4px] bg-[#232323]">
                    {still && <img src={still} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" />}
                    <span className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition duration-200 group-hover:bg-black/30 group-hover:opacity-100">
                      <span className="flex h-[2.6em] w-[2.6em] items-center justify-center rounded-full border-2 border-white bg-black/40">
                        <PlayIcon className="ml-0.5 h-[1.1em] w-[1.1em] text-white" />
                      </span>
                    </span>
                    {percent !== null && (
                      <span className="absolute inset-x-0 bottom-0 h-1 bg-[#4d4d4d]">
                        <span className="block h-full bg-netflix-red" style={{ width: `${percent}%` }} />
                      </span>
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="truncate text-[max(14px,1.05vw)] font-bold text-white">
                        <span className="sm:hidden">{ep.episode_number}. </span>
                        {ep.name}
                      </span>
                      {runtime ? <span className="flex-shrink-0 text-[max(13px,0.95vw)] text-netflix-muted">{runtime}m</span> : null}
                    </span>
                    <span className="mt-1.5 hidden text-[max(13px,0.95vw)] leading-snug text-[#d2d2d2] sm:[display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:3] overflow-hidden">
                      {ep.overview || 'No description available.'}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
};

export default EpisodeList;
