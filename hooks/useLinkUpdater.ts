import { useRef, useState } from 'react';
import { getTvDetails, getMovieDetails, getSeasonDetails, getImages } from '../services/tmdb';
import type { SearchResult, WatchProgress, TVSearchResult, Episode } from '../types';
import { useAppContext } from '../contexts/AppContext';
import type { UpdateFromLinkProps } from '../components/UpdateFromLink';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/** Paste-a-VidFast-link logic: add a title to Continue Watching or update its progress. (Moved unchanged from App.tsx.) */
export function useLinkUpdater() {
  const { continueWatchingList, saveItem, setFeedback } = useAppContext();
  const [linkInputValue, setLinkInputValue] = useState('');
  const [linkUpdateStatus, setLinkUpdateStatus] = useState<'idle' | 'loading' | 'success'>('idle');
  const linkUpdateTimeoutRef = useRef<number | null>(null);
  const [isLinkFadingOut, setIsLinkFadingOut] = useState(false);

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


  const linkProps: Omit<UpdateFromLinkProps, 'variant'> = {
    value: linkInputValue,
    onChange: handleLinkInputChange,
    status: linkUpdateStatus,
    isFadingOut: isLinkFadingOut,
  };

  return { linkProps, actuallyUpdateFromLink, confirmationState };
}
