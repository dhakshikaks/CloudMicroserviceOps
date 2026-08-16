import { useMemo, useState } from "react";
import { getRecentEvents } from "../services/api";
import { useFetchState } from "../hooks/useFetchState";
import { usePolling } from "../hooks/usePolling";
import RecentEventsPanel from "../components/RecentEventsPanel";
import type { ServiceEventRecord } from "../types";

const POLL_INTERVAL_MS = 7000;

export default function Events() {
  const events = useFetchState<ServiceEventRecord[]>();
  usePolling(() => events.run(getRecentEvents()), POLL_INTERVAL_MS);

  const [serviceFilter, setServiceFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

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
    return events.data.filter((e) => {
      if (serviceFilter !== "all" && e.sourceService !== serviceFilter && e.targetService !== serviceFilter) return false;
      if (statusFilter !== "all" && e.status !== statusFilter) return false;
      return true;
    });
  }, [events.data, serviceFilter, statusFilter]);

  return (
    <div className="page">
      <div className="page-header">
        <h1>Events</h1>
        <p>Operational event stream. Filters apply to the last 50 events - the API does not support server-side search.</p>
      </div>

      <div className="events-filters">
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
        events={filtered}
        loading={events.loading}
        error={events.error}
        emptyMessage="No matching events in the last 50."
      />
    </div>
  );
}
