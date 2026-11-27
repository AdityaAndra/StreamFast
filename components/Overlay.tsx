import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { pauseScroll, resumeScroll } from '../utils/smoothScroll';
import { holdPreviews, PREVIEW_LEVEL } from '../utils/previews';

/**
 * Full-screen layer (photo viewer, trailers, videos). Rendered at the end of <body>, so it always sits above
 * the header, sticky tab bars and the title window, whatever page or panel opened it (inside a page it could
 * be drawn underneath them). The page behind can't scroll while it's open, and trailer previews under it
 * (billboard, hover cards, the title window's hero) pause.
 */
const Overlay: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  useEffect(() => {
    pauseScroll();
    const release = holdPreviews(PREVIEW_LEVEL.window);
    return () => {
      resumeScroll();
      release();
    };
  }, []);
  return createPortal(children, document.body);
};

export default Overlay;
