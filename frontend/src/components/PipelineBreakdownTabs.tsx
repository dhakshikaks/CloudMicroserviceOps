import { useState } from "react";
import { MONITORED_SERVICES } from "../services/api";
import type { RuntimeMetrics } from "./MetricsPanel";
import { fmtMs, fmtRate } from "../lib/format";
import SectionState from "./SectionState";

type Tab = "latency" | "errors";

interface Props {
  metrics: RuntimeMetrics | null;
  loading: boolean;
  error: string | null;
}

export default function PipelineBreakdownTabs({ metrics, loading, error }: Props) {
  const [tab, setTab] = useState<Tab>("latency");

  const latencyValues = MONITORED_SERVICES.map((s) => metrics?.latencyP95[s]).filter((v): v is number => v !== undefined);
  const maxLatency = latencyValues.length > 0 ? Math.max(...latencyValues) : 0;

  const rateValues = MONITORED_SERVICES.flatMap((s) => [metrics?.requestRate[s], metrics?.errorRate[s]]).filter(
    (v): v is number => v !== undefined
  );
  const maxRate = rateValues.length > 0 ? Math.max(...rateValues) : 0;

  return (
    <section className="panel">
      <div className="breakdown-tabs">
        {(["latency", "errors"] as Tab[]).map((t) => (
          <button key={t} type="button" className={`breakdown-tab${tab === t ? " active" : ""}`} onClick={() => setTab(t)}>
            {t === "latency" ? "Latency by service" : "Errors vs. throughput"}
          </button>
        ))}
      </div>
      <p className="breakdown-hint">
        {tab === "latency" ? "Live P95 per service, refreshed every 7s." : "Live request and error rate per service."}
      </p>

      <SectionState loading={loading} error={error} empty={!metrics} emptyMessage="No metrics observed yet." skeletonRows={5}>
        {tab === "latency" &&
          MONITORED_SERVICES.map((svc) => {
            const v = metrics?.latencyP95[svc];
            const pct = v !== undefined && maxLatency > 0 ? Math.max(4, (v / maxLatency) * 100) : 0;
            return (
              <div className="breakdown-row" key={svc}>
                <span className="breakdown-row-label mono">{svc}</span>
                <span className="breakdown-bar-track">
                  <span className="breakdown-bar-fill" style={{ width: `${pct}%` }} />
                </span>
                <span className="breakdown-row-value">{fmtMs(v)}</span>
              </div>
            );
          })}

        {tab === "errors" &&
          MONITORED_SERVICES.map((svc) => {
            const req = metrics?.requestRate[svc];
            const err = metrics?.errorRate[svc];
            const pct = err !== undefined && maxRate > 0 ? Math.max(4, (err / maxRate) * 100) : 0;
            return (
              <div className="breakdown-row" key={svc}>
                <span className="breakdown-row-label mono">{svc}</span>
                <span className="breakdown-bar-track">
                  <span className="breakdown-bar-fill" style={{ width: `${pct}%` }} />
                </span>
                <span className="breakdown-row-value">
                  {fmtRate(req)} · err {fmtRate(err)}
                </span>
              </div>
            );
          })}
      </SectionState>
    </section>
  );
}
