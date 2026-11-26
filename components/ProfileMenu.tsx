import React, { useState, useRef, useEffect } from 'react';
import { DownloadIcon, UploadIcon, TrashIcon, PaletteIcon, ChevronDownIcon, UserIcon, LogOutIcon } from './Icons';
import { useAppContext } from '../contexts/AppContext';
import { useAuth, useSyncStatus } from '../contexts/AuthContext';
import { AUTH_ROUTES, Link, navigate, signInPath, useRoute } from '../utils/router';
import { Avatar } from './Brand';

interface ProfileMenuProps {
    onImport: (file: File) => void;
    onExport: () => void;
    onReset: () => void;
    onThemeSelect: () => void;
}

const MenuItem: React.FC<{ onClick: () => void; icon: React.ReactNode; children: React.ReactNode; danger?: boolean }> = ({ onClick, icon, children, danger }) => (
    <li role="none">
        <button
            type="button"
            onClick={onClick}
            role="menuitem"
            className={`flex w-full items-center gap-3 px-4 py-2 text-left text-[13px] transition-colors ${
                danger ? 'text-red-400 hover:bg-red-500/15 hover:text-red-300' : 'text-netflix-text hover:underline'
            }`}
        >
            <span className={danger ? 'text-red-400' : 'text-netflix-muted'} aria-hidden="true">{icon}</span>
            {children}
        </button>
    </li>
);

/** Netflix-style red "Sign In" button in the header (signed out only; hidden on the account pages). */
export const HeaderSignInButton: React.FC = () => {
    const { enabled, user, loading } = useAuth();
    const route = useRoute();
    if (!enabled || loading || user || AUTH_ROUTES.includes(route.name)) return null;
    return (
        <Link
            to={signInPath()}
            className="hidden h-8 flex-shrink-0 items-center rounded bg-netflix-red px-3.5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-[#c11119] sm:inline-flex"
        >
            Sign In
        </Link>
    );
};

/** "Synced" line under the username. */
const SyncLine: React.FC = () => {
    const status = useSyncStatus();
    const label = status === 'error' ? 'Not synced yet · will retry' : status === 'synced' ? 'Synced' : 'Syncing…';
    const dot = status === 'error' ? 'bg-amber-400' : status === 'synced' ? 'bg-netflix-green' : 'animate-pulse bg-[#b3b3b3]';
    return (
        <p className="flex items-center gap-1.5" title={status === 'error' ? 'Your changes are saved here and will sync when the connection is back.' : undefined}>
            <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${dot}`} aria-hidden="true" />
            {label}
        </p>
    );
};

const ProfileMenu: React.FC<ProfileMenuProps> = ({ onImport, onExport, onReset, onThemeSelect }) => {
    const { continueWatchingList, myList, setFeedback } = useAppContext();
    const { enabled: accountsEnabled, user, profile, signOut } = useAuth();
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

    const handleSignOut = async () => {
        setIsOpen(false);
        try {
            await signOut();
            setFeedback('Signed out. Your lists stay saved on this device.');
        } catch (err) {
            setFeedback(err instanceof Error ? err.message : "We couldn't sign you out. Please try again.");
        }
    };

    const accountName = profile?.username || user?.email?.split('@')[0] || '';

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
                    {user && (
                        <div className="flex items-center gap-3 px-4 pb-2.5 pt-1">
                            <Avatar />
                            <div className="min-w-0 text-[12px] leading-tight text-netflix-muted">
                                <p className="truncate text-[14px] font-bold text-white" title={accountName}>{accountName}</p>
                                <SyncLine />
                            </div>
                        </div>
                    )}
                    <div className={`flex items-center gap-3 px-4 pb-3 ${user ? '' : 'pt-1'}`}>
                        {!user && <Avatar />}
                        <div className="text-[12px] leading-tight text-netflix-muted">
                            <p><span className="font-bold text-white">{continueWatchingList.length}</span> in Continue Watching</p>
                            <p><span className="font-bold text-white">{myList.length}</span> in My List</p>
                        </div>
                    </div>
                    <ul role="none" className="border-t border-white/10 pt-1.5">
                        {accountsEnabled && !user && (
                            <MenuItem onClick={run(() => navigate(signInPath()))} icon={<UserIcon className="h-4 w-4" />}>
                                <span>Sign in <span className="text-netflix-muted">· sync your devices</span></span>
                            </MenuItem>
                        )}
                        <MenuItem onClick={run(onThemeSelect)} icon={<PaletteIcon className="h-4 w-4" />}>Player theme</MenuItem>
                        <MenuItem onClick={() => fileInputRef.current?.click()} icon={<UploadIcon className="h-4 w-4" />}>Import history</MenuItem>
                        <MenuItem onClick={run(onExport)} icon={<DownloadIcon className="h-4 w-4" />}>Export history</MenuItem>
                    </ul>
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".json" className="hidden" aria-label="Import history file" />
                    <ul role="none" className="mt-1.5 border-t border-white/10 pt-1.5">
                        {user && <MenuItem onClick={handleSignOut} icon={<LogOutIcon className="h-4 w-4" />}>Sign out</MenuItem>}
                        <MenuItem onClick={run(onReset)} icon={<TrashIcon className="h-4 w-4" />} danger>Reset site data</MenuItem>
                    </ul>
                </div>
            )}
        </div>
    );
};

export default ProfileMenu;
