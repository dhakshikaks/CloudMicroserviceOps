import { useEffect, useState } from "react";
import type { RootCauseCandidate } from "../types";

// How long the "just recovered" banner stays up after an incident clears,
// so a resolved incident isn't missed between polls. This is purely a
// display grace period held in component state - not persisted incident
// state, and unrelated to LIVE_WINDOW_MINUTES (which controls what RCA
// itself scores). Extracted from the original Step 19 implementation so
// every consumer (Overview, Incidents) shares one definition.
const RECOVERY_DISPLAY_MS = 60_000;

export interface IncidentState {
  status: "healthy" | "incident" | "recovered";
  lastIncident: RootCauseCandidate | null;
  recoveredAt: number | null;
}

/** candidates should come from getRootCauses() at the default (pinned) LIVE_WINDOW_MINUTES. */
export function useIncidentState(candidates: RootCauseCandidate[] | null): IncidentState {
  const [incident, setIncident] = useState<IncidentState>({
    status: "healthy",
    lastIncident: null,
    recoveredAt: null,
  });

  useEffect(() => {
    if (!candidates) return; // still loading - don't change state on a null poll
    const top = candidates.length > 0 ? candidates[0] : null;
    setIncident((prev) => {
      if (top) return { status: "incident", lastIncident: top, recoveredAt: null };
      if (prev.status === "incident") {
        return { status: "recovered", lastIncident: prev.lastIncident, recoveredAt: Date.now() };
      }
      if (prev.status === "recovered" && prev.recoveredAt !== null && Date.now() - prev.recoveredAt < RECOVERY_DISPLAY_MS) {
        return prev;
      }
      return { status: "healthy", lastIncident: null, recoveredAt: null };
    });
  }, [candidates]);

  return incident;
}
