import { useCallback, useState } from "react";

interface FetchState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

/** Tracks loading/error/data for one polled data source. */
export function useFetchState<T>() {
  const [state, setState] = useState<FetchState<T>>({ data: null, loading: true, error: null });

  const run = useCallback((promise: Promise<T>) => {
    promise
      .then((data) => setState({ data, loading: false, error: null }))
      .catch((err) => setState((s) => ({ ...s, loading: false, error: err instanceof Error ? err.message : String(err) })));
  }, []);

  return { ...state, run };
}
