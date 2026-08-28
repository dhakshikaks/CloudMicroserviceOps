import { useEffect, useRef, useState } from "react";
import { Activity } from "lucide-react";
import type { DependencyGraphResponse, RootCauseCandidate, ServiceEventRecord } from "../types";
import type { RuntimeMetrics } from "./MetricsPanel";
import RootCauseSummaryCard from "./RootCauseSummaryCard";
import MetricsPanel from "./MetricsPanel";
import StatusBadge from "./StatusBadge";
import SectionState from "./SectionState";

type Tab = "root-cause" | "events" | "metrics";

const TABS: { id: Tab; label: string }[] = [
  { id: "root-cause", label: "Root cause" },
  { id: "events", label: "Recent events" },
  { id: "metrics", label: "Metrics snapshot" },
];

interface RootCauseProps {
  candidates: RootCauseCandidate[] | null;
  metrics: RuntimeMetrics | null;
  graph: DependencyGraphResponse | null;
  loading: boolean;
  error: string | null;
}

interface Props {
  rootCauseProps: RootCauseProps;
  events: ServiceEventRecord[] | null;
  eventsLoading: boolean;
  eventsError: string | null;
  metrics: RuntimeMetrics | null;
  metricsLoading: boolean;
  metricsError: string | null;
}

export default function ExecutionConsolePanel({
  rootCauseProps,
  events,
  eventsLoading,
  eventsError,
  metrics,
  metricsLoading,
  metricsError,
}: Props) {
  const [tab, setTab] = useState<Tab>("root-cause");
  const [follow, setFollow] = useState(true);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (follow && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [events, follow]);

  return (
    <aside className="console-panel pipeline-console">
      <div className="console-header">
        <span className="console-header-icon">
          <Activity size={14} />
        </span>
        <div>
          <div className="console-header-title">Service pipeline</div>
          <div className="console-header-desc">Live status across all monitored services.</div>
        </div>
      </div>

      <div className="notif-tabs">
        {TABS.map((t) => (
          <button key={t.id} type="button" className={`notif-tab${tab === t.id ? " active" : ""}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="console-body">
        {tab === "root-cause" && <RootCauseSummaryCard {...rootCauseProps} compact />}

        {tab === "events" && (
          <>
            <div className="console-events-header">
              <span className="console-events-count mono">{events ? events.length : 0} events</span>
              <button type="button" className={`console-follow-btn${follow ? " active" : ""}`} onClick={() => setFollow((f) => !f)}>
                Follow
              </button>
            </div>
            <SectionState loading={eventsLoading} error={eventsError} empty={!events || events.length === 0} emptyMessage="No events observed yet." skeletonRows={4}>
              <div className="console-event-list" ref={listRef}>
                {events?.map((event) => (
                  <div className="console-event-row" key={event.eventId}>
                    <span className="console-event-time">{new Date(event.timestamp).toLocaleTimeString()}</span>
                    <span className="console-event-route">
                      {event.sourceService} &rarr; {event.targetService}
                    </span>
                    <StatusBadge status={event.status} />
                    <span className="console-event-duration">{event.durationMs}ms</span>
                  </div>
                ))}
              </div>
            </SectionState>
          </>
        )}

        {tab === "metrics" && <MetricsPanel metrics={metrics} loading={metricsLoading} error={metricsError} />}
      </div>
    </aside>
  );
}
