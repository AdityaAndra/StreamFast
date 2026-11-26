import React, { useState } from 'react';
import { RowShell, LazyRow } from './ContentCarousel';
import SkeletonCarousel from './SkeletonCarousel';
import { Link, BrandKind } from '../utils/router';
import { usePerRow } from '../utils/artwork';
import { tmdbImage } from '../utils/media';
import { STUDIOS, PRODUCTION_HOUSES, FRANCHISE_IDS, franchiseLogo, getRegion, saveRegion, useCompanies, useCollections, useProviders, REGIONS } from '../utils/brands';
import type { RowDef } from '../utils/rows';

export interface Tile {
  key: string;
  to: string;
  label: string;
  img: string | null;
  /** Franchise tiles: the franchise's own title logo, shown instead of the name. */
  logo?: string | null;
  variant: 'light' | 'dark' | 'art';
}

export const BRAND_VIEW_ALL: Record<BrandKind, string> = {
  studios: '/studios',
  production: '/production-houses',
  providers: '/streaming',
  franchises: '/franchises',
};

export const BRAND_TITLES: Record<BrandKind, string> = {
  studios: 'Studios',
  production: 'Production Houses',
  providers: 'Streaming Services',
  franchises: 'Popular Franchises',
};

/** Builds the tiles for a brand row; undefined while loading. */
export const useBrandTiles = (kind: BrandKind, mediaType?: 'movie' | 'tv', regionOverride?: string): Tile[] | undefined => {
  const qs = mediaType ? `?type=${mediaType}` : '';
  const list = kind === 'studios' ? STUDIOS : kind === 'production' ? PRODUCTION_HOUSES : [];
  const companies = useCompanies(list.map((b) => b.logoId));
  const providers = useProviders(kind === 'providers' ? regionOverride || getRegion() : null);
  const collections = useCollections(kind === 'franchises' ? FRANCHISE_IDS : []);

  if (kind === 'studios' || kind === 'production') {
    if (!companies.data && !companies.error) return undefined;
    return list.map((b) => {
      const logo = companies.data?.[String(b.logoId)]?.logo;
      return { key: b.key, to: `/${kind === 'studios' ? 'studio' : 'production'}/${b.key}${qs}`, label: b.name, img: logo ? tmdbImage(logo, 'w300') : null, variant: 'light' };
    });
  }
  if (kind === 'providers') {
    if (!providers.data) return providers.error ? [] : undefined;
    const regionQs = regionOverride ? `region=${regionOverride}` : '';
    return providers.data.providers.map((p) => ({
      key: String(p.id),
      to: `/provider/${p.id}${qs || regionQs ? `?${[qs.slice(1), regionQs].filter(Boolean).join('&')}` : ''}`,
      label: p.name,
      img: p.logo ? tmdbImage(p.logo, 'w185') : null,
      variant: 'dark',
    }));
  }
  if (!collections.data) return collections.error ? [] : undefined;
  return FRANCHISE_IDS.flatMap((id) => {
    const info = collections.data?.[String(id)];
    if (!info || !info.backdrop) return [];
    return [{ key: String(id), to: `/franchise/${id}`, label: info.name.replace(/\s*(Collection|- Collection)$/i, ''), img: tmdbImage(info.backdrop, 'w780'), logo: franchiseLogo(id, 'w500'), variant: 'art' as const }];
  });
};

export const BrandTile: React.FC<{ tile: Tile }> = ({ tile }) => {
  const [loaded, setLoaded] = useState(false);
  const [logoState, setLogoState] = useState<'loading' | 'ok' | 'failed'>('loading');
  if (tile.variant === 'art') {
    return (
      <Link to={tile.to} aria-label={tile.label} className="nf-card group/card">
        {tile.img && <img src={tile.img} alt="" loading="lazy" decoding="async" onLoad={() => setLoaded(true)} className={`nf-art ${loaded ? 'is-loaded' : ''}`} />}
        <span className={`nf-card-shade ${tile.logo ? 'has-logo' : ''}`} />
        {tile.logo && logoState !== 'failed' ? (
          <img
            src={tile.logo}
            alt=""
            loading="lazy"
            decoding="async"
            onLoad={() => setLogoState('ok')}
            onError={() => setLogoState('failed')}
            className={`nf-franchise-logo ${logoState === 'ok' ? 'is-loaded' : ''}`}
          />
        ) : (
          <span className="nf-franchise-name">{tile.label}</span>
        )}
        <span className="nf-card-hover" />
      </Link>
    );
  }
  return (
    <Link to={tile.to} aria-label={tile.label} title={tile.label} className={`nf-brand hover:z-10 ${tile.variant === 'dark' ? 'is-dark' : ''}`}>
      {tile.img ? (
        <img src={tile.img} alt="" loading="lazy" decoding="async" onLoad={() => setLoaded(true)} className={loaded ? 'is-loaded' : ''} />
      ) : (
        <span className="nf-brand-name">{tile.label}</span>
      )}
      {tile.variant === 'dark' && <span className="nf-brand-caption">{tile.label}</span>}
    </Link>
  );
};

/** A Netflix row of brand tiles (logos) with "View all". */
export const BrandRow: React.FC<{ kind: BrandKind; title?: string; mediaType?: 'movie' | 'tv' }> = ({ kind, title, mediaType }) => {
  const tiles = useBrandTiles(kind, mediaType);
  const perRow = usePerRow();
  if (tiles === undefined) return <SkeletonCarousel />;
  if (!tiles.length) return null;
  return (
    <RowShell title={title || BRAND_TITLES[kind]} itemCount={tiles.length} perRow={kind === 'franchises' ? perRow : perRow + 1} viewAll={BRAND_VIEW_ALL[kind] + (mediaType ? `?type=${mediaType}` : '')}>
      {tiles.map((t) => (
        <div key={t.key} className="nf-item">
          <BrandTile tile={t} />
        </div>
      ))}
    </RowShell>
  );
};

/** Renders a page's row lineup: normal rows, Top 10s and brand rows. */
export const RowList: React.FC<{ rows: RowDef[]; eagerCount?: number }> = ({ rows, eagerCount = 2 }) => (
  <>
    {rows.map((def, i) =>
      def.kind === 'brands' && def.brand ? (
        <BrandRow key={def.id} kind={def.brand} title={def.title} mediaType={def.mediaType} />
      ) : (
        <LazyRow key={def.id} def={def} eager={i < eagerCount} />
      )
    )}
  </>
);

/** /studios, /production-houses, /streaming, /franchises */
export const BrandGridPage: React.FC<{ kind: BrandKind; search?: string }> = ({ kind, search = '' }) => {
  const mediaType = (new URLSearchParams(search).get('type') || undefined) as 'movie' | 'tv' | undefined;
  const [region, setRegion] = useState(getRegion());
  const tiles = useBrandTiles(kind, mediaType, kind === 'providers' ? region : undefined);

  return (
    <div className="px-[4%] pt-24 sm:pt-32">
      <div className="mb-[2vw] flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-[clamp(1.6rem,2.6vw,2.75rem)] font-bold tracking-[-0.02em] text-white">{BRAND_TITLES[kind]}</h1>
        {kind === 'providers' && (
          <select
            aria-label="Region"
            value={region}
            onChange={(e) => {
              saveRegion(e.target.value);
              setRegion(e.target.value);
            }}
            className="nf-select"
          >
            {REGIONS.map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        )}
      </div>
      <div className="grid grid-cols-2 gap-x-[0.6vw] gap-y-[1.2vw] sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 max-sm:gap-2">
        {tiles
          ? tiles.map((t) => <BrandTile key={t.key} tile={t} />)
          : Array.from({ length: 18 }).map((_, i) => <div key={i} className="nf-skel aspect-video w-full" style={{ ['--i' as any]: i % 6 }} />)}
      </div>
    </div>
  );
};
