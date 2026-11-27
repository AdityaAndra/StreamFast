import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import ProfileMenu, { HeaderSignInButton } from './ProfileMenu';
import { StreamFastLogo, NotificationsBell } from './Brand';
import { SearchIcon, CloseIcon, ClockIcon, ChevronDownIcon } from './Icons';
import { loadRecentSearches, clearRecentSearches } from '../utils/recentSearches';

export type AppView = 'home' | 'movies' | 'tv-shows' | 'latest' | 'explore' | 'my-list' | 'languages' | 'title' | 'other';
type NavView = 'home' | 'movies' | 'tv-shows' | 'explore' | 'latest' | 'my-list' | 'languages';

const NAV_ITEMS: { id: NavView; label: string }[] = [
    { id: 'home', label: 'Home' },
    { id: 'movies', label: 'Movies' },
    { id: 'tv-shows', label: 'TV Shows' },
    { id: 'explore', label: 'Categories' },
    { id: 'latest', label: 'New & Popular' },
    { id: 'my-list', label: 'My Content' },
    { id: 'languages', label: 'Browse by Languages' },
];

interface AppHeaderProps {
    view: AppView;
    isSearching: boolean;
    searchQuery: string;
    onSearchChange: (query: string) => void;
    onNavigate: (view: NavView) => void;
    onImport: (file: File) => void;
    onExport: () => void;
    onReset: () => void;
    onThemeSelect: () => void;
    /** The page starts with a big picture (billboard, person, franchise): stay see-through over it until you scroll. */
    overHero?: boolean;
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
                    onBlur={(e) => {
                        // Tabbing into the recent-searches list keeps it open.
                        const to = e.relatedTarget as HTMLElement | null;
                        if (to && to.closest('[data-search-recent]')) return;
                        window.setTimeout(() => setFocused(false), 150);
                    }}
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
                <div
                    data-search-recent=""
                    onBlur={(e) => {
                        const to = e.relatedTarget as HTMLElement | null;
                        if (to && (to.closest('[data-search-recent]') || to === inputRef.current)) return;
                        setFocused(false);
                    }}
                    className="absolute right-0 top-full mt-2 w-[min(56vw,17rem)] border border-white/10 bg-black/95 py-2 shadow-2xl animate-dropdown-in"
                >
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

/** Desktop links. They never push the search box, bell or profile off the screen: whatever doesn't fit
 *  in the space left (a narrow window, or the search box opening) moves into a "More" menu, last link first. */
const DesktopNav: React.FC<{ active: NavView | null; onNavigate: (v: NavView) => void }> = ({ active, onNavigate }) => {
    const wrapRef = useRef<HTMLDivElement>(null);
    const measureRef = useRef<HTMLUListElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const [count, setCount] = useState(NAV_ITEMS.length);
    const [menu, setMenu] = useState(false);

    useLayoutEffect(() => {
        const wrap = wrapRef.current;
        const meas = measureRef.current;
        if (!wrap || !meas) return;
        let raf = 0;
        const calc = () => {
            cancelAnimationFrame(raf);
            raf = requestAnimationFrame(() => {
                const avail = wrap.clientWidth;
                const cells = Array.from(meas.children) as HTMLElement[];
                const more = cells.pop();
                if (!more) return;
                const gap = parseFloat(getComputedStyle(meas).columnGap) || 0;
                const widths = cells.map((c) => c.getBoundingClientRect().width);
                const all = widths.reduce((a, b) => a + b, 0) + gap * (widths.length - 1);
                if (all <= avail) return setCount(widths.length);
                let used = more.getBoundingClientRect().width;
                let n = 0;
                for (const w of widths) {
                    if (used + gap + w > avail) break;
                    used += gap + w;
                    n++;
                }
                setCount(n);
            });
        };
        calc();
        const ro = new ResizeObserver(calc);
        ro.observe(wrap);
        (document as any).fonts?.ready?.then(calc);
        return () => {
            ro.disconnect();
            cancelAnimationFrame(raf);
        };
    }, []);

    useEffect(() => {
        if (!menu) return;
        const onDown = (e: MouseEvent) => menuRef.current && !menuRef.current.contains(e.target as Node) && setMenu(false);
        const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenu(false);
        document.addEventListener('mousedown', onDown);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onDown);
            document.removeEventListener('keydown', onKey);
        };
    }, [menu]);
    useEffect(() => {
        if (count >= NAV_ITEMS.length) setMenu(false);
    }, [count]);

    const shown = NAV_ITEMS.slice(0, count);
    const hidden = NAV_ITEMS.slice(count);
    const hiddenActive = hidden.some((i) => i.id === active);

    return (
        <div ref={wrapRef} className="relative hidden min-w-0 flex-1 lg:block">
            {/* Invisible copy used only to measure each link at its widest (bold) size. */}
            <ul ref={measureRef} aria-hidden="true" className="pointer-events-none invisible absolute left-0 top-0 flex items-center gap-0.5 whitespace-nowrap xl:gap-1">
                {NAV_ITEMS.map((item) => (
                    <li key={item.id} className="nf-nav-item is-active">{item.label}</li>
                ))}
                <li className="nf-nav-item is-active flex items-center gap-1">More<ChevronDownIcon className="h-4 w-4" /></li>
            </ul>
            <ul className="flex items-center gap-0.5 whitespace-nowrap xl:gap-1">
                {shown.map((item) => (
                    <li key={item.id}>
                        <button
                            type="button"
                            onClick={() => onNavigate(item.id)}
                            aria-current={active === item.id ? 'page' : undefined}
                            className={`nf-nav-item ${active === item.id ? 'is-active' : ''}`}
                        >
                            {item.label}
                        </button>
                    </li>
                ))}
                {hidden.length > 0 && (
                    <li>
                        <div ref={menuRef} className="relative">
                            <button
                                type="button"
                                onClick={() => setMenu((o) => !o)}
                                aria-haspopup="menu"
                                aria-expanded={menu}
                                className={`nf-nav-item flex items-center gap-1 ${hiddenActive ? 'is-active' : ''}`}
                            >
                                More
                                <ChevronDownIcon className={`h-4 w-4 transition-transform duration-300 ${menu ? 'rotate-180' : ''}`} />
                            </button>
                            {menu && (
                                <ul role="menu" className="absolute left-0 top-full z-50 mt-3 min-w-[13rem] overflow-hidden rounded-lg border border-white/10 bg-[#181818]/[0.98] py-1.5 shadow-[0_18px_50px_rgba(0,0,0,0.7)] animate-dropdown-in">
                                    {hidden.map((item) => (
                                        <li key={item.id} role="none">
                                            <button
                                                type="button"
                                                role="menuitem"
                                                onClick={() => {
                                                    setMenu(false);
                                                    onNavigate(item.id);
                                                }}
                                                aria-current={active === item.id ? 'page' : undefined}
                                                className={`block w-full px-4 py-2.5 text-left text-[15px] transition-colors hover:bg-white/[0.08] ${active === item.id ? 'font-bold text-white' : 'text-[#e5e5e5]'}`}
                                            >
                                                {item.label}
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </li>
                )}
            </ul>
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
        <div ref={ref} className="relative lg:hidden">
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
    onImport,
    onExport,
    onReset,
    onThemeSelect,
    overHero = false,
}) => {
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        let ticking = false;
        let last = false;
        const onScroll = () => {
            if (ticking) return;
            ticking = true;
            requestAnimationFrame(() => {
                ticking = false;
                // Only re-render when the header actually changes state (not on every scrolled frame).
                const next = window.scrollY > 10;
                if (next === last) return;
                last = next;
                setScrolled(next);
            });
        };
        onScroll();
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    const active: NavView | null = !isSearching && NAV_ITEMS.some((n) => n.id === view) ? (view as NavView) : null;
    const solid = scrolled || isSearching || (!overHero && ['my-list', 'explore', 'languages', 'other'].includes(view));

    return (
        <header className="sf-header fixed inset-x-0 top-0 z-40">
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/45 via-black/10 to-transparent" />
            <div aria-hidden="true" className={`pointer-events-none absolute inset-0 bg-netflix-bg transition-opacity duration-500 ${solid ? 'opacity-100' : 'opacity-0'}`} />
            <div className="relative flex h-[4.25rem] items-center gap-5 px-[4%] sm:h-[4.9rem] lg:gap-6 xl:gap-9">
                <button type="button" onClick={() => onNavigate('home')} className="sf-logo-btn flex-shrink-0 py-1" aria-label="StreamFast home">
                    <StreamFastLogo />
                </button>

                <nav aria-label="Primary" className="flex min-w-0 flex-1 items-center">
                    <DesktopNav active={active} onNavigate={onNavigate} />
                    <MobileBrowse active={active} onNavigate={onNavigate} />
                </nav>

                <div className="flex flex-shrink-0 items-center gap-2 sm:gap-4">
                    <NavSearch value={searchQuery} onChange={onSearchChange} />
                    <NotificationsBell />
                    <HeaderSignInButton />
                    <ProfileMenu onImport={onImport} onExport={onExport} onReset={onReset} onThemeSelect={onThemeSelect} />
                </div>
            </div>
        </header>
    );
};

export default AppHeader;
