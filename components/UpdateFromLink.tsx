import React from 'react';
import { SpinnerIcon, CheckIcon, LinkIcon } from './Icons';

export interface UpdateFromLinkProps {
    value: string;
    onChange: (url: string) => void;
    status: 'idle' | 'loading' | 'success';
    isFadingOut: boolean;
    variant?: 'default' | 'compact';
}

/** Slim "paste a VidFast link" bar that adds a title to Continue Watching or updates its progress. */
const UpdateFromLink: React.FC<UpdateFromLinkProps> = ({ value, onChange, status, isFadingOut }) => {
    return (
        <div className="px-[4%]">
            <div className="flex flex-col gap-3 rounded-md border border-white/10 bg-[#181818]/90 p-3.5 backdrop-blur-sm sm:flex-row sm:items-center sm:gap-5 sm:p-4">
                <div className="flex items-center gap-3 sm:w-[19rem] sm:flex-shrink-0">
                    <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded bg-netflix-red/15 text-netflix-red">
                        <LinkIcon className="h-[18px] w-[18px]" />
                    </span>
                    <div className="min-w-0">
                        <p className="text-sm font-bold text-white">Have a VidFast link?</p>
                        <p className="text-xs text-netflix-muted">Paste it to add or update Continue Watching.</p>
                    </div>
                </div>
                <div className="relative flex-1">
                    <input
                        type="url"
                        inputMode="url"
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        placeholder="https://vidfast.pro/tv/1399/1/1"
                        className={`w-full rounded-[4px] border border-[#5a5a5a] bg-black/60 py-2.5 pl-3.5 pr-11 text-sm text-white placeholder:text-[#737373] transition-colors duration-200 hover:border-[#808080] focus:border-white focus:outline-none disabled:opacity-60 ${isFadingOut ? 'animate-fade-out-input' : ''}`}
                        disabled={status === 'loading'}
                        aria-label="Paste a VidFast link to add or update"
                    />
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                        {status === 'loading' && <SpinnerIcon className="h-5 w-5 text-netflix-red" />}
                        {status === 'success' && <CheckIcon className="h-6 w-6 text-netflix-green" />}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default UpdateFromLink;
