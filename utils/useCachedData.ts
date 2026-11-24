import { useCallback, useEffect, useState } from 'react';

/**
 * App-wide data cache. Pages render instantly from cache when you come back to them
 * (which also lets "Back" restore your exact scroll position).
 */
const store = new Map<string, unknown>();
const inflight = new Map<string, Promise<unknown>>();

export const peekCache = <T,>(key: string): T | undefined => store.get(key) as T | undefined;

export function loadCached<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  if (store.has(key)) return Promise.resolve(store.get(key) as T);
  let p = inflight.get(key) as Promise<T> | undefined;
  if (!p) {
    p = fetcher().then(
      (value) => {
        store.set(key, value);
        inflight.delete(key);
        return value;
      },
      (err) => {
        inflight.delete(key);
        throw err;
      }
    );
    inflight.set(key, p);
  }
  return p;
}

export function useCachedData<T>(key: string | null, fetcher: () => Promise<T>) {
  const [state, setState] = useState<{ key: string | null; data?: T; error?: string }>(() => ({
    key,
    data: key ? peekCache<T>(key) : undefined,
  }));
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!key) return;
    const cached = peekCache<T>(key);
    if (cached !== undefined) {
      setState({ key, data: cached });
      return;
    }
    let alive = true;
    setState({ key });
    loadCached(key, fetcher).then(
      (data) => alive && setState({ key, data }),
      (err) => alive && setState({ key, error: err instanceof Error ? err.message : 'Failed to load' })
    );
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, nonce]);

  const reload = useCallback(() => {
    if (key) store.delete(key);
    setNonce((n) => n + 1);
  }, [key]);

  const data = state.key === key ? state.data : key ? peekCache<T>(key) : undefined;
  const error = state.key === key ? state.error : undefined;
  return { data, error, loading: !!key && data === undefined && !error, reload };
}
