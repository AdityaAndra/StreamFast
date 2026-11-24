import React from 'react';

interface FooterProps {
  onOpenGuide: () => void;
  onThemeSelect: () => void;
  onExport: () => void;
  onNavigate: (view: 'home' | 'tv-shows' | 'movies' | 'my-list') => void;
}

const FooterLink: React.FC<{ onClick: () => void; children: React.ReactNode }> = ({ onClick, children }) => (
  <li>
    <button type="button" onClick={onClick} className="text-left hover:underline">
      {children}
    </button>
  </li>
);

const Footer: React.FC<FooterProps> = ({ onOpenGuide, onThemeSelect, onExport, onNavigate }) => (
  <footer className="mx-auto max-w-[980px] px-[4%] pb-10 pt-16 text-[13px] text-[#808080]">
    <ul className="mb-8 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
      <FooterLink onClick={() => onNavigate('home')}>Home</FooterLink>
      <FooterLink onClick={() => onNavigate('tv-shows')}>TV Shows</FooterLink>
      <FooterLink onClick={() => onNavigate('movies')}>Movies</FooterLink>
      <FooterLink onClick={() => onNavigate('my-list')}>My List</FooterLink>
      <FooterLink onClick={onOpenGuide}>How to use VidFast</FooterLink>
      <FooterLink onClick={onThemeSelect}>Player theme</FooterLink>
      <FooterLink onClick={onExport}>Export history</FooterLink>
      <li>
        <a href="https://www.themoviedb.org/" target="_blank" rel="noopener noreferrer" className="hover:underline">
          Data by TMDB
        </a>
      </li>
    </ul>
    <p className="mb-2 text-[11px] leading-relaxed">
      This product uses the TMDB API but is not endorsed or certified by TMDB. IMDb ratings: information courtesy of IMDb (imdb.com), used with permission. Streams are provided by VidFast.
    </p>
    <p className="text-[11px]">© {new Date().getFullYear()} VidFast Link Generator</p>
  </footer>
);

export default Footer;
