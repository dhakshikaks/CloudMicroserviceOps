import { createContext, useContext, useState, type ReactNode } from "react";
import type { TimeWindow } from "../services/api";

interface TimeWindowContextValue {
  timeWindow: TimeWindow;
  setTimeWindow: (w: TimeWindow) => void;
}

const TimeWindowContext = createContext<TimeWindowContextValue | null>(null);

// Drives Overview's and Metrics' historical charts only. RCA / Recent
// Failures / Events LIVE-HISTORICAL stay pinned to LIVE_WINDOW_MINUTES (15)
// regardless of this selection - see services/api.ts and useIncidentState.
export function TimeWindowProvider({ children }: { children: ReactNode }) {
  const [timeWindow, setTimeWindow] = useState<TimeWindow>("15m");
  return <TimeWindowContext.Provider value={{ timeWindow, setTimeWindow }}>{children}</TimeWindowContext.Provider>;
}

export function useTimeWindow(): TimeWindowContextValue {
  const ctx = useContext(TimeWindowContext);
  if (!ctx) throw new Error("useTimeWindow must be used within TimeWindowProvider");
  return ctx;
}
