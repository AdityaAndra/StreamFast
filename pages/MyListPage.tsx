import React from 'react';
import { useAppContext } from '../contexts/AppContext';
import ResultsGrid from '../components/ResultsGrid';
import { PlusIcon } from '../components/Icons';

const MyListPage: React.FC<{ onBrowse: () => void }> = ({ onBrowse }) => {
  const { myList, toggleMyListItem } = useAppContext();

  return (
    <div className="px-[4%] pt-24 sm:pt-32">
      <h1 className="mb-[2vw] text-[clamp(1.6rem,2.6vw,2.75rem)] font-bold tracking-[-0.02em] text-white">My List</h1>
      {myList.length > 0 ? (
        <ResultsGrid results={myList.map((i) => i.media)} onRemove={toggleMyListItem} />
      ) : (
        <div className="flex flex-col items-center py-20 text-center animate-fade-in">
          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full border-2 border-[#808080] text-[#808080]">
            <PlusIcon className="h-8 w-8" />
          </div>
          <p className="mb-2 text-xl font-bold text-white">Your list is empty</p>
          <p className="mb-7 max-w-sm text-netflix-muted">Add movies and shows with the + button so you can easily find them later.</p>
          <button type="button" onClick={onBrowse} className="nf-btn nf-btn-white">Browse titles</button>
        </div>
      )}
    </div>
  );
};

export default MyListPage;
