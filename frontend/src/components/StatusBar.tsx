import { useEffect, useState } from "react";
import { getMetricsSnapshot, getRequestRateRange, getServiceHealth, MONITORED_SERVICES, type RangeSample } from "../services/api";
import { useFetchState } from "../hooks/useFetchState";
import { usePolling } from "../hooks/usePolling";
import type { ServiceHealthMap } from "../types";
import type { RuntimeMetrics } from "./MetricsPanel";
import Sparkline from "./charts/Sparkline";

const POLL_INTERVAL_MS = 7000;
const TREND_POLL_INTERVAL_MS = 15000;

function sum(values: Record<string, number> | undefined): number | undefined {
  if (!values) return undefined;
  const nums = MONITORED_SERVICES.map((s) => values[s]).filter((v): v is number => v !== undefined);
  if (nums.length === 0) return undefined;
  return nums.reduce((a, b) => a + b, 0);
}

/** The persistent bottom bar every Activity Monitor window has: a
 * one-line aggregate summary plus a tiny real-time history graph. */
export default function StatusBar() {
  const health = useFetchState<ServiceHealthMap>();
  const metrics = useFetchState<RuntimeMetrics>();
  const [samples, setSamples] = useState<RangeSample[]>([]);

  usePolling(() => {
    health.run(getServiceHealth());
    metrics.run(getMetricsSnapshot());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, POLL_INTERVAL_MS);

  useEffect(() => {
    let cancelled = false;
    function fetchTrend() {
      getRequestRateRange("15m")
        .then((series) => {
          if (!cancelled) setSamples(series[0]?.samples ?? []);
        })
        .catch(() => {});
    }
    fetchTrend();
    const id = setInterval(fetchTrend, TREND_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const upCount = health.data ? MONITORED_SERVICES.filter((s) => health.data![s]).length : null;
  const totalErrorRate = sum(metrics.data?.errorRate);
  const hasErrors = totalErrorRate !== undefined && totalErrorRate > 0;

  return (
    <footer className="status-bar">
      <span className="status-bar-item mono">
        {upCount === null ? "—" : upCount}/{MONITORED_SERVICES.length} services up
      </span>
      <span className="status-bar-sep" />
      <span className={`status-bar-item mono${hasErrors ? " tone-critical" : ""}`}>
        {totalErrorRate === undefined ? "—" : totalErrorRate.toFixed(2)} err/s
      </span>
      <span className="status-bar-sep" />
      <span className="status-bar-item mono">Req/s (15m)</span>
      <Sparkline samples={samples} width={100} height={20} tone={hasErrors ? "warning" : "default"} />
      <div className="status-bar-spacer" />
      <span className="status-bar-item mono status-bar-muted">CloudMicroserviceOps</span>
    </footer>
  );
}
