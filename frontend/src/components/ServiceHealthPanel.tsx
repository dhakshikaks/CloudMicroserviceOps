import type { ServiceHealthMap } from "../types";
import { MONITORED_SERVICES } from "../services/api";
import SectionState from "./SectionState";

interface Props {
  health: ServiceHealthMap | null;
  loading: boolean;
  error: string | null;
}

export default function ServiceHealthPanel({ health, loading, error }: Props) {
  return (
    <section className="panel">
      <h2>Service Health</h2>
      <SectionState loading={loading} error={error} empty={!health}>
        <div className="health-grid">
          {MONITORED_SERVICES.map((service) => {
            const up = health?.[service];
            return (
              <div key={service} className={`health-card ${up ? "health-up" : "health-down"}`}>
                <span className="health-name">{service}</span>
                <span className="health-status">{up ? "UP" : "DOWN"}</span>
              </div>
            );
          })}
        </div>
      </SectionState>
    </section>
  );
}
