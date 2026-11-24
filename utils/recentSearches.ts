const RECENT_KEY = 'vidfast_recent_searches';
const MAX_RECENT = 6;

export const loadRecentSearches = (): string[] => {
  try {
    const parsed = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter((q) => typeof q === 'string').slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
};

export const saveRecentSearch = (query: string) => {
  const q = query.trim();
  if (!q) return;
  try {
    const next = [q, ...loadRecentSearches().filter((x) => x.toLowerCase() !== q.toLowerCase())].slice(0, MAX_RECENT);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable: ignore */
  }
};

export const clearRecentSearches = () => {
  try {
    localStorage.removeItem(RECENT_KEY);
  } catch {
    /* ignore */
  }
};
