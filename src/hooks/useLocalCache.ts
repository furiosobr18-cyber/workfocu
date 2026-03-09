import { useState, useEffect, useCallback, useRef } from "react";

/**
 * Generic local cache hook for instant page loads.
 * Shows cached data immediately, then refreshes from the async fetcher in background.
 */
export function useLocalCache<T>(
  cacheKey: string,
  fetcher: () => Promise<T | null>,
  deps: any[] = []
): { data: T | null; isLoading: boolean; refresh: () => Promise<void> } {
  const [data, setData] = useState<T | null>(() => {
    try {
      const raw = localStorage.getItem(cacheKey);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [isLoading, setIsLoading] = useState(data === null);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  const refresh = useCallback(async () => {
    try {
      const result = await fetcher();
      if (!isMounted.current) return;
      if (result !== null) {
        setData(result);
        try {
          localStorage.setItem(cacheKey, JSON.stringify(result));
        } catch {}
      }
    } catch (e) {
      console.error(`Cache fetch error [${cacheKey}]:`, e);
    } finally {
      if (isMounted.current) setIsLoading(false);
    }
  }, [cacheKey, fetcher]);

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, isLoading, refresh };
}
