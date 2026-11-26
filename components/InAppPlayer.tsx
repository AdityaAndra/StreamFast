import React, { useEffect, useRef } from 'react';
import { SearchResult, WatchProgress } from '../types';
import { useAppContext } from '../contexts/AppContext';

interface InAppPlayerProps {
    embedLink: string;
    item: SearchResult;
    cleanPosterPath: string | null;
}

const VIDFAST_ORIGINS = [
    'https://vidfast.pro',
    'https://vidfast.in',
    'https://vidfast.io',
    'https://vidfast.me',
    'https://vidfast.net',
    'https://vidfast.pm',
    'https://vidfast.xyz',
    'https://vidfast.vc',
    'https://vidfast.bz',
];
/** The player reports its time about 4 times a second: save at most this often while playing. */
const SAVE_EVERY_MS = 5000;

const InAppPlayer: React.FC<InAppPlayerProps> = ({ embedLink, item, cleanPosterPath }) => {
    const { saveItem } = useAppContext();
    const posterToSave = item.media_type === 'tv' ? cleanPosterPath : item.poster_path;
    const lastSave = useRef(0);

    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            if (!VIDFAST_ORIGINS.includes(event.origin) || !event.data || event.data.type !== 'PLAYER_EVENT') return;
            const { event: playerEvent, currentTime, duration, season, episode } = event.data.data || {};
            if (!['timeupdate', 'pause', 'ended'].includes(playerEvent) || !(currentTime > 0)) return;
            // Pause and end always save; during playback, save every few seconds (not on every time update).
            const now = Date.now();
            if (playerEvent === 'timeupdate' && now - lastSave.current < SAVE_EVERY_MS) return;
            lastSave.current = now;
            const progress: WatchProgress = { watched: currentTime, duration };
            if (item.media_type === 'tv') {
                progress.season = season || 1;
                progress.episode = episode || 1;
            }
            saveItem(item, progress, posterToSave);
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [item, saveItem, posterToSave]);

    return (
        <div className="relative w-full pt-[56.25%] bg-black rounded-lg overflow-hidden border border-neutral-800">
            <iframe
                src={embedLink}
                title="Player"
                className="absolute top-0 left-0 w-full h-full border-0"
                allowFullScreen
                allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
            />
        </div>
    );
};

export default InAppPlayer;
