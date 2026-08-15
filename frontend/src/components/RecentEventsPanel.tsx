import type { ServiceEventRecord } from "../types";
import SectionState from "./SectionState";
import StatusBadge from "./StatusBadge";

interface Props {
  events: ServiceEventRecord[] | null;
  loading: boolean;
  error: string | null;
}

export default function RecentEventsPanel({ events, loading, error }: Props) {
  return (
    <section className="panel">
      <h2 className="section-title">Recent Events</h2>
      <SectionState
        loading={loading}
        error={error}
        empty={!events || events.length === 0}
        emptyMessage="No events observed yet."
        skeletonRows={5}
      >
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Time</th>
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
                  <td className="cell-muted">{new Date(event.timestamp).toLocaleTimeString()}</td>
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
