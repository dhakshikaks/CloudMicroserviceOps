import type { DependencyGraphResponse, RootCauseCandidate, ServiceEventRecord, ServiceHealthMap } from "../types";
import { MONITORED_SERVICES } from "../services/api";

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
    <section className="status-bar">
      <div className="status-item">
        <span className="status-label">Services</span>
        <span className="status-value">{upCount === null ? "—" : `${upCount}/${MONITORED_SERVICES.length}`}</span>
      </div>
      <div className="status-item">
        <span className="status-label">Active Dependencies</span>
        <span className="status-value">{graph?.edges.length ?? "—"}</span>
      </div>
      <div className="status-item">
        <span className="status-label">Recent Failures</span>
        <span className="status-value">{failureCount ?? "—"}</span>
      </div>
      <div className="status-item">
        <span className="status-label">Current Root Cause</span>
        <span className="status-value">{rootCauses ? topCause : "—"}</span>
      </div>
    </section>
  );
}
