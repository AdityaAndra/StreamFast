import React from 'react';
import type { SearchResult } from '../types';
import { useAppContext } from '../contexts/AppContext';
import ResultsGrid from '../components/ResultsGrid';
import { PlusIcon } from '../components/Icons';

interface MyListPageProps {
    onSelect: (item: SearchResult) => void;
    onBrowse: () => void;
}

const MyListPage: React.FC<MyListPageProps> = ({ onSelect, onBrowse }) => {
    const { myList, toggleMyListItem } = useAppContext();

    return (
        <div className="px-[4%] pt-24 sm:pt-32">
            <h1 className="mb-6 text-2xl font-bold text-white sm:mb-8 sm:text-4xl">My List</h1>

            {myList.length > 0 ? (
                <ResultsGrid results={myList.map((i) => i.media)} onSelect={onSelect} onRemove={toggleMyListItem} />
            ) : (
                <div className="flex flex-col items-center py-20 text-center animate-fade-in">
                    <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full border-2 border-[#808080] text-[#808080]">
                        <PlusIcon className="h-8 w-8" />
                    </div>
                    <p className="mb-2 text-xl font-bold text-white">Your list is empty</p>
                    <p className="mb-7 max-w-sm text-netflix-muted">
                        Add movies and shows with the + button so you can easily find them later.
                    </p>
                    <button
                        type="button"
                        onClick={onBrowse}
                        className="rounded-[4px] bg-white px-7 py-2.5 font-bold text-black transition-colors hover:bg-white/75 active:scale-[0.97]"
                    >
                        Browse titles
                    </button>
                </div>
            )}
        </div>
    );
};

export default MyListPage;
