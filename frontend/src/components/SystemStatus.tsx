import type { DependencyGraphResponse, RootCauseCandidate, ServiceEventRecord, ServiceHealthMap } from "../types";
import { MONITORED_SERVICES } from "../services/api";
import StatCard from "./StatCard";

interface Props {
  health: ServiceHealthMap | null;
  graph: DependencyGraphResponse | null;
  events: ServiceEventRecord[] | null;
  rootCauses: RootCauseCandidate[] | null;
}

export default function SystemStatus({ health, graph, events, rootCauses }: Props) {
  const upCount = health ? MONITORED_SERVICES.filter((s) => health[s]).length : null;
  const failureCount = events?.filter((e) => e.status === "FAILURE").length ?? null;
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
        detail="observed edges"
        tone="accent"
      />
      <StatCard
        label="Recent Failures"
        value={failureCount === null ? "—" : String(failureCount)}
        detail="in recent events"
        tone={failureCount === null ? "default" : failureCount > 0 ? "warning" : "good"}
      />
      <StatCard
        label="Current Root Cause"
        value={rootCauses ? topCause : "—"}
        detail={rootCauses && rootCauses.length > 0 ? `score ${rootCauses[0].score.toFixed(2)}` : "no active incident"}
        tone={rootCauses && rootCauses.length > 0 ? "critical" : "default"}
      />
    </div>
  );
}
