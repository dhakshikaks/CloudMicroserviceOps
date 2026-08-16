import type { DependencyGraphResponse, RootCauseCandidate, ServiceEventRecord, ServiceHealthMap } from "../types";
import { LIVE_WINDOW_MINUTES, MONITORED_SERVICES } from "../services/api";
import StatCard from "./StatCard";

interface Props {
  health: ServiceHealthMap | null;
  graph: DependencyGraphResponse | null;
  events: ServiceEventRecord[] | null;
  rootCauses: RootCauseCandidate[] | null;
}

const LIVE_WINDOW_MS = LIVE_WINDOW_MINUTES * 60_000;

export default function SystemStatus({ health, graph, events, rootCauses }: Props) {
  const upCount = health ? MONITORED_SERVICES.filter((s) => health[s]).length : null;
  // Only count failures inside the same live window RCA is scored against -
  // an old FAILURE row must not inflate this into looking like an active incident.
  const failureCount =
    events?.filter((e) => e.status === "FAILURE" && Date.now() - new Date(e.timestamp).getTime() <= LIVE_WINDOW_MS)
      .length ?? null;
  const topCause = rootCauses && rootCauses.length > 0 ? rootCauses[0].service : "None";

  return (
    <div className="stat-grid">
      <StatCard
        label="Services"
        value={upCount === null ? "—" : `${upCount}/${MONITORED_SERVICES.length}`}
        detail="reporting up"
        tone={upCount === null ? "default" : upCount === MONITORED_SERVICES.length ? "good" : "critical"}
      />
      <StatCard
        label="Active Dependencies"
        value={graph ? String(graph.edges.length) : "—"}
        detail="observed edges (all-time)"
        tone="accent"
      />
      <StatCard
        label="Recent Failures"
        value={failureCount === null ? "—" : String(failureCount)}
        detail={`in last ${LIVE_WINDOW_MINUTES} min`}
        tone={failureCount === null ? "default" : failureCount > 0 ? "warning" : "good"}
      />
      <StatCard
        label="Current Root Cause"
        value={rootCauses ? topCause : "—"}
        detail={
          rootCauses && rootCauses.length > 0
            ? `score ${rootCauses[0].score.toFixed(2)}`
            : `no incident (last ${LIVE_WINDOW_MINUTES} min)`
        }
        tone={rootCauses && rootCauses.length > 0 ? "critical" : "default"}
      />
    </div>
  );
}
