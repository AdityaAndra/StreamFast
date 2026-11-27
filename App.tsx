import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import EmbedLinkModal from './components/EmbedLinkModal';
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
import MyContentPage from './pages/MyContentPage';
import LanguagesPage from './pages/LanguagesPage';
import SearchResultsPage from './pages/SearchResultsPage';
import TitlePage from './pages/TitlePage';
import NotFoundPage from './pages/NotFoundPage';
import ExplorePage from './pages/ExplorePage';
import FranchisePage from './pages/FranchisePage';
import PersonPage from './pages/PersonPage';
import WatchPage from './pages/WatchPage';
import LoginPage from './pages/LoginPage';
import SignUpPage from './pages/SignUpPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import { watchPath } from './utils/media';
import { BrowsePage, CompanyPage, ProviderPage } from './pages/BrowsePage';
import { BrandGridPage } from './components/BrandRow';
import { initSmoothScroll, pauseScroll, resumeScroll, scrollToY } from './utils/smoothScroll';
import type { SearchResult, WatchProgress } from './types';
import { useAppContext } from './contexts/AppContext';
import { useAuth } from './contexts/AuthContext';
import { PlayerContext, PlayerTab } from './contexts/PlayerContext';
import { consumeScrollRestore, navigate, Route, useLocationString, useRoute, titleBackground, closeTitleWindow, parseRoute, AUTH_ROUTES } from './utils/router';

const NAV_PATHS: Record<string, string> = {
  home: '/',
  'tv-shows': '/tv',
  movies: '/movies',
  latest: '/latest',
  explore: '/categories',
  'my-list': '/my-content',
  languages: '/languages',
};

const viewOf = (route: Route): AppView => {
  switch (route.name) {
    case 'home': return 'home';
    case 'tv': return 'tv-shows';
    case 'movies': return 'movies';
    case 'latest': return 'latest';
    case 'explore': case 'browse': case 'brands': case 'company': case 'provider': case 'franchise': return 'explore';
    case 'my-list': return 'my-list';
    case 'languages': return 'languages';
    case 'title': return 'title';
    default: return 'other';
  }
};

const App: React.FC = () => {
  const { continueWatchingList, feedbackMessage, exportList, importList, resetData } = useAppContext();
  // Without the Supabase settings the account pages don't exist (they show "Page not found", as before).
  const { enabled: accountsEnabled } = useAuth();
  const route = useRoute();
  const location = useLocationString();
  // A title opens as a window over the page you came from; that page keeps rendering behind it.
  const isTitle = route.name === 'title';
  const bgLocation = isTitle ? titleBackground() : location;
  const bgRoute = useMemo<Route>(() => {
    if (!isTitle) return route;
    const r = parseRoute(bgLocation);
    return r.name === 'title' || r.name === 'watch' ? { name: 'home' } : r;
  }, [isTitle, route, bgLocation]);

  const [player, setPlayer] = useState<{ item: SearchResult; progress?: WatchProgress; tab?: PlayerTab; key: number } | null>(null);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [isThemeModalOpen, setIsThemeModalOpen] = useState(false);
  const [showScrollToTop, setShowScrollToTop] = useState(false);
  const lastBrowsePath = useRef('/');

  const isSearching = bgRoute.name === 'search';
  const searchQuery = bgRoute.name === 'search' ? bgRoute.q : '';

  useEffect(() => {
    initSmoothScroll();
  }, []);

  // Freeze the page behind any open dialog.
  const anyModal = isTitle || !!player || isThemeModalOpen || isResetModalOpen;
  useEffect(() => {
    if (!anyModal) return;
    pauseScroll();
    return resumeScroll;
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
    let last = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        // Only touch App state (which re-renders the whole page) when the button really appears/disappears.
        const next = window.scrollY > 900;
        if (next === last) return;
        last = next;
        setShowScrollToTop(next);
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!['title', 'company', 'provider', 'franchise', 'person', 'watch'].includes(route.name)) {
      const titles: Partial<Record<Route['name'], string>> = {
        home: 'Home', movies: 'Movies', tv: 'TV Shows', latest: 'New & Popular', 'my-list': 'My Content', search: 'Search', explore: 'Categories', languages: 'Browse by Languages', browse: 'Browse', brands: 'Browse', 'not-found': 'Page not found',
        login: 'Sign In', signup: 'Sign Up', 'forgot-password': 'Forgot password', 'reset-password': 'Reset password',
      };
      const name = !accountsEnabled && AUTH_ROUTES.includes(route.name) ? 'not-found' : route.name;
      document.title = `${titles[name] || 'StreamFast'} — StreamFast`;
    }
  }, [route.name, accountsEnabled]);

  const openPlayer = useCallback(
    (item: SearchResult, opts: { progress?: WatchProgress; tab?: PlayerTab } = {}) => {
      const saved = continueWatchingList.find((cw) => cw.media.id === item.id && cw.media.media_type === item.media_type);
      const progress = opts.progress ?? saved?.progress;
      // "Play" opens the in-site player page (like Netflix); other tabs ("Get Link", episodes) open the link panel.
      if (opts.tab === 'watch') {
        navigate(watchPath(item, progress));
        return;
      }
      setPlayer({ item, progress, tab: opts.tab, key: Date.now() });
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
    navigate(NAV_PATHS[view] || '/');
  }, []);

  const handleConfirmReset = () => {
    resetData();
    setIsResetModalOpen(false);
    setPlayer(null);
  };

  const renderPage = (route: Route, location: string) => {
    switch (route.name) {
      case 'home':
        return <HomePage />;
      case 'movies':
        return <MoviesPage />;
      case 'tv':
        return <TvShowsPage />;
      case 'latest':
        return <LatestPage />;
      case 'my-list':
        return <MyContentPage onBrowse={() => navigate('/')} onThemeSelect={() => setIsThemeModalOpen(true)} onExport={exportList} />;
      case 'languages':
        return <LanguagesPage search={route.search} />;
      case 'search':
        return <SearchResultsPage query={route.q} />;
      case 'title':
        return null; // titles render as a window over the page behind (see below)
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
        // key: moving to another franchise starts fresh (no sort / genre / search left over).
        return <FranchisePage key={route.id} id={route.id} />;
      case 'watch':
        return <WatchPage mediaType={route.mediaType} id={route.id} season={route.season} episode={route.episode} startAt={route.t} />;
      case 'person':
        return <PersonPage key={route.id} id={route.id} />;
      case 'login':
        return accountsEnabled ? <LoginPage next={route.next} /> : <NotFoundPage />;
      case 'signup':
        return accountsEnabled ? <SignUpPage next={route.next} /> : <NotFoundPage />;
      case 'forgot-password':
        return accountsEnabled ? <ForgotPasswordPage /> : <NotFoundPage />;
      case 'reset-password':
        return accountsEnabled ? <ResetPasswordPage /> : <NotFoundPage />;
      default:
        return <NotFoundPage />;
    }
  };

  const isWatch = route.name === 'watch';
  const pageKey =
    bgRoute.name === 'watch'
      ? `watch-${bgRoute.mediaType}-${bgRoute.id}`
      : bgRoute.name === 'title'
      ? `title-${bgRoute.mediaType}-${bgRoute.id}`
      : bgRoute.name === 'company'
        ? `company-${bgRoute.key}`
        : bgRoute.name === 'provider'
          ? `provider-${bgRoute.id}`
          : bgRoute.name === 'franchise' || bgRoute.name === 'person'
            ? `${bgRoute.name}-${bgRoute.id}`
            : bgRoute.name === 'brands'
              ? `brands-${bgRoute.kind}`
              : bgRoute.name;

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

          {!isWatch && (
          <AppHeader
            view={viewOf(bgRoute)}
            isSearching={isSearching}
            searchQuery={searchQuery}
            onSearchChange={handleSearchChange}
            onNavigate={handleNavigate as any}
            onImport={importList}
            onExport={exportList}
            onReset={() => setIsResetModalOpen(true)}
            onThemeSelect={() => setIsThemeModalOpen(true)}
            overHero={['home', 'movies', 'tv', 'franchise', 'person'].includes(bgRoute.name)}
          />
          )}

          <main id="main" key={pageKey} className={isWatch ? '' : 'page-in min-h-[70vh] pb-6'}>
            {renderPage(bgRoute, bgLocation)}
          </main>

          {route.name === 'title' && <TitlePage mediaType={route.mediaType} id={route.id} autoPlay={route.play} onClose={closeTitleWindow} />}

          {!isWatch && <Footer onThemeSelect={() => setIsThemeModalOpen(true)} onExport={exportList} onNavigate={handleNavigate as any} />}

          {player && (
            <EmbedLinkModal
              key={player.key}
              item={player.item}
              onClose={() => setPlayer(null)}
              initialProgress={player.progress}
              initialTab={player.tab}
            />
          )}

          <ResetConfirmationModal isOpen={isResetModalOpen} onConfirm={handleConfirmReset} onCancel={() => setIsResetModalOpen(false)} />
          <ThemeModal isOpen={isThemeModalOpen} onClose={() => setIsThemeModalOpen(false)} />

          {showScrollToTop && !player && !isWatch && !isTitle && <ScrollToTopButton onClick={() => scrollToY(0, true)} />}
          <Toast message={feedbackMessage} />
        </div>
      </HoverPreviewProvider>
    </PlayerContext.Provider>
  );
};

export default App;
