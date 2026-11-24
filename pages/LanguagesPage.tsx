import React, { useMemo } from 'react';
import { BrowseView } from './BrowsePage';
import { navigate } from '../utils/router';
import { LANGUAGES } from '../utils/browse';

/** Netflix "Browse by Languages": pick a language, then filter / sort everything in it. */
const POPULAR = ['en', 'hi', 'ko', 'ja', 'es', 'ta', 'te', 'ml', 'fr', 'de', 'it', 'zh', 'tr', 'th', 'pt'];

const LanguagesPage: React.FC<{ search: string }> = ({ search }) => {
  const sp = useMemo(() => new URLSearchParams(search), [search]);
  const lang = sp.get('lang') || 'en';
  const effective = useMemo(() => {
    const next = new URLSearchParams(search);
    if (!next.get('lang')) next.set('lang', 'en');
    next.delete('title');
    return `?${next.toString()}`;
  }, [search]);

  const setLang = (code: string) => {
    const next = new URLSearchParams(search);
    next.set('lang', code);
    next.delete('title');
    navigate(`/languages?${next.toString()}`, { replace: true, keepScroll: true });
  };

  const name = LANGUAGES.find(([c]) => c === lang)?.[1] || lang;

  const header = (
    <div className="mb-[1.6vw]">
      <h1 className="mb-[1.2vw] text-[clamp(1.6rem,2.6vw,2.75rem)] font-bold tracking-[-0.02em] text-white">Browse by Languages</h1>
      <div className="mb-[1.2vw] flex flex-wrap items-center gap-3">
        <span className="text-[max(14px,1vw)] text-netflix-muted">Select your preferences</span>
        <select aria-label="Original language" className="nf-select is-active !text-[15px] !font-semibold" value="original" onChange={() => {}}>
          <option value="original">Original Language</option>
        </select>
        <select aria-label="Language" value={lang} onChange={(e) => setLang(e.target.value)} className="nf-select is-active !text-[15px] !font-semibold">
          {LANGUAGES.map(([c, n]) => (
            <option key={c} value={c}>{n}</option>
          ))}
        </select>
      </div>
      <div className="flex flex-wrap gap-2">
        {POPULAR.map((c) => {
          const n = LANGUAGES.find(([x]) => x === c)?.[1] || c;
          const on = c === lang;
          return (
            <button
              key={c}
              type="button"
              onClick={() => setLang(c)}
              aria-pressed={on}
              className={`rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors duration-150 ${
                on ? 'border-white bg-white text-black' : 'border-white/25 text-netflix-text hover:border-white'
              }`}
            >
              {n}
            </button>
          );
        })}
      </div>
      <p className="sr-only" aria-live="polite">Showing {name} titles</p>
    </div>
  );

  return <BrowseView search={effective} hideFilters={['lang']} resetQuery={`?lang=${lang}`} header={header} />;
};

export default LanguagesPage;
