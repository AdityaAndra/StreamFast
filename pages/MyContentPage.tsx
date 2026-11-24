import React from 'react';
import { useAppContext } from '../contexts/AppContext';
import ContinueWatchingGrid from '../components/ContinueWatchingGrid';
import ResultsGrid from '../components/ResultsGrid';
import { PlusIcon, PaletteIcon, DownloadIcon } from '../components/Icons';

interface MyContentPageProps {
  onBrowse: () => void;
  onThemeSelect?: () => void;
  onExport?: () => void;
}

/** Netflix "My Netflix": Continue Watching, My List and your saved data in one place. */
const MyContentPage: React.FC<MyContentPageProps> = ({ onBrowse, onThemeSelect, onExport }) => {
  const { myList, toggleMyListItem, continueWatchingList } = useAppContext();
  const empty = myList.length === 0 && continueWatchingList.length === 0;

  return (
    <div className="pt-24 sm:pt-32">
      <div className="mb-[2vw] flex flex-wrap items-end justify-between gap-4 px-[4%]">
        <div>
          <h1 className="text-[clamp(1.6rem,2.6vw,2.75rem)] font-bold tracking-[-0.02em] text-white">My Content</h1>
          <p className="mt-1 text-[max(14px,1vw)] text-netflix-muted">
            {continueWatchingList.length} in Continue Watching · {myList.length} in My List
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {onThemeSelect && (
            <button type="button" onClick={onThemeSelect} className="nf-btn nf-btn-grey !px-4 !py-2 !text-sm">
              <PaletteIcon />
              Player theme
            </button>
          )}
          {onExport && (
            <button type="button" onClick={onExport} className="nf-btn nf-btn-grey !px-4 !py-2 !text-sm">
              <DownloadIcon />
              Export history
            </button>
          )}
        </div>
      </div>

      <ContinueWatchingGrid />

      <section className="px-[4%]" aria-labelledby="my-list-heading">
        <h2 id="my-list-heading" className="nf-row-title mb-[0.8vw] !px-0">My List</h2>
        {myList.length > 0 ? (
          <ResultsGrid results={myList.map((i) => i.media)} onRemove={toggleMyListItem} />
        ) : (
          <div className="flex flex-col items-center py-16 text-center animate-fade-in">
            <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full border-2 border-[#808080] text-[#808080]">
              <PlusIcon className="h-8 w-8" />
            </div>
            <p className="mb-2 text-xl font-bold text-white">{empty ? 'Nothing saved yet' : 'Your list is empty'}</p>
            <p className="mb-7 max-w-sm text-netflix-muted">Add movies and shows with the + button so you can easily find them later.</p>
            <button type="button" onClick={onBrowse} className="nf-btn nf-btn-white">Browse titles</button>
          </div>
        )}
      </section>
    </div>
  );
};

export default MyContentPage;
