import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import EmbedLinkModal from './components/EmbedLinkModal';
import ConfirmationModal from './components/ConfirmationModal';
import HowToUseGuide from './components/HowToUseGuide';
import ResetConfirmationModal from './components/ResetConfirmationModal';
import ScrollToTopButton from './components/ScrollToTopButton';
import ThemeModal from './components/ThemeModal';
import AppHeader, { AppView } from './components/AppHeader';
import Footer from './components/Footer';
import Toast from './components/Toast';
import { HoverPreviewProvider } from './components/HoverPreview';
import HomePage from './pages/HomePage';
import MoviesPage from './pages/MoviesPage';
import TvShowsPage from './pages/TvShowsPage';
import LatestPage from './pages/LatestPage';
import MyListPage from './pages/MyListPage';
import SearchResultsPage from './pages/SearchResultsPage';
import TitlePage from './pages/TitlePage';
import NotFoundPage from './pages/NotFoundPage';
import ExplorePage from './pages/ExplorePage';
import FranchisePage from './pages/FranchisePage';
import { BrowsePage, CompanyPage, ProviderPage } from './pages/BrowsePage';
import { BrandGridPage } from './components/BrandRow';
import { initSmoothScroll, pauseScroll, resumeScroll, scrollToY } from './utils/smoothScroll';
import type { SearchResult, WatchProgress } from './types';
import { useAppContext } from './contexts/AppContext';
import { PlayerContext, PlayerTab } from './contexts/PlayerContext';
import { useLinkUpdater } from './hooks/useLinkUpdater';
import { consumeScrollRestore, navigate, Route, useLocationString, useRoute } from './utils/router';

const NAV_PATHS: Record<string, string> = {
  home: '/',
  'tv-shows': '/tv',
  movies: '/movies',
  latest: '/latest',
  explore: '/explore',
  'my-list': '/my-list',
};

const viewOf = (route: Route): AppView => {
  switch (route.name) {
    case 'home': return 'home';
    case 'tv': return 'tv-shows';
    case 'movies': return 'movies';
    case 'latest': return 'latest';
    case 'explore': case 'browse': case 'brands': case 'company': case 'provider': case 'franchise': return 'explore';
    case 'my-list': return 'my-list';
    case 'guide': return 'how-to-use';
    case 'title': return 'title';
    default: return 'other';
  }
};

const App: React.FC = () => {
  const { continueWatchingList, feedbackMessage, exportList, importList, resetData } = useAppContext();
  const route = useRoute();
  const location = useLocationString();
  const { linkProps, actuallyUpdateFromLink, confirmationState } = useLinkUpdater();

  const [player, setPlayer] = useState<{ item: SearchResult; progress?: WatchProgress; tab?: PlayerTab; key: number } | null>(null);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [isThemeModalOpen, setIsThemeModalOpen] = useState(false);
  const [isGuideClosing, setIsGuideClosing] = useState(false);
  const [showScrollToTop, setShowScrollToTop] = useState(false);
  const lastBrowsePath = useRef('/');

  const isSearching = route.name === 'search';
  const searchQuery = isSearching ? route.q : '';

  useEffect(() => {
    initSmoothScroll();
  }, []);

  // Freeze the page behind any open dialog.
  const anyModal = !!player || isThemeModalOpen || isResetModalOpen || confirmationState.isOpen;
  useEffect(() => {
    if (anyModal) pauseScroll();
    else resumeScroll();
  }, [anyModal]);

  // Back/forward: restore scroll position once the page has rendered.
  useLayoutEffect(() => {
    consumeScrollRestore();
  }, [location]);

  useEffect(() => {
    if (!isSearching) lastBrowsePath.current = location;
  }, [isSearching, location]);

  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        setShowScrollToTop(window.scrollY > 900);
        ticking = false;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!['title', 'company', 'provider', 'franchise'].includes(route.name)) {
      const titles: Partial<Record<Route['name'], string>> = {
        home: 'Home', movies: 'Movies', tv: 'TV Shows', latest: 'New & Popular', 'my-list': 'My List', guide: 'How to use', search: 'Search', explore: 'Explore', browse: 'Browse', brands: 'Browse',
      };
      document.title = `${titles[route.name] || 'VidFast'} — VidFast`;
    }
  }, [route.name]);

  const openPlayer = useCallback(
    (item: SearchResult, opts: { progress?: WatchProgress; tab?: PlayerTab } = {}) => {
      const saved = continueWatchingList.find((cw) => cw.media.id === item.id && cw.media.media_type === item.media_type);
      setPlayer({ item, progress: opts.progress ?? saved?.progress, tab: opts.tab, key: Date.now() });
    },
    [continueWatchingList]
  );
  const playerApi = useMemo(() => ({ openPlayer }), [openPlayer]);

  const handleSearchChange = useCallback(
    (q: string) => {
      if (!q.trim()) {
        if (isSearching) navigate(lastBrowsePath.current, { replace: true });
        return;
      }
      navigate(`/search?q=${encodeURIComponent(q)}`, { replace: isSearching, keepScroll: isSearching });
    },
    [isSearching]
  );

  const handleNavigate = useCallback((view: string) => {
    setIsGuideClosing(false);
    navigate(NAV_PATHS[view] || '/');
  }, []);

  const closeGuide = useCallback(() => {
    if (isGuideClosing) return;
    setIsGuideClosing(true);
    window.setTimeout(() => {
      setIsGuideClosing(false);
      navigate('/');
    }, 500);
  }, [isGuideClosing]);

  const handleConfirmReset = () => {
    resetData();
    setIsResetModalOpen(false);
    setPlayer(null);
  };

  const renderPage = () => {
    switch (route.name) {
      case 'home':
        return <HomePage linkProps={linkProps} />;
      case 'movies':
        return <MoviesPage />;
      case 'tv':
        return <TvShowsPage />;
      case 'latest':
        return <LatestPage />;
      case 'my-list':
        return <MyListPage onBrowse={() => navigate('/')} />;
      case 'search':
        return <SearchResultsPage query={route.q} />;
      case 'title':
        return <TitlePage key={`${route.mediaType}-${route.id}`} mediaType={route.mediaType} id={route.id} autoPlay={route.play} />;
      case 'explore':
        return <ExplorePage />;
      case 'browse':
        return <BrowsePage search={route.search} />;
      case 'brands':
        return <BrandGridPage kind={route.kind} search={location.includes('?') ? location.slice(location.indexOf('?')) : ''} />;
      case 'company':
        return <CompanyPage brandKey={route.key} search={route.search} />;
      case 'provider':
        return <ProviderPage id={route.id} search={route.search} />;
      case 'franchise':
        return <FranchisePage id={route.id} />;
      case 'guide':
        return (
          <div className="px-[4%] pt-24 sm:pt-28">
            <HowToUseGuide onGoBack={closeGuide} isClosing={isGuideClosing} />
          </div>
        );
      default:
        return <NotFoundPage />;
    }
  };

  const pageKey =
    route.name === 'title'
      ? `title-${route.mediaType}-${route.id}`
      : route.name === 'company'
        ? `company-${route.key}`
        : route.name === 'provider'
          ? `provider-${route.id}`
          : route.name === 'franchise'
            ? `franchise-${route.id}`
            : route.name === 'brands'
              ? `brands-${route.kind}`
              : route.name;

  return (
    <PlayerContext.Provider value={playerApi}>
      <HoverPreviewProvider>
        <div className="min-h-screen bg-netflix-bg text-netflix-text [overflow-x:clip]">
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[80] focus:rounded focus:bg-white focus:px-4 focus:py-2 focus:font-bold focus:text-black"
          >
            Skip to content
          </a>

          <AppHeader
            view={viewOf(route)}
            isSearching={isSearching}
            searchQuery={searchQuery}
            onSearchChange={handleSearchChange}
            onNavigate={handleNavigate as any}
            onOpenGuide={() => navigate('/guide')}
            onImport={importList}
            onExport={exportList}
            onReset={() => setIsResetModalOpen(true)}
            onThemeSelect={() => setIsThemeModalOpen(true)}
          />

          <main id="main" key={pageKey} className="page-in min-h-[70vh] pb-6">
            {renderPage()}
          </main>

          <Footer onOpenGuide={() => navigate('/guide')} onThemeSelect={() => setIsThemeModalOpen(true)} onExport={exportList} onNavigate={handleNavigate as any} />

          {player && (
            <EmbedLinkModal
              key={player.key}
              item={player.item}
              onClose={() => setPlayer(null)}
              onUpdateFromLink={actuallyUpdateFromLink}
              initialProgress={player.progress}
              initialTab={player.tab}
            />
          )}

          <ConfirmationModal
            isOpen={confirmationState.isOpen}
            item={confirmationState.itemToAdd}
            progress={confirmationState.progressToAdd}
            episodeDetails={confirmationState.episodeDetails}
            onConfirm={confirmationState.onConfirm}
            onCancel={confirmationState.onCancel}
          />
          <ResetConfirmationModal isOpen={isResetModalOpen} onConfirm={handleConfirmReset} onCancel={() => setIsResetModalOpen(false)} />
          <ThemeModal isOpen={isThemeModalOpen} onClose={() => setIsThemeModalOpen(false)} />

          {showScrollToTop && !player && <ScrollToTopButton onClick={() => scrollToY(0, true)} />}
          <Toast message={feedbackMessage} />
        </div>
      </HoverPreviewProvider>
    </PlayerContext.Provider>
  );
};

export default App;
