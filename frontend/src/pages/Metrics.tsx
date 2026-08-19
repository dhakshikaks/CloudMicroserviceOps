import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
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
  getRequestRateRange,
  getRequestRateRangeByService,
  MONITORED_SERVICES,
  type RangeSeries,
} from "../services/api";
import { useFetchState } from "../hooks/useFetchState";
import { usePolling } from "../hooks/usePolling";
import { useTimeWindow } from "../context/TimeWindowContext";
import MetricsPanel, { type RuntimeMetrics } from "../components/MetricsPanel";
import Sparkline from "../components/charts/Sparkline";
import LineChart from "../components/charts/LineChart";
import MetricExplainer from "../components/MetricExplainer";

const POLL_INTERVAL_MS = 7000;
const TREND_POLL_INTERVAL_MS = 15000;

type Tone = "default" | "warning" | "critical";

function samplesFor(data: RangeSeries[] | null, service: string) {
  return data?.find((s) => s.metric.job === service)?.samples ?? [];
}

export default function Metrics() {
  const { timeWindow } = useTimeWindow();
  const metrics = useFetchState<RuntimeMetrics>();

  const requestRateTotal = useFetchState<RangeSeries[]>();
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
        getRequestRateRange(timeWindow),
        getRequestRateRangeByService(timeWindow),
        getErrorRateRangeByService(timeWindow),
        getLatencyP95RangeByService(timeWindow),
        getCpuUsageRangeByService(timeWindow),
        getMemoryUsageRangeByService(timeWindow),
      ])
        .then(([total, rr, er, lat, cpu, mem]) => {
          if (cancelled) return;
          requestRateTotal.run(Promise.resolve(total));
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
        return last !== undefined && last > 0.85 ? "critical" : "default";
      },
    },
    { label: "Memory", data: memoryHistory.data, toneFor: () => "default" },
  ];

  const totalSamples = requestRateTotal.data?.[0]?.samples ?? [];
  const totalNow = totalSamples.length > 0 ? totalSamples[totalSamples.length - 1].value : undefined;
  const updatedSecondsAgo = updatedAt ? Math.max(0, Math.round((Date.now() - updatedAt) / 1000)) : undefined;
  const updatedLabel = updatedSecondsAgo !== undefined ? `${updatedSecondsAgo}s ago` : "";

  type TableSortKey = "service" | "requestRate" | "errorRate" | "latencyP95" | "cpu" | "memory";
  const [tableSearch, setTableSearch] = useState("");
  const [tableSort, setTableSort] = useState<{ key: TableSortKey; dir: "asc" | "desc" }>({ key: "service", dir: "asc" });

  const tableRows = useMemo(() => {
    const rows = MONITORED_SERVICES.filter((s) => s.toLowerCase().includes(tableSearch.trim().toLowerCase())).map(
      (service) => ({
        service,
        requestRate: metrics.data?.requestRate[service],
        errorRate: metrics.data?.errorRate[service],
        latencyP95: metrics.data?.latencyP95[service],
        cpu: metrics.data?.cpu[service],
        memory: metrics.data?.memory[service],
      })
    );
    rows.sort((a, b) => {
      const { key, dir } = tableSort;
      const av = key === "service" ? a.service : a[key];
      const bv = key === "service" ? b.service : b[key];
      let cmp: number;
      if (typeof av === "string" || typeof bv === "string") {
        cmp = String(av ?? "").localeCompare(String(bv ?? ""));
      } else {
        cmp = (av ?? -Infinity) - (bv ?? -Infinity);
      }
      return dir === "asc" ? cmp : -cmp;
    });
    return rows;
  }, [metrics.data, tableSearch, tableSort]);

  function handleTableSort(key: TableSortKey) {
    setTableSort((prev) => (prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Metrics</h1>
      </div>

      <div className="dominant-chart">
        <div className="dominant-chart-head">
          <h2>Request rate — all services</h2>
          <div style={{ display: "flex", alignItems: "baseline", gap: "0.75rem" }}>
            {updatedLabel && <span className="last-updated">{updatedLabel}</span>}
            <span className="dominant-chart-value">{totalNow === undefined ? "—" : `${totalNow.toFixed(2)}/s`}</span>
          </div>
        </div>
        <LineChart samples={totalSamples} width={1200} height={220} yFormat={(v) => `${v.toFixed(1)}/s`} />
        <MetricExplainer
          text={
            totalNow === undefined
              ? "Aggregate request rate across all monitored services during the selected observation window."
              : `Services are currently handling ${totalNow.toFixed(2)} requests per second, summed across all monitored services in the selected ${timeWindow} window.`
          }
          source="Prometheus"
          windowLabel={timeWindow}
          updatedSecondsAgo={updatedSecondsAgo}
        />
      </div>

      <MetricsPanel metrics={metrics.data} loading={metrics.loading} error={metrics.error} />

      <section className="panel">
        <div className="panel-header-row">
          <h2 className="section-title">Per-service trends</h2>
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
                  <Sparkline samples={samplesFor(row.data, service)} width={84} height={26} tone={row.toneFor(service)} />
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel-header-row">
          <h2 className="section-title">Raw metrics — current snapshot</h2>
        </div>
        <div className="table-toolbar" style={{ marginBottom: "0.6rem" }}>
          <div className="table-search">
            <Search size={13} />
            <input type="text" placeholder="Search service…" value={tableSearch} onChange={(e) => setTableSearch(e.target.value)} />
          </div>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                {(
                  [
                    ["service", "Service"],
                    ["requestRate", "Req rate"],
                    ["errorRate", "Error rate"],
                    ["latencyP95", "P95"],
                    ["cpu", "CPU"],
                    ["memory", "Memory"],
                  ] as [TableSortKey, string][]
                ).map(([key, label]) => (
                  <th key={key} className="is-sortable" onClick={() => handleTableSort(key)}>
                    {label}
                    {tableSort.key === key && <span className="sort-arrow">{tableSort.dir === "asc" ? "↑" : "↓"}</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableRows.map((row) => (
                <tr key={row.service}>
                  <td>{row.service}</td>
                  <td>{row.requestRate === undefined ? "—" : `${row.requestRate.toFixed(2)}/s`}</td>
                  <td className={row.errorRate !== undefined && row.errorRate > 0 ? "cell-elevated" : undefined}>
                    {row.errorRate === undefined ? "—" : `${row.errorRate.toFixed(2)}/s`}
                  </td>
                  <td>{row.latencyP95 === undefined ? "—" : `${(row.latencyP95 * 1000).toFixed(0)}ms`}</td>
                  <td>{row.cpu === undefined ? "—" : `${(row.cpu * 100).toFixed(1)}%`}</td>
                  <td>{row.memory === undefined ? "—" : `${(row.memory / 1024 / 1024).toFixed(1)}MB`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
