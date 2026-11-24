import React from 'react';
import { Link } from '../utils/router';
import { tmdbImage } from '../utils/media';
import { personPath } from '../utils/person';
import { usePerRow } from '../utils/artwork';
import { RowShell } from './ContentCarousel';

export interface PersonTileData {
  id: number;
  name: string;
  profile_path: string | null;
  sub?: string;
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

/** Round headshot + name + role, links to the person's page. */
export const PersonTile: React.FC<{ p: PersonTileData }> = ({ p }) => (
  <Link to={personPath(p)} className="nf-person group/p" aria-label={p.sub ? `${p.name}, ${p.sub}` : p.name}>
    <span className="nf-person-img">
      {p.profile_path ? (
        <img src={tmdbImage(p.profile_path, 'w185') || ''} alt="" loading="lazy" decoding="async" />
      ) : (
        <span className="nf-person-initials">{initials(p.name)}</span>
      )}
    </span>
    <span className="nf-person-name">{p.name}</span>
    {p.sub && <span className="nf-person-sub">{p.sub}</span>}
  </Link>
);

/** A Netflix-style row of people (cast, crew, search results). */
const PeopleRow: React.FC<{ title: string; people: PersonTileData[] }> = ({ title, people }) => {
  const perRow = usePerRow();
  if (!people.length) return null;
  return (
    <RowShell title={title} itemCount={people.length} perRow={perRow + 3}>
      {people.map((p) => (
        <div key={`${p.id}-${p.sub || ''}`} className="nf-item">
          <PersonTile p={p} />
        </div>
      ))}
    </RowShell>
  );
};

export const PeopleGrid: React.FC<{ people: PersonTileData[] }> = ({ people }) => (
  <div className="grid grid-cols-3 gap-x-3 gap-y-6 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-9">
    {people.map((p) => (
      <PersonTile key={p.id} p={p} />
    ))}
  </div>
);

export default PeopleRow;
