import React from 'react';

interface FooterProps {
  onThemeSelect: () => void;
  onExport: () => void;
  onNavigate: (view: 'home' | 'tv-shows' | 'movies' | 'my-list') => void;
}

const REPO = 'https://github.com/AdityaAndra/StreamFast';

/** "Report a problem" opens GitHub's bug form with the page you were on and your browser already filled in. */
const issueUrl = () => {
  const q = new URLSearchParams({
    template: 'bug_report.yml',
    title: '[Bug]: ',
    page: window.location.href,
    browser: navigator.userAgent,
  });
  return `${REPO}/issues/new?${q.toString()}`;
};

const GitHubIcon: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
    <path d="M12 .5C5.65.5.5 5.65.5 12a11.5 11.5 0 0 0 7.86 10.92c.58.1.79-.25.79-.56v-2c-3.2.7-3.87-1.37-3.87-1.37-.53-1.33-1.28-1.69-1.28-1.69-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.68 0-1.25.45-2.28 1.19-3.08-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.8 1.19 1.83 1.19 3.08 0 4.41-2.69 5.38-5.26 5.67.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
  </svg>
);

const BugIcon: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 6.5V5a4 4 0 0 1 8 0v1.5" />
    <rect x="6" y="6.5" width="12" height="13" rx="6" />
    <path d="M12 10v9.5M3 13h3M18 13h3M4 8l2.4 1.6M20 8l-2.4 1.6M4 19l2.4-1.6M20 19l-2.4-1.6" />
  </svg>
);

const FooterLink: React.FC<{ onClick: () => void; children: React.ReactNode }> = ({ onClick, children }) => (
  <li>
    <button type="button" onClick={onClick} className="text-left transition-colors hover:text-white hover:underline">
      {children}
    </button>
  </li>
);

const ExtLink: React.FC<{ href: string; children: React.ReactNode }> = ({ href, children }) => (
  <li>
    <a href={href} target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-white hover:underline">
      {children}
    </a>
  </li>
);

const Footer: React.FC<FooterProps> = ({ onThemeSelect, onExport, onNavigate }) => (
  <footer className="mx-auto max-w-[980px] px-[4%] pb-10 pt-16 text-[13px] text-[#808080]">
    {/* Open source + bug reports */}
    <div className="mb-9 flex flex-col gap-4 rounded-xl border border-white/[0.08] bg-white/[0.03] p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-[15px] font-semibold text-white">Found a problem or have an idea?</p>
        <p className="mt-1 leading-relaxed">StreamFast is open source. Report a bug or suggest a feature on GitHub: the page you're on is added for you.</p>
      </div>
      <div className="flex flex-shrink-0 flex-wrap gap-2.5">
        <a
          href={REPO}
          target="_blank"
          rel="noopener noreferrer"
          className="nf-btn nf-btn-grey !gap-2 !px-4 !py-2 !text-[14px]"
          aria-label="StreamFast on GitHub (opens in a new tab)"
        >
          <GitHubIcon className="h-[18px] w-[18px]" />
          GitHub
        </a>
        <a
          href={REPO + '/issues/new'}
          onClick={(e) => {
            // Fill in the page and browser at click time (the link above is the no-script fallback).
            e.currentTarget.href = issueUrl();
          }}
          target="_blank"
          rel="noopener noreferrer"
          className="nf-btn nf-btn-white !gap-2 !px-4 !py-2 !text-[14px]"
          aria-label="Report a problem on GitHub (opens in a new tab)"
        >
          <BugIcon className="h-[18px] w-[18px]" />
          Report a problem
        </a>
      </div>
    </div>

    <ul className="mb-8 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
      <FooterLink onClick={() => onNavigate('home')}>Home</FooterLink>
      <FooterLink onClick={() => onNavigate('tv-shows')}>TV Shows</FooterLink>
      <FooterLink onClick={() => onNavigate('movies')}>Movies</FooterLink>
      <FooterLink onClick={() => onNavigate('my-list')}>My Content</FooterLink>
      <FooterLink onClick={onThemeSelect}>Player theme</FooterLink>
      <FooterLink onClick={onExport}>Export history</FooterLink>
      <ExtLink href={REPO}>Source code</ExtLink>
      <ExtLink href={REPO + '/issues'}>Known issues</ExtLink>
      <ExtLink href="https://www.themoviedb.org/">Data by TMDB</ExtLink>
    </ul>
    <p className="mb-2 text-[11px] leading-relaxed">
      This product uses the TMDB API but is not endorsed or certified by TMDB. IMDb ratings: information courtesy of IMDb (imdb.com), used with permission. Streams are provided by VidFast.
    </p>
    <p className="flex flex-wrap items-center gap-x-2 text-[11px]">
      <span>© {new Date().getFullYear()} StreamFast</span>
      <span aria-hidden="true">·</span>
      <a href={REPO} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-white hover:underline">
        <GitHubIcon className="h-3 w-3" />
        AdityaAndra/StreamFast
      </a>
    </p>
  </footer>
);

export default Footer;
