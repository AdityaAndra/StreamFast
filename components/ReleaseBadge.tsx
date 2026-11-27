import React from 'react';
import type { SearchResult } from '../types';
import { comingLabel, dateParts, hdDate, nextRelease, releaseLabel, useRelease } from '../utils/release';

/**
 * The small quality pill on popups and title pages: "HD" once a title is out digitally anywhere,
 * "CAM" (same look) while only cinema recordings exist, and its next date before it comes out.
 * hd = also say when a CAM title comes out in HD, once that date is known.
 */
export const QualityPill: React.FC<{ item: SearchResult; className: string; hd?: 'long' | 'short' }> = ({ item, className, hd }) => {
  const release = useRelease(item);
  if (release === 'soon') return <span className={className}>{comingLabel(item)}</span>;
  if (release === 'cam') {
    const d = hdDate(item);
    return (
      <>
        <span className={className}>
          CAM<span className="sr-only"> (cinema recording, not out in HD yet)</span>
        </span>
        {hd && d && <span className="whitespace-nowrap font-semibold text-white">{hd === 'long' ? `4K/HD available on ${dateParts(d).text}` : `HD ${dateParts(d).text}`}</span>}
      </>
    );
  }
  return <span className={className}>HD</span>;
};

/* Flag icons: ticket = in cinemas, screen = digital, camera = CAM. */
const Ticket = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 7h18v3a2 2 0 0 0 0 4v3H3v-3a2 2 0 0 0 0-4z" />
    <path d="M14 7v10" strokeDasharray="2 2.2" />
  </svg>
);
const Screen = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="5" width="18" height="12" rx="2" />
    <path d="M8 21h8M12 17v4" />
  </svg>
);
const Camera = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" aria-hidden="true">
    <rect x="2" y="7" width="13" height="10" rx="2" />
    <path d="M15 11l6-3v8l-6-3z" />
  </svg>
);

const DayMonth: React.FC<{ iso: string }> = ({ iso }) => {
  const p = dateParts(iso);
  return (
    <>
      <b>{p.day}</b>
      <small>
        {p.mon}
        {p.year ? ` \u2019${p.year.slice(2)}` : ''}
      </small>
    </>
  );
};

/**
 * Flags hanging from the top-right of a card, the same shape as the TOP 10 flag:
 *  white + ticket = in cinemas on that date, grey + screen = out digitally on that date (coming soon),
 *  red + camera = CAM, black "HD" = the date a CAM title comes out in 4K/HD.
 * Nothing for titles that are out in HD.
 */
export const ReleaseFlags: React.FC<{ item: SearchResult }> = ({ item }) => {
  const release = useRelease(item);
  if (!release || release === 'hd') return null;
  const label = releaseLabel(item);
  if (release === 'soon') {
    const n = nextRelease(item);
    const digital = n?.kind === 'digital' || n?.kind === 'premiere';
    return (
      <span className="nf-flags" role="img" aria-label={label}>
        <span className={`nf-flag ${digital ? 'is-digital' : 'is-cinema'}`}>
          {digital ? <Screen /> : <Ticket />}
          {n ? <DayMonth iso={n.iso} /> : <b className="is-word">SOON</b>}
        </span>
      </span>
    );
  }
  const d = hdDate(item);
  return (
    <span className="nf-flags" role="img" aria-label={label}>
      <span className="nf-flag is-cam">
        <Camera />
        <b className="is-word">CAM</b>
      </span>
      {d && (
        <span className="nf-flag is-hd">
          <i>HD</i>
          <DayMonth iso={d} />
        </span>
      )}
    </span>
  );
};
