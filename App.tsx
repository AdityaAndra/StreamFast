import React, { useState, useCallback, useRef, useEffect } from 'react';
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
import MyListPage from './pages/MyListPage';
import SearchResultsPage from './pages/SearchResultsPage';
import { searchMulti, getTvDetails, getMovieDetails, getSeasonDetails, getImages } from './services/tmdb';
import type { SearchResult, WatchProgressItem, WatchProgress, TVSearchResult, Episode } from './types';
import { useAppContext } from './contexts/AppContext';
import { saveRecentSearch } from './utils/recentSearches';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const App: React.FC = () => {
  const {
    continueWatchingList,
    feedbackMessage,
    saveItem,
    setFeedback,
    exportList,
    importList,
    resetData,
  } = useAppContext();

  const [view, setView] = useState<AppView>('home');
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchRetryKey, setSearchRetryKey] = useState(0);
  const [selectedItem, setSelectedItem] = useState<SearchResult | null>(null);
  const [selectedProgress, setSelectedProgress] = useState<WatchProgress | undefined>(undefined);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [linkInputValue, setLinkInputValue] = useState('');
  const [linkUpdateStatus, setLinkUpdateStatus] = useState<'idle' | 'loading' | 'success'>('idle');
  const linkUpdateTimeoutRef = useRef<number | null>(null);
  const [isLinkFadingOut, setIsLinkFadingOut] = useState(false);
  const [showScrollToTop, setShowScrollToTop] = useState(false);
  const [isThemeModalOpen, setIsThemeModalOpen] = useState(false);
  const [isGuideClosing, setIsGuideClosing] = useState(false);

  const [confirmationState, setConfirmationState] = useState<{
    isOpen: boolean;
    itemToAdd: SearchResult | null;
    progressToAdd: WatchProgress | null;
    episodeDetails: Episode | null;
    onConfirm: () => void;
    onCancel: () => void;
  }>({
    isOpen: false,
    itemToAdd: null,
    progressToAdd: null,
    episodeDetails: null,
    onConfirm: () => {},
    onCancel: () => {},
  });
  const abortControllerRef = useRef<AbortController | null>(null);

  const trimmedQuery = searchQuery.trim();
  const isSearching = trimmedQuery.length > 0;

  useEffect(() => {
    const handleScroll = () => setShowScrollToTop(window.scrollY > 600);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Live search (debounced) — results update as you type, like Netflix.
  useEffect(() => {
    abortControllerRef.current?.abort();

    if (!trimmedQuery) {
      setResults([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsLoading(true);
    setError(null);

    const timer = window.setTimeout(async () => {
      try {
        const searchResults = await searchMulti(trimmedQuery, controller.signal);
        if (!controller.signal.aborted) setResults(searchResults);
      } catch (err) {
        if (!controller.signal.aborted && !(err instanceof DOMException && err.name === 'AbortError')) {
          setError(err instanceof Error ? err.message : 'An unknown error occurred.');
          setResults([]);
        }
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }, 300);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [trimmedQuery, searchRetryKey]);

  // Jump to the top when a search starts so results are in view.
  const wasSearchingRef = useRef(false);
  useEffect(() => {
    if (isSearching && !wasSearchingRef.current) window.scrollTo({ top: 0 });
    wasSearchingRef.current = isSearching;
  }, [isSearching]);

  const handleSelectFromSearch = (item: SearchResult) => {
    if (trimmedQuery) saveRecentSearch(trimmedQuery);
    const continueWatchingItem = continueWatchingList.find(cw => cw.media.id === item.id && cw.media.media_type === item.media_type);
    setSelectedProgress(continueWatchingItem?.progress);
    setSelectedItem(item);
  };

  const handleSelectFromContinueWatching = (item: WatchProgressItem) => {
    setSelectedProgress(item.progress);
    setSelectedItem(item.media);
  };

  const handleCloseModal = () => {
    setSelectedItem(null);
    setSelectedProgress(undefined);
  };

  const handleCloseConfirmation = () => {
    setConfirmationState({ isOpen: false, itemToAdd: null, progressToAdd: null, episodeDetails: null, onConfirm: () => {}, onCancel: () => {} });
  };

  const fadeAndClearInput = async () => {
    const FADE_DURATION = 800; // Match the CSS animation duration
    setIsLinkFadingOut(true);
    await sleep(FADE_DURATION);
    setLinkInputValue('');
    setLinkUpdateStatus('idle');
    setIsLinkFadingOut(false);
  };

  const showSuccessAndClear = async (feedbackMessage: string) => {
    // 1. Show the success checkmark animation
    setLinkUpdateStatus('success');

    const CHECKMARK_ANIMATION_DURATION = 1100; // Corresponds to the CSS animation duration
    const FEEDBACK_DURATION = 5000; // Duration the feedback toast is visible
    const POST_ANIMATION_PAUSE = 200; // Small pause for visual separation

    // 2. Wait for the checkmark animation to complete
    await sleep(CHECKMARK_ANIMATION_DURATION);

    // 3. Hide the checkmark. The input remains populated.
    setLinkUpdateStatus('idle');

    // 4. Brief pause for visual separation before showing the feedback toast
    await sleep(POST_ANIMATION_PAUSE);

    // 5. Show the feedback message (toast).
    setFeedback(feedbackMessage);

    // 6. Wait for the feedback message to have been visible and then disappear.
    await sleep(FEEDBACK_DURATION);

    // 7. After the feedback has disappeared, start the fade-out of the input link and clear it.
    await fadeAndClearInput();
  };

  const handleLinkInputChange = (url: string) => {
    setLinkInputValue(url);
    if (isLinkFadingOut) setIsLinkFadingOut(false);
    setLinkUpdateStatus('idle');

    if (linkUpdateTimeoutRef.current) clearTimeout(linkUpdateTimeoutRef.current);

    const trimmedUrl = url.trim();
    if (!trimmedUrl) return;

    const validTvRegex = /vidfast\.pro\/tv\/\d+\/\d+\/\d+/;
    const movieRegex = /vidfast\.pro\/movie\/\d+/;
    const baseTvRegex = /vidfast\.pro\/tv\/\d+\/?($|\?.*)/;

    if (validTvRegex.test(trimmedUrl) || movieRegex.test(trimmedUrl) || baseTvRegex.test(trimmedUrl)) {
      linkUpdateTimeoutRef.current = window.setTimeout(() => {
        actuallyUpdateFromLink(trimmedUrl);
      }, 300);
    }
  };

  const actuallyUpdateFromLink = async (url: string) => {
    if (linkUpdateStatus === 'loading') return;
    setLinkUpdateStatus('loading');

    const tvRegex = /vidfast\.pro\/tv\/(\d+)\/(\d+)\/(\d+)/;
    const movieRegex = /vidfast\.pro\/movie\/(\d+)/;
    const baseTvRegex = /vidfast\.pro\/tv\/(\d+)\/?($|\?.*)/;

    const tvMatch = url.match(tvRegex);
    if (tvMatch) {
      const [, id, season, episode] = tvMatch;
      const mediaId = Number(id);
      const itemToUpdate = continueWatchingList.find(i => i.media.id === mediaId && i.media.media_type === 'tv');

      if (itemToUpdate && itemToUpdate.media.media_type === 'tv') {
        const newProgress = { season: Number(season), episode: Number(episode) };
        saveItem(itemToUpdate.media, newProgress, itemToUpdate.cleanPosterPath || itemToUpdate.media.poster_path);
        showSuccessAndClear(`'${itemToUpdate.media.name}' progress updated to S${newProgress.season} E${newProgress.episode}.`);
      } else {
        try {
          const tvDetails = await getTvDetails(mediaId);
          const seasonDetails = await getSeasonDetails(mediaId, Number(season));
          const episodeDetails = seasonDetails.episodes.find(ep => ep.episode_number === Number(episode));

          const images = await getImages(mediaId, 'tv');
          const textlessPoster = images.posters.find(p => p.iso_639_1 === null);
          const posterToSave = textlessPoster?.file_path || images.posters[0]?.file_path || tvDetails.poster_path;

          const newProgress = { season: Number(season), episode: Number(episode) };

          const newItem: TVSearchResult = {
            id: tvDetails.id,
            name: tvDetails.name,
            original_name: tvDetails.original_name,
            media_type: 'tv',
            poster_path: tvDetails.poster_path,
            overview: tvDetails.overview,
            popularity: tvDetails.popularity,
            backdrop_path: tvDetails.backdrop_path,
            first_air_date: tvDetails.first_air_date,
          };

          setLinkUpdateStatus('idle'); // Stop loading, keep text in box for confirmation
          setConfirmationState({
            isOpen: true,
            itemToAdd: newItem,
            progressToAdd: newProgress,
            episodeDetails: episodeDetails || null,
            onConfirm: () => {
              saveItem(newItem, newProgress, posterToSave);
              handleCloseConfirmation();
              showSuccessAndClear(`Added '${tvDetails.name}' to Continue Watching.`);
            },
            onCancel: () => {
              handleCloseConfirmation();
              fadeAndClearInput();
            }
          });
        } catch (err) {
          console.error(err);
          setFeedback("Could not find details for the TV show in the link.");
          setLinkUpdateStatus('idle');
        }
      }
      return;
    }

    const movieMatch = url.match(movieRegex);
    if (movieMatch) {
      const [, id] = movieMatch;
      const mediaId = Number(id);
      const itemToUpdate = continueWatchingList.find(i => i.media.id === mediaId && i.media.media_type === 'movie');

      if (itemToUpdate && itemToUpdate.media.media_type === 'movie') {
        saveItem(itemToUpdate.media, {}, itemToUpdate.cleanPosterPath || itemToUpdate.media.poster_path); // Resaves to update timestamp
        showSuccessAndClear(`'${itemToUpdate.media.title}' has been moved to the front of your list.`);
      } else {
        try {
          const movieDetails = await getMovieDetails(mediaId);
          const images = await getImages(mediaId, 'movie');
          const textlessPoster = images.posters.find(p => p.iso_639_1 === null);
          const posterToSave = textlessPoster?.file_path || images.posters[0]?.file_path || movieDetails.poster_path;

          setLinkUpdateStatus('idle'); // Stop loading, keep text in box for confirmation
          setConfirmationState({
            isOpen: true,
            itemToAdd: movieDetails,
            progressToAdd: {},
            episodeDetails: null,
            onConfirm: () => {
              saveItem(movieDetails, {}, posterToSave);
              handleCloseConfirmation();
              showSuccessAndClear(`Added '${movieDetails.title}' to Continue Watching.`);
            },
            onCancel: () => {
              handleCloseConfirmation();
              fadeAndClearInput();
            }
          });
        } catch (err) {
          console.error(err);
          setFeedback("Could not find details for the movie in the link.");
          setLinkUpdateStatus('idle');
        }
      }
      return;
    }

    const baseTvMatch = url.match(baseTvRegex);
    if (baseTvMatch) {
      const [, id] = baseTvMatch;
      const mediaId = Number(id);
      try {
        const tvDetails = await getTvDetails(mediaId);
        setFeedback(`The link you pasted is for '${tvDetails.name}' but is missing the Season and Episode. Please paste a valid link with Season and Episode to add.`);
      } catch (err) {
        console.error("Failed to fetch TV details for base link", err);
        setFeedback("The pasted TV show link is invalid or the show could not be found.");
      }
      setLinkUpdateStatus('idle');
      return;
    }

    setFeedback('Invalid or unrecognized VidFast link format.');
    setLinkUpdateStatus('idle');
  };

  const handleNavigate = useCallback((next: 'home' | 'movies' | 'tv-shows' | 'my-list') => {
    setSearchQuery('');
    setIsGuideClosing(false);
    setView(next);
    window.scrollTo({ top: 0 });
  }, []);

  const handleOpenGuide = useCallback(() => {
    setSearchQuery('');
    setView('how-to-use');
    window.scrollTo({ top: 0 });
  }, []);

  const closeGuideWithAnimation = useCallback(() => {
    if (isGuideClosing) return; // Prevent re-trigger
    setIsGuideClosing(true);
    setTimeout(() => {
      setSelectedItem(null);
      setView('home');
      setIsGuideClosing(false);
      window.scrollTo({ top: 0 });
    }, 500); // Animation duration
  }, [isGuideClosing]);

  const handleReset = () => {
    setIsResetModalOpen(true);
  };

  const handleConfirmReset = () => {
    resetData();
    setIsResetModalOpen(false);
    setSearchQuery('');
    setResults([]);
    setError(null);
    setSelectedItem(null);
  };

  const handleScrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const renderContent = () => {
    if (isSearching) {
      return (
        <SearchResultsPage
          query={trimmedQuery}
          results={results}
          isLoading={isLoading}
          error={error}
          onSelect={handleSelectFromSearch}
          onRetry={() => setSearchRetryKey(k => k + 1)}
        />
      );
    }

    switch (view) {
      case 'movies':
        return <MoviesPage onSelect={handleSelectFromSearch} />;
      case 'tv-shows':
        return <TvShowsPage onSelect={handleSelectFromSearch} />;
      case 'my-list':
        return <MyListPage onSelect={handleSelectFromSearch} onBrowse={() => handleNavigate('home')} />;
      case 'how-to-use':
        return (
          <div className="px-[4%] pt-24 sm:pt-28">
            <HowToUseGuide onGoBack={closeGuideWithAnimation} isClosing={isGuideClosing} />
          </div>
        );
      case 'home':
      default:
        return (
          <HomePage
            onSelect={handleSelectFromSearch}
            onSelectFromContinueWatching={handleSelectFromContinueWatching}
            linkProps={{
              value: linkInputValue,
              onChange: handleLinkInputChange,
              status: linkUpdateStatus,
              isFadingOut: isLinkFadingOut,
            }}
          />
        );
    }
  };

  return (
    <HoverPreviewProvider>
      <div className="min-h-screen overflow-x-hidden bg-netflix-bg text-netflix-text">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[80] focus:rounded focus:bg-white focus:px-4 focus:py-2 focus:font-bold focus:text-black"
        >
          Skip to content
        </a>

        <AppHeader
          view={view}
          isSearching={isSearching}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onNavigate={handleNavigate}
          onOpenGuide={handleOpenGuide}
          onImport={importList}
          onExport={exportList}
          onReset={handleReset}
          onThemeSelect={() => setIsThemeModalOpen(true)}
        />

        <main id="main" key={isSearching ? 'search' : view} className="page-in min-h-[70vh] pb-8">
          {renderContent()}
        </main>

        <Footer
          onOpenGuide={handleOpenGuide}
          onThemeSelect={() => setIsThemeModalOpen(true)}
          onExport={exportList}
          onNavigate={handleNavigate}
        />

        {selectedItem && (
          <EmbedLinkModal
            item={selectedItem}
            onClose={handleCloseModal}
            onUpdateFromLink={actuallyUpdateFromLink}
            initialProgress={selectedProgress}
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

        <ResetConfirmationModal
          isOpen={isResetModalOpen}
          onConfirm={handleConfirmReset}
          onCancel={() => setIsResetModalOpen(false)}
        />

        <ThemeModal
          isOpen={isThemeModalOpen}
          onClose={() => setIsThemeModalOpen(false)}
        />

        {showScrollToTop && !selectedItem && <ScrollToTopButton onClick={handleScrollToTop} />}

        <Toast message={feedbackMessage} />
      </div>
    </HoverPreviewProvider>
  );
};

export default App;
