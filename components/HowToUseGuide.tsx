import React from 'react';
import { SearchIcon, PlayIcon, PlusIcon, BellIcon, PaletteIcon, ClockIcon } from './Icons';

interface HowToUseGuideProps {
    onGoBack: () => void;
    isClosing?: boolean;
}

const Key: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <kbd className="rounded border border-white/20 bg-neutral-800 px-1.5 py-0.5 text-[0.85em] font-semibold text-white">{children}</kbd>
);

const Section: React.FC<{ icon: React.ReactNode; title: string; children: React.ReactNode }> = ({ icon, title, children }) => (
    <section className="mb-8">
        <h3 className="mb-3 flex items-center text-xl font-bold text-white sm:text-2xl">
            <span className="mr-3 flex h-6 w-6 items-center justify-center text-netflix-red" aria-hidden="true">{icon}</span>
            {title}
        </h3>
        <div className="ml-0 space-y-2 leading-relaxed text-neutral-300 sm:ml-9">{children}</div>
    </section>
);

/** How to use StreamFast: what the site does today (browse, play in the site, keep your place, get notified). */
const HowToUseGuide: React.FC<HowToUseGuideProps> = ({ onGoBack, isClosing }) => {
    const animationClass = isClosing ? 'animate-genie-out' : 'animate-genie-in';

    return (
        <div className={'relative mx-auto my-6 max-w-6xl origin-[50%_-10rem] rounded-lg bg-neutral-900/50 p-4 sm:p-10 ' + animationClass}>
            <h2 className="mb-8 text-center text-3xl font-bold text-netflix-red sm:text-4xl">How to use StreamFast</h2>

            <Section icon={<SearchIcon className="h-6 w-6" />} title="1. Find something to watch">
                <p>
                    Browse the rows on Home, or use <strong className="text-white">Movies</strong>, <strong className="text-white">TV Shows</strong>,{' '}
                    <strong className="text-white">Categories</strong>, <strong className="text-white">New &amp; Popular</strong> and{' '}
                    <strong className="text-white">Browse by Languages</strong> in the top bar. Every row has a <strong className="text-white">View all</strong> page
                    with filters for genre, year, language, rating and more.
                </p>
                <p>
                    Click the search icon, or press <Key>/</Key> or <Key>Ctrl</Key> + <Key>K</Key>, and results appear as you type. Search finds movies, TV
                    shows and people: click an actor or director to see everything they have worked on.
                </p>
            </Section>

            <Section icon={<PlayIcon className="h-6 w-6" />} title="2. Watch right here">
                <p>
                    Click any title to open its page with the trailer, cast, episodes and similar titles, then press <strong className="text-white">Play</strong>.
                    Clicking a card's picture plays it straight away. Everything plays inside StreamFast, full screen.
                </p>
                <p>In the player:</p>
                <ul className="list-disc space-y-1 pl-5">
                    <li>
                        <Key>Space</Key> plays and pauses. Pause for a couple of seconds and you'll see what you're watching.
                    </li>
                    <li>
                        The <strong className="text-white">Episodes</strong> button (TV shows) lets you jump to any season or episode.
                    </li>
                    <li>
                        The <strong className="text-white">cloud</strong> button changes the server if a video won't load. Tap the star to make one your default.
                    </li>
                    <li>The back arrow takes you to the title's page, right where you were.</li>
                </ul>
            </Section>

            <Section icon={<ClockIcon className="h-6 w-6" />} title="3. Pick up where you left off">
                <p>
                    Your place is saved automatically while you watch. <strong className="text-white">Continue Watching</strong> on Home resumes from the same
                    minute, and for shows, the same episode.
                </p>
            </Section>

            <Section icon={<PlusIcon className="h-6 w-6" />} title="4. Save titles for later">
                <p>
                    Use <strong className="text-white">+ My List</strong> on any card or title page. Everything you saved and everything you're watching is on{' '}
                    <strong className="text-white">My Content</strong>.
                </p>
            </Section>

            <Section icon={<BellIcon className="h-6 w-6" />} title="5. Never miss a new episode">
                <p>
                    The bell shows new episodes and seasons of the shows you watch or saved, what's coming in the next two weeks, and new arrivals. Turn on{' '}
                    <strong className="text-white">desktop alerts</strong> at the bottom of the bell to be told when a new episode comes out while StreamFast is open.
                </p>
            </Section>

            <Section icon={<PaletteIcon className="h-6 w-6" />} title="6. Make it yours">
                <p>
                    Open the profile menu (top right) to change the <strong className="text-white">player theme</strong> colour, or to{' '}
                    <strong className="text-white">export</strong> and <strong className="text-white">import</strong> your history.
                </p>
                <p className="text-neutral-400">
                    Your lists are saved in this browser only. Export them to move them to another browser or device.
                </p>
            </Section>

            <div className="mt-10 text-center">
                <button
                    type="button"
                    onClick={onGoBack}
                    className="rounded-md bg-netflix-red px-8 py-3 text-lg font-bold text-white transition-colors hover:bg-netflix-red-dark"
                >
                    Got it
                </button>
            </div>
        </div>
    );
};

export default HowToUseGuide;
