import { Link } from "react-router-dom";
import type { ServiceEventRecord } from "../types";
import { LIVE_WINDOW_MINUTES } from "../services/api";
import SectionState from "./SectionState";
import StatusBadge from "./StatusBadge";

interface Props {
  events: ServiceEventRecord[] | null;
  loading: boolean;
  error: string | null;
  emptyMessage?: string;
  /** compact = Overview's trimmed glance (no Window column, links to /events for the rest). */
  compact?: boolean;
}

const LIVE_WINDOW_MS = LIVE_WINDOW_MINUTES * 60_000;

function isLive(timestamp: string): boolean {
  return Date.now() - new Date(timestamp).getTime() <= LIVE_WINDOW_MS;
}

// Compact relative age so a stale row is obviously stale at a glance,
// alongside the exact clock time already shown.
function formatAge(timestamp: string): string {
  const ageMs = Date.now() - new Date(timestamp).getTime();
  const minutes = Math.floor(ageMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function RecentEventsPanel({ events, loading, error, emptyMessage, compact = false }: Props) {
  return (
    <section className="panel">
      <div className="panel-header-row">
        <h2 className="section-title">Recent Events</h2>
        {compact && (
          <Link to="/events" className="panel-header-link">
            View all &rarr;
          </Link>
        )}
      </div>
      <SectionState
        loading={loading}
        error={error}
        empty={!events || events.length === 0}
        emptyMessage={emptyMessage ?? "No events observed yet."}
        skeletonRows={5}
      >
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Time</th>
                {!compact && <th>Window</th>}
                <th>Source</th>
                <th>Target</th>
                <th>Operation</th>
                <th>Status</th>
                <th>Duration</th>
              </tr>
            </thead>
            <tbody>
              {events?.map((event) => (
                <tr key={event.eventId}>
                  <td className="cell-muted">
                    <div>{new Date(event.timestamp).toLocaleTimeString()}</div>
                    <div className="cell-age">{formatAge(event.timestamp)}</div>
                  </td>
                  {!compact && (
                    <td>
                      <StatusBadge status={isLive(event.timestamp) ? "LIVE" : "HISTORICAL"} />
                    </td>
                  )}
                  <td>{event.sourceService}</td>
                  <td>{event.targetService}</td>
                  <td className="cell-muted">{event.operation}</td>
                  <td>
                    <StatusBadge status={event.status} />
                  </td>
                  <td>{event.durationMs} ms</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionState>
    </section>
  );
}
