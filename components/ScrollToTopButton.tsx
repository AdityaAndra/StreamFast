import React from 'react';
import { ArrowUpIcon } from './Icons';

const ScrollToTopButton: React.FC<{ onClick: () => void }> = ({ onClick }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className="fixed bottom-6 right-5 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-[#141414]/80 text-white shadow-lg shadow-black/50 backdrop-blur-md transition-colors duration-200 hover:border-netflix-red hover:bg-netflix-red animate-fade-in sm:right-8"
      aria-label="Scroll to top"
    >
      <ArrowUpIcon className="h-5 w-5" />
    </button>
  );
};

export default ScrollToTopButton;
