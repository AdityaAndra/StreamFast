import React, { useState, useMemo, useEffect, useRef } from 'react';
import type { ColorInfo } from '../types';
import { CloseIcon, CheckStaticIcon, SearchIcon, PlayIcon } from './Icons';
import { PREDEFINED_THEMES, CSS_COLORS, DEFAULT_THEME } from '../constants';
import { useAppContext } from '../contexts/AppContext';
import { useCloseOnBack } from '../utils/router';

interface ThemeModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const HEX6 = /^#[0-9a-f]{6}$/i;

/** '#abc' / 'abc' / '#AABBCC' -> '#AABBCC', anything else -> null. */
const normaliseHex = (value: string): string | null => {
    let v = value.trim();
    if (!v) return null;
    if (!v.startsWith('#')) v = `#${v}`;
    if (/^#[0-9a-f]{3}$/i.test(v)) v = `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`;
    return HEX6.test(v) ? v.toUpperCase() : null;
};

/** Very light colours need dark text/checks on top of them. */
const isLight = (hex: string): boolean => {
    const h = normaliseHex(hex);
    if (!h) return false;
    const r = parseInt(h.slice(1, 3), 16);
    const g = parseInt(h.slice(3, 5), 16);
    const b = parseInt(h.slice(5, 7), 16);
    return 0.299 * r + 0.587 * g + 0.114 * b > 186;
};

const sameHex = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

const nameFor = (hex: string): string =>
    PREDEFINED_THEMES.find((t) => sameHex(t.hex, hex))?.name ||
    CSS_COLORS.find((c) => sameHex(c.hex, hex))?.name ||
    `Custom ${hex.toUpperCase()}`;

/** A small mock of the player's control bar, drawn in the chosen colour. */
const PlayerPreview: React.FC<{ hex: string; name: string }> = ({ hex, name }) => (
    <div className="relative aspect-[16/7] w-full overflow-hidden rounded-md bg-black ring-1 ring-white/10">
        <div
            aria-hidden="true"
            className="absolute inset-0"
            style={{
                background: `radial-gradient(120% 90% at 70% 20%, ${hex}33 0%, rgba(20,20,20,0) 55%), linear-gradient(160deg, #2a2a2a 0%, #101010 60%, #000 100%)`,
            }}
        />
        <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />

        <div className="absolute left-4 top-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/50">Preview</div>

        <div className="absolute inset-x-4 bottom-3 sm:inset-x-5 sm:bottom-4">
            <div className="mb-2 flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full" style={{ backgroundColor: hex, color: isLight(hex) ? '#000' : '#fff' }}>
                    <PlayIcon className="ml-0.5 h-4 w-4" />
                </span>
                <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">S1:E3 · The Long Night</p>
                    <p className="truncate text-xs text-white/60">{name}</p>
                </div>
                <span className="ml-auto text-xs tabular-nums text-white/70">23:14 / 58:02</span>
            </div>
            <div className="relative h-1 w-full rounded-full bg-white/25">
                <div className="absolute inset-y-0 left-0 w-[40%] rounded-full bg-white/35" />
                <div className="absolute inset-y-0 left-0 w-[30%] rounded-full transition-[background-color] duration-300" style={{ backgroundColor: hex }} />
                <div
                    className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full shadow-[0_0_0_3px_rgba(0,0,0,0.35)] transition-[background-color] duration-300"
                    style={{ left: '30%', backgroundColor: hex }}
                />
            </div>
        </div>
    </div>
);

const Swatch: React.FC<{ theme: ColorInfo; selected: boolean; onSelect: (t: ColorInfo) => void }> = ({ theme, selected, onSelect }) => (
    <button
        type="button"
        onClick={() => onSelect(theme)}
        aria-pressed={selected}
        aria-label={`${theme.name} ${theme.hex}`}
        className="group flex flex-col items-center gap-2 rounded-md p-1.5 text-center outline-none transition-colors focus-visible:ring-2 focus-visible:ring-white"
    >
        <span
            className={`relative flex aspect-square w-full items-center justify-center rounded-md transition-transform duration-200 ease-out-expo group-hover:scale-[1.06] ${
                selected ? 'ring-2 ring-white ring-offset-2 ring-offset-[#181818]' : 'ring-1 ring-white/10'
            }`}
            style={{ backgroundColor: theme.hex }}
        >
            {selected && <CheckStaticIcon className={`h-6 w-6 ${isLight(theme.hex) ? 'text-black' : 'text-white'}`} />}
        </span>
        <span className={`w-full truncate text-[13px] leading-tight ${selected ? 'font-semibold text-white' : 'text-netflix-muted group-hover:text-white'}`}>
            {theme.name}
        </span>
    </button>
);

const ThemeModal: React.FC<ThemeModalProps> = ({ isOpen, onClose }) => {
    const { playerTheme: currentTheme, setPlayerTheme } = useAppContext();
    const [query, setQuery] = useState('');
    const [customHex, setCustomHex] = useState(currentTheme.hex.toUpperCase());
    const [hexText, setHexText] = useState(currentTheme.hex.toUpperCase());

    // Reset the custom picker to the current colour each time the window opens.
    useEffect(() => {
        if (!isOpen) return;
        setQuery('');
        setCustomHex(currentTheme.hex.toUpperCase());
        setHexText(currentTheme.hex.toUpperCase());
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    const results = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return [];
        return CSS_COLORS.filter((c) => c.name.toLowerCase().includes(q) || c.hex.toLowerCase().includes(q.replace(/^#?/, '#'))).slice(0, 24);
    }, [query]);

    // A real dialog: Escape closes it, focus moves in on open and back where it was on close.
    const dialogRef = useRef<HTMLDivElement>(null);
    const onCloseRef = useRef(onClose);
    onCloseRef.current = onClose;
    useCloseOnBack(isOpen, onClose);
    useEffect(() => {
        if (!isOpen) return;
        const before = document.activeElement as HTMLElement | null;
        dialogRef.current?.focus();
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onCloseRef.current();
        };
        window.addEventListener('keydown', onKey);
        return () => {
            window.removeEventListener('keydown', onKey);
            before?.focus?.();
        };
    }, [isOpen]);

    if (!isOpen) return null;

    const select = (theme: ColorInfo) => {
        if (sameHex(theme.hex, currentTheme.hex)) return;
        setPlayerTheme({ name: theme.name, hex: theme.hex.toUpperCase() });
        setCustomHex(theme.hex.toUpperCase());
        setHexText(theme.hex.toUpperCase());
    };

    const customValid = normaliseHex(hexText);
    const customIsCurrent = !!customValid && sameHex(customValid, currentTheme.hex);
    const applyCustom = () => {
        if (!customValid) return;
        select({ name: nameFor(customValid), hex: customValid });
    };

    const isPreset = PREDEFINED_THEMES.some((t) => sameHex(t.hex, currentTheme.hex));
    const isDefault = sameHex(currentTheme.hex, DEFAULT_THEME.hex);
    const previewHex = customValid && !customIsCurrent ? customValid : currentTheme.hex;
    const previewName = customValid && !customIsCurrent ? `${nameFor(customValid)} (not applied yet)` : currentTheme.name;

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-0 animate-fade-in-fast sm:items-center sm:p-6" onClick={onClose}>
            <div
                ref={dialogRef}
                tabIndex={-1}
                role="dialog"
                aria-modal="true"
                aria-labelledby="theme-modal-title"
                onClick={(e) => e.stopPropagation()}
                className="flex max-h-[92vh] w-full max-w-[640px] flex-col overflow-hidden rounded-t-xl bg-[#181818] text-white shadow-[0_24px_64px_rgba(0,0,0,0.75)] outline-none animate-zoom-in sm:rounded-lg"
            >
                {/* Header */}
                <div className="flex items-start gap-4 px-6 pb-4 pt-6 sm:px-8">
                    <div className="min-w-0 flex-1">
                        <h2 id="theme-modal-title" className="text-[22px] font-bold leading-tight tracking-[-0.01em] sm:text-2xl">
                            Player theme
                        </h2>
                        <p className="mt-1 text-sm text-netflix-muted">The accent colour of the video player: progress bar, buttons and highlights.</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close"
                        className="-mr-2 -mt-1 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#181818] text-white ring-1 ring-white/20 transition-colors hover:bg-white/10"
                    >
                        <CloseIcon className="h-5 w-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-6 pb-6 sm:px-8">
                    <PlayerPreview hex={previewHex} name={previewName} />

                    {/* Presets */}
                    <section className="mt-7" aria-labelledby="theme-presets">
                        <h3 id="theme-presets" className="mb-3 text-[15px] font-semibold text-white">
                            Presets
                        </h3>
                        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6 sm:gap-3">
                            {PREDEFINED_THEMES.map((t) => (
                                <Swatch key={t.hex} theme={t} selected={sameHex(t.hex, currentTheme.hex)} onSelect={select} />
                            ))}
                        </div>
                    </section>

                    {/* Custom colour */}
                    <section className="mt-7 border-t border-white/10 pt-6" aria-labelledby="theme-custom">
                        <div className="mb-3 flex items-baseline justify-between gap-3">
                            <h3 id="theme-custom" className="text-[15px] font-semibold text-white">
                                Custom colour
                            </h3>
                            {!isPreset && (
                                <span className="truncate text-xs text-netflix-muted">
                                    Using <span className="font-semibold text-white">{currentTheme.name}</span>
                                </span>
                            )}
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                            <label className="relative h-11 w-11 flex-shrink-0 cursor-pointer overflow-hidden rounded-md ring-1 ring-white/20" style={{ backgroundColor: customValid || customHex }}>
                                <span className="sr-only">Pick a colour</span>
                                <input
                                    type="color"
                                    value={customHex}
                                    onChange={(e) => {
                                        const v = e.target.value.toUpperCase();
                                        setCustomHex(v);
                                        setHexText(v);
                                    }}
                                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                                />
                            </label>
                            <div className="flex h-11 min-w-[9rem] flex-1 items-center rounded-md bg-[#2a2a2a] px-3 ring-1 ring-white/10 focus-within:ring-2 focus-within:ring-white">
                                <span className="mr-2 text-sm text-netflix-muted">Hex</span>
                                <input
                                    type="text"
                                    value={hexText}
                                    onChange={(e) => {
                                        setHexText(e.target.value);
                                        const n = normaliseHex(e.target.value);
                                        if (n) setCustomHex(n);
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') applyCustom();
                                    }}
                                    maxLength={7}
                                    spellCheck={false}
                                    aria-label="Hex colour code"
                                    aria-invalid={!customValid}
                                    className="w-full bg-transparent font-mono text-[15px] uppercase tracking-wide text-white outline-none placeholder:text-white/30"
                                    placeholder="#E50914"
                                />
                            </div>
                            <button
                                type="button"
                                onClick={applyCustom}
                                disabled={!customValid || customIsCurrent}
                                className="nf-btn nf-btn-white !h-11 !text-[15px] disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                {customIsCurrent ? 'Applied' : 'Apply'}
                            </button>
                        </div>
                        {!customValid && hexText.trim() !== '' && <p className="mt-2 text-xs text-[#e87c03]">Enter a 6-digit hex code, like #E50914.</p>}

                        {/* Search named colours */}
                        <div className="mt-4 flex h-11 items-center gap-2 rounded-md bg-[#2a2a2a] px-3 ring-1 ring-white/10 focus-within:ring-2 focus-within:ring-white">
                            <SearchIcon className="h-4 w-4 flex-shrink-0 text-netflix-muted" />
                            <input
                                type="search"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Search colours, e.g. crimson, teal, gold"
                                aria-label="Search colours by name or hex code"
                                className="w-full bg-transparent text-[15px] text-white outline-none placeholder:text-white/40"
                            />
                        </div>
                        {query.trim() !== '' && (
                            <div className="mt-3">
                                {results.length > 0 ? (
                                    <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 sm:gap-3">
                                        {results.map((c) => (
                                            <Swatch key={c.name} theme={c} selected={sameHex(c.hex, currentTheme.hex)} onSelect={select} />
                                        ))}
                                    </div>
                                ) : (
                                    <p className="py-3 text-sm text-netflix-muted">No colours match “{query.trim()}”.</p>
                                )}
                            </div>
                        )}
                    </section>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between gap-3 border-t border-white/10 bg-[#141414] px-6 py-4 sm:px-8">
                    <button
                        type="button"
                        onClick={() => select(DEFAULT_THEME)}
                        disabled={isDefault}
                        className="text-sm text-netflix-muted underline-offset-4 transition-colors hover:text-white hover:underline disabled:pointer-events-none disabled:opacity-0"
                    >
                        Reset to Netflix Red
                    </button>
                    <button type="button" onClick={onClose} className="nf-btn nf-btn-white !h-10 !px-7 !text-[15px]">
                        Done
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ThemeModal;
