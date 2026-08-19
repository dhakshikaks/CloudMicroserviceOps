import { Link } from "react-router-dom";
import type { ServiceEventRecord } from "../types";
import { LIVE_WINDOW_MINUTES } from "../services/api";
import SectionState from "./SectionState";
import StatusBadge from "./StatusBadge";

export type EventSortKey = "timestamp" | "sourceService" | "targetService" | "status" | "durationMs";

interface Props {
  events: ServiceEventRecord[] | null;
  loading: boolean;
  error: string | null;
  emptyMessage?: string;
  /** compact = Overview's trimmed glance (no Window column, links to /events for the rest). */
  compact?: boolean;
  sortKey?: EventSortKey;
  sortDir?: "asc" | "desc";
  onSort?: (key: EventSortKey) => void;
  onRowClick?: (event: ServiceEventRecord) => void;
  selectedEventId?: string | null;
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

function SortableHeader({
  label,
  sortKey,
  activeKey,
  dir,
  onSort,
}: {
  label: string;
  sortKey: EventSortKey;
  activeKey?: EventSortKey;
  dir?: "asc" | "desc";
  onSort?: (key: EventSortKey) => void;
}) {
  if (!onSort) return <th>{label}</th>;
  return (
    <th className="is-sortable" onClick={() => onSort(sortKey)}>
      {label}
      {activeKey === sortKey && <span className="sort-arrow">{dir === "asc" ? "↑" : "↓"}</span>}
    </th>
  );
}

export default function RecentEventsPanel({
  events,
  loading,
  error,
  emptyMessage,
  compact = false,
  sortKey,
  sortDir,
  onSort,
  onRowClick,
  selectedEventId,
}: Props) {
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
                <SortableHeader label="Time" sortKey="timestamp" activeKey={sortKey} dir={sortDir} onSort={onSort} />
                {!compact && <th>Window</th>}
                <SortableHeader label="Source" sortKey="sourceService" activeKey={sortKey} dir={sortDir} onSort={onSort} />
                <SortableHeader label="Target" sortKey="targetService" activeKey={sortKey} dir={sortDir} onSort={onSort} />
                <th>Operation</th>
                <SortableHeader label="Status" sortKey="status" activeKey={sortKey} dir={sortDir} onSort={onSort} />
                <SortableHeader label="Duration" sortKey="durationMs" activeKey={sortKey} dir={sortDir} onSort={onSort} />
                {!compact && <th>Event ID</th>}
              </tr>
            </thead>
            <tbody>
              {events?.map((event) => (
                <tr
                  key={event.eventId}
                  className={`${onRowClick ? "is-selectable" : ""}${selectedEventId === event.eventId ? " active" : ""}`}
                  onClick={onRowClick ? () => onRowClick(event) : undefined}
                  style={selectedEventId === event.eventId ? { background: "var(--bg-surface-raised)" } : undefined}
                >
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
                  {!compact && <td className="cell-muted">#{event.eventId.slice(0, 8)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionState>
    </section>
  );
}
