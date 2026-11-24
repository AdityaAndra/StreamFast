import React, { useEffect, useRef, useState } from 'react';
import ProfileMenu from './ProfileMenu';
import { SearchIcon, CloseIcon, ClockIcon, ChevronDownIcon } from './Icons';
import { loadRecentSearches, clearRecentSearches } from '../utils/recentSearches';

export type AppView = 'home' | 'movies' | 'tv-shows' | 'latest' | 'my-list' | 'how-to-use' | 'title' | 'other';
type NavView = 'home' | 'tv-shows' | 'movies' | 'latest' | 'my-list';

const NAV_ITEMS: { id: NavView; label: string }[] = [
    { id: 'home', label: 'Home' },
    { id: 'tv-shows', label: 'TV Shows' },
    { id: 'movies', label: 'Movies' },
    { id: 'latest', label: 'New & Popular' },
    { id: 'my-list', label: 'My List' },
];

interface AppHeaderProps {
    view: AppView;
    isSearching: boolean;
    searchQuery: string;
    onSearchChange: (query: string) => void;
    onNavigate: (view: NavView) => void;
    onOpenGuide: () => void;
    onImport: (file: File) => void;
    onExport: () => void;
    onReset: () => void;
    onThemeSelect: () => void;
}

const isTypingTarget = (target: EventTarget | null) => {
    const el = target as HTMLElement | null;
    if (!el) return false;
    return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable;
};

/** Netflix-style search: an icon that expands into a box; results update live as you type. */
const NavSearch: React.FC<{ value: string; onChange: (value: string) => void }> = ({ value, onChange }) => {
    const [open, setOpen] = useState(!!value);
    const [focused, setFocused] = useState(false);
    const [recent, setRecent] = useState<string[]>([]);
    const inputRef = useRef<HTMLInputElement>(null);
    const wrapRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (value) setOpen(true);
    }, [value]);

    const focusInput = () => {
        setOpen(true);
        window.requestAnimationFrame(() => inputRef.current?.focus());
    };

    // Shortcuts: "/" or Ctrl/Cmd + K focuses search.
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const isCmdK = e.key.toLowerCase() === 'k' && (e.ctrlKey || e.metaKey);
            const isSlash = e.key === '/' && !isTypingTarget(e.target);
            if (isCmdK || isSlash) {
                e.preventDefault();
                focusInput();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    // Collapse when clicking elsewhere with an empty box.
    useEffect(() => {
        const onDown = (e: MouseEvent) => {
            if (wrapRef.current && !wrapRef.current.contains(e.target as Node) && !inputRef.current?.value) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', onDown);
        return () => document.removeEventListener('mousedown', onDown);
    }, []);

    const showRecent = open && focused && !value && recent.length > 0;

    return (
        <div ref={wrapRef} className="relative">
            <div
                className={`flex h-9 items-center overflow-hidden border transition-[width,background-color,border-color] duration-300 ease-netflix ${
                    open ? 'w-[min(56vw,17rem)] border-white/90 bg-black/80' : 'w-9 border-transparent bg-transparent'
                }`}
            >
                <button
                    type="button"
                    onClick={open ? () => inputRef.current?.focus() : focusInput}
                    aria-label="Search"
                    className="flex h-9 w-9 flex-shrink-0 items-center justify-center text-white"
                >
                    <SearchIcon className="h-5 w-5" />
                </button>
                <input
                    ref={inputRef}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    onFocus={() => {
                        setFocused(true);
                        setRecent(loadRecentSearches());
                    }}
                    onBlur={() => window.setTimeout(() => setFocused(false), 150)}
                    onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                            onChange('');
                            setOpen(false);
                            inputRef.current?.blur();
                        }
                    }}
                    tabIndex={open ? 0 : -1}
                    placeholder="Titles, movies, TV shows"
                    aria-label="Search titles"
                    className={`min-w-0 flex-1 bg-transparent text-sm text-white placeholder:text-[#8c8c8c] focus:outline-none ${open ? 'pr-1 opacity-100' : 'w-0 opacity-0'}`}
                />
                {open && value && (
                    <button
                        type="button"
                        onClick={() => {
                            onChange('');
                            inputRef.current?.focus();
                        }}
                        aria-label="Clear search"
                        className="mr-1 flex h-7 w-7 flex-shrink-0 items-center justify-center text-white"
                    >
                        <CloseIcon className="h-4 w-4" />
                    </button>
                )}
            </div>

            {showRecent && (
                <div className="absolute right-0 top-full mt-2 w-[min(56vw,17rem)] border border-white/10 bg-black/95 py-2 shadow-2xl animate-dropdown-in">
                    <div className="flex items-center justify-between px-3 pb-1">
                        <p className="text-[11px] uppercase tracking-widest text-[#8c8c8c]">Recent searches</p>
                        <button
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                                clearRecentSearches();
                                setRecent([]);
                            }}
                            className="text-[11px] text-[#8c8c8c] hover:text-white"
                        >
                            Clear
                        </button>
                    </div>
                    {recent.map((q) => (
                        <button
                            key={q}
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => onChange(q)}
                            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-netflix-text hover:bg-white/10"
                        >
                            <ClockIcon className="h-3.5 w-3.5 flex-shrink-0 text-[#8c8c8c]" />
                            <span className="truncate">{q}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

/** Mobile "Browse" dropdown (Netflix collapses the nav links on small screens). */
const MobileBrowse: React.FC<{ active: NavView | null; onNavigate: (v: NavView) => void }> = ({ active, onNavigate }) => {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const onDown = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', onDown);
        return () => document.removeEventListener('mousedown', onDown);
    }, []);
    return (
        <div ref={ref} className="relative md:hidden">
            <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex items-center gap-1 text-sm font-bold text-white">
                Browse
                <ChevronDownIcon className={`h-4 w-4 transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
            </button>
            {open && (
                <ul className="absolute left-1/2 top-full mt-4 w-56 -translate-x-1/2 border border-white/15 border-t-2 border-t-white/80 bg-black/95 py-1 shadow-2xl animate-dropdown-in">
                    {NAV_ITEMS.map((item) => (
                        <li key={item.id}>
                            <button
                                type="button"
                                onClick={() => {
                                    setOpen(false);
                                    onNavigate(item.id);
                                }}
                                className={`block w-full py-3 text-center text-sm transition-colors hover:bg-white/5 ${active === item.id ? 'font-bold text-white' : 'text-netflix-muted'}`}
                            >
                                {item.label}
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

const AppHeader: React.FC<AppHeaderProps> = ({
    view,
    isSearching,
    searchQuery,
    onSearchChange,
    onNavigate,
    onOpenGuide,
    onImport,
    onExport,
    onReset,
    onThemeSelect,
}) => {
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        let ticking = false;
        const onScroll = () => {
            if (ticking) return;
            ticking = true;
            requestAnimationFrame(() => {
                setScrolled(window.scrollY > 10);
                ticking = false;
            });
        };
        onScroll();
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    const active: NavView | null = !isSearching && NAV_ITEMS.some((n) => n.id === view) ? (view as NavView) : null;
    const solid = scrolled || isSearching || ['my-list', 'how-to-use', 'other'].includes(view);

    return (
        <header className="fixed inset-x-0 top-0 z-40">
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/70 via-black/25 to-transparent" />
            <div aria-hidden="true" className={`pointer-events-none absolute inset-0 bg-netflix-bg transition-opacity duration-500 ${solid ? 'opacity-100' : 'opacity-0'}`} />
            <div className="relative flex h-[4.25rem] items-center gap-5 px-[4%] sm:h-[4.9rem] lg:gap-10">
                <button
                    type="button"
                    onClick={() => onNavigate('home')}
                    className="flex-shrink-0 text-[1.65rem] font-bold uppercase leading-none tracking-[-0.06em] text-netflix-red transition-transform duration-200 hover:scale-[1.03] sm:text-[2.2rem]"
                    style={{ textShadow: '0 2px 10px rgba(0,0,0,0.35)' }}
                    aria-label="VidFast home"
                >
                    VidFast
                </button>

                <nav aria-label="Primary" className="flex-1">
                    <ul className="hidden items-center gap-5 md:flex lg:gap-[1.3rem]">
                        {NAV_ITEMS.map((item) => (
                            <li key={item.id}>
                                <button
                                    type="button"
                                    onClick={() => onNavigate(item.id)}
                                    aria-current={active === item.id ? 'page' : undefined}
                                    className={`text-sm transition-colors duration-300 ${
                                        active === item.id ? 'font-bold text-white' : 'text-netflix-text hover:text-netflix-muted'
                                    }`}
                                >
                                    {item.label}
                                </button>
                            </li>
                        ))}
                    </ul>
                    <MobileBrowse active={active} onNavigate={onNavigate} />
                </nav>

                <div className="flex flex-shrink-0 items-center gap-3 sm:gap-5">
                    <NavSearch value={searchQuery} onChange={onSearchChange} />
                    <ProfileMenu onImport={onImport} onExport={onExport} onReset={onReset} onThemeSelect={onThemeSelect} onOpenGuide={onOpenGuide} />
                </div>
            </div>
        </header>
    );
};

export default AppHeader;
