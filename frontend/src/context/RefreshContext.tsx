import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

interface RefreshContextValue {
  lastRefreshAt: number;
  requestRefresh: () => void;
}

const RefreshContext = createContext<RefreshContextValue | null>(null);

// A single "refresh now" signal, shared app-wide. Pages that want to react to
// a manual refresh (the topbar's "Refresh now" button) add `lastRefreshAt` as
// an extra effect dependency alongside their normal poll interval.
export function RefreshProvider({ children }: { children: ReactNode }) {
  const [lastRefreshAt, setLastRefreshAt] = useState(() => Date.now());
  const requestRefresh = useCallback(() => setLastRefreshAt(Date.now()), []);
  return <RefreshContext.Provider value={{ lastRefreshAt, requestRefresh }}>{children}</RefreshContext.Provider>;
}

export function useRefresh(): RefreshContextValue {
  const ctx = useContext(RefreshContext);
  if (!ctx) throw new Error("useRefresh must be used within RefreshProvider");
  return ctx;
}
