import React, { useEffect, useRef } from 'react';
import { SearchResult, WatchProgress } from '../types';
import { useAppContext } from '../contexts/AppContext';

interface InAppPlayerProps {
    embedLink: string;
    item: SearchResult;
    cleanPosterPath: string | null;
}

const InAppPlayer: React.FC<InAppPlayerProps> = ({ embedLink, item, cleanPosterPath }) => {
    const { saveItem } = useAppContext();
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const posterToSave = item.media_type === 'tv' ? cleanPosterPath : item.poster_path;

    useEffect(() => {
        const vidfastOrigins = [
            'https://vidfast.pro',
            'https://vidfast.in',
            'https://vidfast.io',
            'https://vidfast.me',
            'https://vidfast.net',
            'https://vidfast.pm',
            'https://vidfast.xyz',
            'https://vidfast.vc',
            'https://vidfast.bz'
        ];

        const handleMessage = (event: MessageEvent) => {
            if (!vidfastOrigins.includes(event.origin) || !event.data) {
                return;
            }

            const data = event.data;

            if (data.type === 'PLAYER_EVENT') {
                const { event: playerEvent, currentTime, duration, season, episode } = data.data;
                
                if (['timeupdate', 'pause', 'ended'].includes(playerEvent)) {
                    // Save progress
                    const progress: WatchProgress = {};
                    if (item.media_type === 'tv') {
                        progress.season = season || 1;
                        progress.episode = episode || 1;
                    }
                    progress.watched = currentTime;
                    progress.duration = duration;

                    // Only save if it's meaningful progress
                    if (currentTime > 0) {
                        saveItem(item, progress, posterToSave);
                    }
                }
            }
            
            // In case we want to support direct media data saving as per docs
            if (data.type === 'MEDIA_DATA') {
                // Not saving entire metadata payload since our app tracks its own progress state
                // But this demonstrates handling the event
                console.log("Media Data Event", data.data);
            }
        };

        window.addEventListener('message', handleMessage);
        return () => {
            window.removeEventListener('message', handleMessage);
        };
    }, [item, saveItem, posterToSave]);

    return (
        <div className="relative w-full pt-[56.25%] bg-black rounded-lg overflow-hidden border border-neutral-800">
            <iframe
                ref={iframeRef}
                src={embedLink}
                className="absolute top-0 left-0 w-full h-full"
                frameBorder="0"
                allowFullScreen
                allow="encrypted-media"
            />
        </div>
    );
};

export default InAppPlayer;
