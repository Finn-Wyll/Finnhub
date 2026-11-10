import { useCallback, useEffect, useRef, useState } from 'react';

export interface QueryState<T> {
  data: T | undefined;
  error: Error | undefined;
  loading: boolean;
  retry: () => void;
}

/**
 * Minimal async data hook with abort-on-change. Keeps the previous data while
 * a new key loads so layouts do not collapse between navigations.
 */
export function useQuery<T>(fn: (signal: AbortSignal) => Promise<T>, deps: unknown[], enabled = true): QueryState<T> {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<Error>();
  const [loading, setLoading] = useState(enabled);
  const [nonce, setNonce] = useState(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    setError(undefined);
    fnRef
      .current(ctrl.signal)
      .then((d) => {
        if (!ctrl.signal.aborted) {
          setData(d);
          setLoading(false);
        }
      })
      .catch((e: Error) => {
        if (ctrl.signal.aborted || e.name === 'AbortError') return;
        setError(e);
        setLoading(false);
      });
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce, enabled]);

  const retry = useCallback(() => setNonce((n) => n + 1), []);
  return { data, error, loading, retry };
}
