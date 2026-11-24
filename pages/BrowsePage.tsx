import React, { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SearchResult } from '../types';
import FilterBar from '../components/FilterBar';
import ResultsGrid from '../components/ResultsGrid';
import SkeletonGrid from '../components/SkeletonGrid';
import ErrorState from '../components/ErrorState';
import { BrowseParams, describe, fetchBrowsePage, parseBrowse, toQuery } from '../utils/browse';
import { loadCached } from '../utils/useCachedData';
import { navigate } from '../utils/router';
import { scrollToY } from '../utils/smoothScroll';
import { getTitle, tmdbImage } from '../utils/media';
import { findBrand, getRegion, regionName, useCompanies, useProviders } from '../utils/brands';
import NotFoundPage from './NotFoundPage';

interface Loaded {
  items: SearchResult[];
  page: number;
  total: number;
}

/** Remembers loaded pages so Back returns to the same spot instantly. */
const stateCache = new Map<string, Loaded>();
const EMPTY: Loaded = { items: [], page: 0, total: 1 };

interface BrowseViewProps {
  search: string;
  base?: Partial<BrowseParams>;
  locked?: (keyof BrowseParams)[];
  /** Hidden from the filter bar but still kept in the URL. */
  hideFilters?: (keyof BrowseParams)[];
  resetQuery?: string;
  header?: ReactNode;
}

export const BrowseView: React.FC<BrowseViewProps> = ({ search, base, locked = [], hideFilters = [], resetQuery = '', header }) => {
  const urlParams = useMemo(() => parseBrowse(search), [search]);
  const baseKey = JSON.stringify(base || {});
  const params = useMemo<BrowseParams>(() => ({ ...urlParams, ...(base || {}) }), [urlParams, baseKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const fetchKey = useMemo(() => JSON.stringify({ ...params, q: undefined, title: undefined }), [params]);

  const [state, setState] = useState<Loaded>(() => stateCache.get(fetchKey) || EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const live = useRef({ key: fetchKey, state, loading: false, params });
  live.current.params = params;
  const sentinel = useRef<HTMLDivElement>(null);

  const loadPage = useCallback(async (n: number) => {
    const key = live.current.key;
    if (live.current.loading) return;
    live.current.loading = true;
    setLoading(true);
    try {
      const res = await loadCached(`browse:${key}:${n}`, () => fetchBrowsePage(live.current.params, n));
      if (live.current.key !== key) return;
      const prev = n === 1 ? [] : live.current.state.items;
      const seen = new Set(prev.map((i) => `${i.media_type}-${i.id}`));
      const fresh = res.results.filter((i) => {
        const k = `${i.media_type}-${i.id}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
      const next = { items: [...prev, ...fresh], page: n, total: res.totalPages };
      live.current.state = next;
      stateCache.set(key, next);
      setState(next);
      setError(null);
    } catch {
      if (live.current.key === key) setError("We couldn't load these titles. Check your connection and try again.");
    } finally {
      if (live.current.key === key) {
        live.current.loading = false;
        setLoading(false);
      }
    }
  }, []);

  // New filter combination: restore from cache or start from page 1.
  useEffect(() => {
    live.current.key = fetchKey;
    live.current.loading = false;
    const cached = stateCache.get(fetchKey);
    live.current.state = cached || EMPTY;
    setState(cached || EMPTY);
    setError(null);
    setLoading(false);
    if (!cached) loadPage(1);
  }, [fetchKey, loadPage]);

  const q = (params.q || '').trim().toLowerCase();
  const visible = useMemo(() => (q ? state.items.filter((i) => getTitle(i).toLowerCase().includes(q)) : state.items), [state.items, q]);
  const canLoadMore = state.page > 0 && state.page < state.total && !error;

  const loadMore = useCallback(() => {
    const s = live.current.state;
    if (!live.current.loading && s.page > 0 && s.page < s.total) loadPage(s.page + 1);
  }, [loadPage]);

  // Infinite scroll
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !canLoadMore) return;
    const io = new IntersectionObserver((entries) => entries[0].isIntersecting && loadMore(), { rootMargin: '1400px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [canLoadMore, loadMore, state.page]);

  // Keep filling while the sentinel is still on screen, or while searching inside the list.
  useEffect(() => {
    if (loading || !canLoadMore) return;
    const el = sentinel.current;
    const nearBottom = el && el.getBoundingClientRect().top < window.innerHeight + 1400;
    const searchingNeedsMore = q && visible.length < 24 && state.page < 25;
    if (nearBottom || searchingNeedsMore) loadMore();
  }, [loading, canLoadMore, q, visible.length, state.page, loadMore]);

  const update = (patch: Partial<BrowseParams>) => {
    const next = { ...urlParams, ...patch } as BrowseParams;
    if (Object.keys(patch).some((k) => !['q', 'sort', 'window', 'region'].includes(k))) delete next.title;
    navigate(`${window.location.pathname}${toQuery(next, locked)}`, { replace: true, keepScroll: true });
    if (!('q' in patch) && window.scrollY > 320) scrollToY(0, true);
  };
  const reset = () =>
    navigate(window.location.pathname + (resetQuery || (params.region && locked.includes('provider') ? `?region=${params.region}` : '')), { replace: true, keepScroll: true });

  const initialLoading = state.page === 0 && !error;

  return (
    <div className="px-[4%] pt-24 sm:pt-28">
      {header ?? <h1 className="mb-[1.6vw] text-[clamp(1.6rem,2.6vw,2.75rem)] font-bold tracking-[-0.02em] text-white">{describe(params)}</h1>}
      <FilterBar params={params} onChange={update} onReset={reset} locked={[...locked, ...hideFilters]} />

      {error && state.items.length === 0 ? (
        <ErrorState message={error} onRetry={() => loadPage(1)} />
      ) : initialLoading ? (
        <SkeletonGrid />
      ) : visible.length > 0 ? (
        <ResultsGrid results={visible} />
      ) : !loading ? (
        <div className="py-16 text-center animate-fade-in">
          <p className="mb-2 text-lg text-white">{q ? `No titles match "${params.q}" here yet.` : 'No titles match these filters.'}</p>
          <p className="mb-6 text-netflix-muted">Try a different genre, year or service.</p>
          <button type="button" onClick={reset} className="nf-btn nf-btn-white">Clear filters</button>
        </div>
      ) : null}

      {loading && state.items.length > 0 && (
        <div className="mt-[3vw]">
          <SkeletonGrid count={6} />
        </div>
      )}
      {error && state.items.length > 0 && (
        <button type="button" onClick={loadMore} className="mx-auto mt-8 block text-netflix-muted underline">Couldn't load more. Tap to retry.</button>
      )}
      <div ref={sentinel} aria-hidden="true" className="h-px" />
    </div>
  );
};

/* ---------- Pages ---------- */

export const BrowsePage: React.FC<{ search: string }> = ({ search }) => <BrowseView search={search} />;

const BrandHeader: React.FC<{ logo: string | null | undefined; name: string; subtitle: string; dark?: boolean }> = ({ logo, name, subtitle, dark }) => {
  const [loaded, setLoaded] = useState(false);
  return (
    <div className="mb-[2vw] flex items-center gap-[clamp(14px,1.6vw,28px)] animate-fade-in">
      <div className={`nf-brand !w-[clamp(120px,13vw,230px)] flex-shrink-0 !cursor-default hover:!transform-none hover:!shadow-none ${dark ? 'is-dark' : ''}`}>
        {logo ? (
          <img src={tmdbImage(logo, dark ? 'w185' : 'w300') || ''} alt="" onLoad={() => setLoaded(true)} className={`${loaded ? 'is-loaded' : ''} ${dark ? '!mb-0' : ''}`} />
        ) : (
          <span className="nf-brand-name">{name}</span>
        )}
      </div>
      <div className="min-w-0">
        <h1 className="text-[clamp(1.6rem,2.6vw,2.75rem)] font-bold leading-tight tracking-[-0.02em] text-white">{name || '\u00a0'}</h1>
        <p className="mt-1 text-[max(14px,1vw)] text-netflix-muted">{subtitle}</p>
      </div>
    </div>
  );
};

/** /studio/marvel, /production/a24, /company/420 */
export const CompanyPage: React.FC<{ brandKey: string; search: string }> = ({ brandKey, search }) => {
  const curated = findBrand(brandKey);
  const brand = curated || (/^\d+$/.test(brandKey) ? { key: brandKey, name: '', ids: brandKey, logoId: Number(brandKey) } : null);
  const info = useCompanies(brand ? [brand.logoId] : []).data?.[String(brand?.logoId)];
  const base = useMemo(() => (brand ? { company: brand.ids } : undefined), [brand?.ids]); // eslint-disable-line react-hooks/exhaustive-deps
  const name = brand?.name || info?.name || '';

  useEffect(() => {
    if (name) document.title = `${name} — VidFast`;
  }, [name]);

  if (!brand) return <NotFoundPage />;
  return (
    <BrowseView
      search={search}
      base={base}
      locked={['company']}
      header={<BrandHeader logo={info?.logo} name={name} subtitle="Movies & TV shows · filter, sort or search below" />}
    />
  );
};

/** /provider/8 — everything streaming on a service in the chosen region */
export const ProviderPage: React.FC<{ id: number; search: string }> = ({ id, search }) => {
  const region = new URLSearchParams(search).get('region') || getRegion();
  const provider = useProviders(region).data?.providers.find((p) => p.id === id);
  const base = useMemo(() => ({ provider: String(id), region }), [id, region]);

  useEffect(() => {
    if (provider) document.title = `${provider.name} — VidFast`;
  }, [provider]);

  return (
    <BrowseView
      search={search}
      base={base}
      locked={['provider']}
      header={<BrandHeader dark logo={provider?.logo} name={provider?.name || 'Streaming service'} subtitle={`Streaming in ${regionName(region)}`} />}
    />
  );
};

export default BrowsePage;
