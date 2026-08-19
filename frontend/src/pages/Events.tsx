import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { getRecentEvents } from "../services/api";
import { useFetchState } from "../hooks/useFetchState";
import { usePolling } from "../hooks/usePolling";
import RecentEventsPanel, { type EventSortKey } from "../components/RecentEventsPanel";
import StatusBadge from "../components/StatusBadge";
import type { ServiceEventRecord } from "../types";

const POLL_INTERVAL_MS = 7000;

export default function Events() {
  const events = useFetchState<ServiceEventRecord[]>();
  usePolling(() => events.run(getRecentEvents()), POLL_INTERVAL_MS);

  const [serviceFilter, setServiceFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<EventSortKey>("timestamp");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selectedEvent, setSelectedEvent] = useState<ServiceEventRecord | null>(null);

  const services = useMemo(() => {
    const set = new Set<string>();
    events.data?.forEach((e) => {
      set.add(e.sourceService);
      set.add(e.targetService);
    });
    return [...set].sort();
  }, [events.data]);

  const statuses = useMemo(() => {
    const set = new Set<string>();
    events.data?.forEach((e) => set.add(e.status));
    return [...set].sort();
  }, [events.data]);

  const filtered = useMemo(() => {
    if (!events.data) return null;
    const q = search.trim().toLowerCase();
    return events.data.filter((e) => {
      if (serviceFilter !== "all" && e.sourceService !== serviceFilter && e.targetService !== serviceFilter) return false;
      if (statusFilter !== "all" && e.status !== statusFilter) return false;
      if (q && !`${e.sourceService} ${e.targetService} ${e.operation} ${e.eventId}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [events.data, serviceFilter, statusFilter, search]);

  const sorted = useMemo(() => {
    if (!filtered) return null;
    const copy = [...filtered];
    copy.sort((a, b) => {
      let cmp: number;
      if (sortKey === "timestamp") {
        cmp = new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
      } else if (sortKey === "durationMs") {
        cmp = a.durationMs - b.durationMs;
      } else {
        cmp = String(a[sortKey]).localeCompare(String(b[sortKey]));
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [filtered, sortKey, sortDir]);

  function handleSort(key: EventSortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const relatedEvents = selectedEvent
    ? (events.data ?? [])
        .filter(
          (e) =>
            e.eventId !== selectedEvent.eventId &&
            (e.sourceService === selectedEvent.sourceService ||
              e.targetService === selectedEvent.targetService ||
              e.sourceService === selectedEvent.targetService ||
              e.targetService === selectedEvent.sourceService)
        )
        .slice(0, 8)
    : [];

  return (
    <div className="page">
      <div className="page-header">
        <h1>Event Explorer</h1>
        <p>Last 50 events, filtered and sorted client-side</p>
      </div>

      <div className="events-filters">
        <div className="table-search">
          <Search size={13} />
          <input
            type="text"
            placeholder="Search source, target, operation, event ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <label>
          Service
          <select value={serviceFilter} onChange={(e) => setServiceFilter(e.target.value)}>
            <option value="all">All services</option>
            {services.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label>
          Status
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All statuses</option>
            {statuses.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      </div>

      <RecentEventsPanel
        events={sorted}
        loading={events.loading}
        error={events.error}
        emptyMessage="No matching events in the last 50."
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={handleSort}
        onRowClick={setSelectedEvent}
        selectedEventId={selectedEvent?.eventId ?? null}
      />

      {selectedEvent && (
        <>
          <div className="service-inspector-scrim" style={{ position: "fixed" }} onClick={() => setSelectedEvent(null)} />
          <div className="service-inspector-overlay as-modal">
            <div className="service-inspector-panel">
              <div className="service-inspector">
                <div className="service-inspector-head">
                  <div>
                    <span className="service-inspector-eyebrow">Event</span>
                    <div className="service-inspector-name mono">#{selectedEvent.eventId.slice(0, 8)}</div>
                    <span className="service-inspector-id mono">{selectedEvent.eventId}</span>
                  </div>
                  <div className="service-inspector-actions">
                    <button type="button" title="Close" onClick={() => setSelectedEvent(null)}>
                      <X size={15} />
                    </button>
                  </div>
                </div>

                <div className="service-inspector-section">
                  <h3>Details</h3>
                  <div className="inspector-row">
                    <span className="inspector-row-label">Timestamp</span>
                    <span className="inspector-row-value">{new Date(selectedEvent.timestamp).toLocaleString()}</span>
                  </div>
                  <div className="inspector-row">
                    <span className="inspector-row-label">Source</span>
                    <span className="inspector-row-value">{selectedEvent.sourceService}</span>
                  </div>
                  <div className="inspector-row">
                    <span className="inspector-row-label">Target</span>
                    <span className="inspector-row-value">{selectedEvent.targetService}</span>
                  </div>
                  <div className="inspector-row">
                    <span className="inspector-row-label">Operation</span>
                    <span className="inspector-row-value">{selectedEvent.operation}</span>
                  </div>
                  <div className="inspector-row">
                    <span className="inspector-row-label">Status</span>
                    <StatusBadge status={selectedEvent.status} />
                  </div>
                  <div className="inspector-row">
                    <span className="inspector-row-label">Latency</span>
                    <span className="inspector-row-value">{selectedEvent.durationMs} ms</span>
                  </div>
                  <div className="inspector-row">
                    <span className="inspector-row-label">Data source</span>
                    <span className="inspector-row-value" style={{ fontWeight: 400 }}>Kafka event stream</span>
                  </div>
                </div>

                <div className="service-inspector-section">
                  <h3>Related events ({relatedEvents.length})</h3>
                  {relatedEvents.length === 0 ? (
                    <p className="state-message">No other events share this event's source or target.</p>
                  ) : (
                    <ul className="service-inspector-event-list">
                      {relatedEvents.map((e) => (
                        <li key={e.eventId}>
                          <span className="cell-muted">{new Date(e.timestamp).toLocaleTimeString()}</span>
                          <span>
                            {e.sourceService} &rarr; {e.targetService}
                          </span>
                          <StatusBadge status={e.status} />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
