import React, { useState, useRef, useEffect } from 'react';
import { DownloadIcon, UploadIcon, TrashIcon, PaletteIcon, ChevronDownIcon, BookOpenIcon } from './Icons';
import { useAppContext } from '../contexts/AppContext';
import { Avatar } from './Brand';

interface ProfileMenuProps {
    onImport: (file: File) => void;
    onExport: () => void;
    onReset: () => void;
    onThemeSelect: () => void;
    onOpenGuide?: () => void;
}

const MenuItem: React.FC<{ onClick: () => void; icon: React.ReactNode; children: React.ReactNode; danger?: boolean }> = ({ onClick, icon, children, danger }) => (
    <li>
        <button
            type="button"
            onClick={onClick}
            role="menuitem"
            className={`flex w-full items-center gap-3 px-4 py-2 text-left text-[13px] transition-colors ${
                danger ? 'text-red-400 hover:bg-red-500/15 hover:text-red-300' : 'text-netflix-text hover:underline'
            }`}
        >
            <span className={danger ? 'text-red-400' : 'text-netflix-muted'}>{icon}</span>
            {children}
        </button>
    </li>
);

const ProfileMenu: React.FC<ProfileMenuProps> = ({ onImport, onExport, onReset, onThemeSelect, onOpenGuide }) => {
    const { continueWatchingList, myList } = useAppContext();
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        const handleKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setIsOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleKey);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKey);
        };
    }, []);

    const run = (fn?: () => void) => () => {
        setIsOpen(false);
        fn?.();
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) onImport(file);
        setIsOpen(false);
        if (event.target) event.target.value = '';
    };

    return (
        <div className="relative" ref={menuRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="group flex items-center gap-1.5 rounded p-0.5"
                aria-label="Account menu"
                aria-haspopup="true"
                aria-expanded={isOpen}
            >
                <Avatar />
                <ChevronDownIcon className={`hidden h-4 w-4 text-white transition-transform duration-300 sm:block ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div
                    className="absolute right-0 top-full mt-3 w-60 border border-white/15 bg-black/95 py-2 shadow-2xl shadow-black/80 animate-dropdown-in"
                    role="menu"
                    aria-orientation="vertical"
                >
                    <span className="absolute -top-[7px] right-4 h-0 w-0 border-x-[7px] border-b-[7px] border-x-transparent border-b-white/80 sm:right-7" aria-hidden="true" />
                    <div className="flex items-center gap-3 px-4 pb-3 pt-1">
                        <Avatar />
                        <div className="text-[12px] leading-tight text-netflix-muted">
                            <p><span className="font-bold text-white">{continueWatchingList.length}</span> in Continue Watching</p>
                            <p><span className="font-bold text-white">{myList.length}</span> in My List</p>
                        </div>
                    </div>
                    <ul className="border-t border-white/10 pt-1.5">
                        {onOpenGuide && <MenuItem onClick={run(onOpenGuide)} icon={<BookOpenIcon className="h-4 w-4" />}>How to use VidFast</MenuItem>}
                        <MenuItem onClick={run(onThemeSelect)} icon={<PaletteIcon className="h-4 w-4" />}>Player theme</MenuItem>
                        <MenuItem onClick={() => fileInputRef.current?.click()} icon={<UploadIcon className="h-4 w-4" />}>Import history</MenuItem>
                        <MenuItem onClick={run(onExport)} icon={<DownloadIcon className="h-4 w-4" />}>Export history</MenuItem>
                    </ul>
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".json" className="hidden" />
                    <ul className="mt-1.5 border-t border-white/10 pt-1.5">
                        <MenuItem onClick={run(onReset)} icon={<TrashIcon className="h-4 w-4" />} danger>Reset site data</MenuItem>
                    </ul>
                </div>
            )}
        </div>
    );
};

export default ProfileMenu;
