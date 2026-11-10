import { useCallback, useEffect, useRef, useState } from 'react';
import type { Page } from '../core/models';

/** Paged loading with dedupe by key. `reset` whenever deps change. */
export function useInfinite<T>(
  fetchPage: (page: number, signal: AbortSignal) => Promise<Page<T>>,
  keyOf: (item: T) => string,
  deps: unknown[],
) {
  const [items, setItems] = useState<T[]>([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error>();
  const ctrlRef = useRef<AbortController | null>(null);
  const fetchRef = useRef(fetchPage);
  fetchRef.current = fetchPage;
  const keyRef = useRef(keyOf);
  keyRef.current = keyOf;
  const busy = useRef(false);

  const load = useCallback((next: number, replace: boolean) => {
    if (busy.current && !replace) return;
    ctrlRef.current?.abort();
    const ctrl = new AbortController();
    ctrlRef.current = ctrl;
    busy.current = true;
    setLoading(true);
    setError(undefined);
    fetchRef
      .current(next, ctrl.signal)
      .then((res) => {
        if (ctrl.signal.aborted) return;
        setItems((prev) => {
          const base = replace ? [] : prev;
          const seen = new Set(base.map(keyRef.current));
          return [...base, ...res.results.filter((r) => !seen.has(keyRef.current(r)))];
        });
        setPage(res.page);
        setTotalPages(res.totalPages);
      })
      .catch((e: Error) => {
        if (ctrl.signal.aborted || e.name === 'AbortError') return;
        setError(e);
      })
      .finally(() => {
        if (ctrlRef.current === ctrl) {
          busy.current = false;
          setLoading(false);
        }
      });
  }, []);

  useEffect(() => {
    setItems([]);
    setPage(0);
    load(1, true);
    return () => ctrlRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const hasMore = page < totalPages;
  const loadMore = useCallback(() => {
    if (!busy.current && hasMore && !error) load(page + 1, false);
  }, [hasMore, page, error, load]);
  const retry = useCallback(() => load(page + 1, page === 0), [page, load]);

  return { items, loading, error, hasMore, loadMore, retry, initialLoading: loading && items.length === 0 };
}
