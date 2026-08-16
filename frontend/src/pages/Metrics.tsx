import { useEffect, useState } from "react";
import {
  getCpuUsage,
  getCpuUsageRangeByService,
  getErrorRate,
  getErrorRateRangeByService,
  getLatencyP95,
  getLatencyP95RangeByService,
  getMemoryUsage,
  getMemoryUsageRangeByService,
  getRequestRate,
  getRequestRateRangeByService,
  MONITORED_SERVICES,
  type RangeSeries,
} from "../services/api";
import { useFetchState } from "../hooks/useFetchState";
import { usePolling } from "../hooks/usePolling";
import { useTimeWindow } from "../context/TimeWindowContext";
import MetricsPanel, { type RuntimeMetrics } from "../components/MetricsPanel";
import Sparkline from "../components/charts/Sparkline";

const POLL_INTERVAL_MS = 7000;
const TREND_POLL_INTERVAL_MS = 15000;

type Tone = "default" | "warning" | "critical";

function samplesFor(data: RangeSeries[] | null, service: string) {
  return data?.find((s) => s.metric.job === service)?.samples ?? [];
}

export default function Metrics() {
  const { timeWindow } = useTimeWindow();
  const metrics = useFetchState<RuntimeMetrics>();

  const requestRateHistory = useFetchState<RangeSeries[]>();
  const errorRateHistory = useFetchState<RangeSeries[]>();
  const latencyHistory = useFetchState<RangeSeries[]>();
  const cpuHistory = useFetchState<RangeSeries[]>();
  const memoryHistory = useFetchState<RangeSeries[]>();
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);

  usePolling(() => {
    metrics.run(
      Promise.all([getCpuUsage(), getMemoryUsage(), getRequestRate(), getErrorRate(), getLatencyP95()]).then(
        ([cpu, memory, requestRate, errorRate, latencyP95]) => ({ cpu, memory, requestRate, errorRate, latencyP95 })
      )
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, POLL_INTERVAL_MS);

  useEffect(() => {
    let cancelled = false;
    function fetchTrends() {
      Promise.all([
        getRequestRateRangeByService(timeWindow),
        getErrorRateRangeByService(timeWindow),
        getLatencyP95RangeByService(timeWindow),
        getCpuUsageRangeByService(timeWindow),
        getMemoryUsageRangeByService(timeWindow),
      ])
        .then(([rr, er, lat, cpu, mem]) => {
          if (cancelled) return;
          requestRateHistory.run(Promise.resolve(rr));
          errorRateHistory.run(Promise.resolve(er));
          latencyHistory.run(Promise.resolve(lat));
          cpuHistory.run(Promise.resolve(cpu));
          memoryHistory.run(Promise.resolve(mem));
          setUpdatedAt(Date.now());
        })
        .catch(() => {});
    }
    fetchTrends();
    const id = setInterval(fetchTrends, TREND_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeWindow]);

  const rows: { label: string; data: RangeSeries[] | null; toneFor: (service: string) => Tone }[] = [
    { label: "Request rate", data: requestRateHistory.data, toneFor: () => "default" },
    {
      label: "Error rate",
      data: errorRateHistory.data,
      toneFor: (service) => (samplesFor(errorRateHistory.data, service).some((x) => x.value > 0) ? "critical" : "default"),
    },
    { label: "P95 latency", data: latencyHistory.data, toneFor: () => "default" },
    {
      label: "CPU",
      data: cpuHistory.data,
      toneFor: (service) => {
        const s = samplesFor(cpuHistory.data, service);
        const last = s[s.length - 1]?.value;
        return last !== undefined && last > 0.85 ? "critical" : last !== undefined && last > 0.6 ? "warning" : "default";
      },
    },
    { label: "Memory", data: memoryHistory.data, toneFor: () => "default" },
  ];

  const updatedLabel = updatedAt ? `Updated ${Math.max(0, Math.round((Date.now() - updatedAt) / 1000))}s ago` : "";

  return (
    <div className="page">
      <div className="page-header">
        <h1>Metrics</h1>
        <p>Current values and per-service trends over the selected chart window.</p>
      </div>

      <MetricsPanel metrics={metrics.data} loading={metrics.loading} error={metrics.error} />

      <section className="panel">
        <div className="panel-header-row">
          <h2 className="section-title">Trends by service</h2>
          {updatedLabel && <span className="last-updated">{updatedLabel}</span>}
        </div>
        <div className="metrics-multiples">
          <div className="metrics-multiples-header">
            <span />
            {MONITORED_SERVICES.map((s) => (
              <span key={s} className="metrics-multiples-service">
                {s}
              </span>
            ))}
          </div>
          {rows.map((row) => (
            <div className="metrics-multiples-row" key={row.label}>
              <span className="metrics-multiples-label">{row.label}</span>
              {MONITORED_SERVICES.map((service) => (
                <div key={service} className="metrics-multiples-cell">
                  <Sparkline samples={samplesFor(row.data, service)} width={90} height={28} tone={row.toneFor(service)} />
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
