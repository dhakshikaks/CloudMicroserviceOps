import { useState } from "react";
import { Copy, Download, FileJson, FileSpreadsheet, Printer } from "lucide-react";
import {
  getCpuUsageRange,
  getDependencyGraph,
  getErrorRateRange,
  getIncidentReport,
  getLatencyP95Range,
  getMetricsSnapshot,
  getNotifications,
  getPrometheusReachable,
  getRecentEvents,
  getRequestRateRange,
  getRootCauses,
  getServiceHealth,
  LIVE_WINDOW_MINUTES,
  MONITORED_SERVICES,
  type RangeSample,
  type TimeWindow,
} from "../services/api";
import { usePolling } from "../hooks/usePolling";
import { useFetchState } from "../hooks/useFetchState";
import { computeFailureRuns, fmtDurationMs } from "../lib/incidentAnalysis";
import { deriveServiceStatus } from "../lib/status";
import { downloadCsv, downloadJson, printReport, copyText } from "../services/reportExport";
import Sparkline from "../components/charts/Sparkline";
import type {
  DependencyGraphResponse,
  IncidentReport,
  NotificationRecord,
  RootCauseCandidate,
  ServiceEventRecord,
  ServiceHealthMap,
} from "../types";
import type { RuntimeMetrics } from "../components/MetricsPanel";

type ReportType = "incident" | "service" | "system-health" | "performance" | "event" | "dependency" | "availability" | "executive";
type DetailLevel = "summary" | "standard" | "detailed";

interface DataSourceToggles {
  prometheus: boolean;
  rca: boolean;
  dependencyGraph: boolean;
  eventStream: boolean;
  serviceHealth: boolean;
}

const REPORT_TYPES: { id: ReportType; title: string; desc: string; sources: string[] }[] = [
  { id: "incident", title: "Incident Report", desc: "Root cause, evidence, dependency path, timeline", sources: ["RCA Engine", "Event Stream"] },
  { id: "service", title: "Service Report", desc: "Health and dependency snapshot for every service", sources: ["Service Health", "Dependency Graph"] },
  { id: "system-health", title: "System Health Report", desc: "Service status and observability backend reachability", sources: ["Service Health", "Prometheus"] },
  { id: "performance", title: "Performance Report", desc: "CPU / memory / request / error / latency snapshot", sources: ["Prometheus"] },
  { id: "event", title: "Event Report", desc: "Recent event stream summary", sources: ["Event Stream"] },
  { id: "dependency", title: "Dependency Report", desc: "Service-to-service call volume, errors, latency", sources: ["Dependency Graph", "Prometheus"] },
  { id: "availability", title: "Availability Report", desc: "Instantaneous up/down state across all services", sources: ["Service Health"] },
  { id: "executive", title: "Executive Summary", desc: "One-page health, incident, and performance overview", sources: ["Service Health", "RCA Engine", "Prometheus", "Dependency Graph"] },
];

const REPORT_WINDOWS: { label: string; minutes: number }[] = [
  { label: "5m", minutes: 5 },
  { label: "15m", minutes: 15 },
  { label: "1h", minutes: 60 },
  { label: "6h", minutes: 360 },
  { label: "24h", minutes: 1440 },
  { label: "7d", minutes: 10080 },
];

const DATA_SOURCE_LABELS: { key: keyof DataSourceToggles; label: string }[] = [
  { key: "prometheus", label: "Prometheus" },
  { key: "rca", label: "RCA Engine" },
  { key: "dependencyGraph", label: "Dependency Graph" },
  { key: "eventStream", label: "Event Stream" },
  { key: "serviceHealth", label: "Service Health" },
];

function formatSources(sources: string[]): string {
  return sources.length <= 1 ? sources.join(", ") : `${sources[0]} +${sources.length - 1}`;
}

function clampToChartWindow(minutes: number): TimeWindow {
  if (minutes <= 5) return "5m";
  if (minutes <= 15) return "15m";
  if (minutes <= 60) return "1h";
  if (minutes <= 360) return "6h";
  return "24h";
}

function fmtRate(v: number | undefined): string {
  return v === undefined ? "—" : `${v.toFixed(2)} req/s`;
}
function fmtMs(v: number | undefined): string {
  return v === undefined ? "—" : `${(v * 1000).toFixed(0)} ms`;
}
function fmtPct(v: number | undefined): string {
  return v === undefined ? "—" : `${(v * 100).toFixed(1)}%`;
}
function fmtMb(v: number | undefined): string {
  return v === undefined ? "—" : `${(v / 1024 / 1024).toFixed(1)} MB`;
}
function sum(values: Record<string, number> | undefined): number | undefined {
  if (!values) return undefined;
  const nums = MONITORED_SERVICES.map((s) => values[s]).filter((v): v is number => v !== undefined);
  return nums.length === 0 ? undefined : nums.reduce((a, b) => a + b, 0);
}
function avg(values: Record<string, number> | undefined): number | undefined {
  if (!values) return undefined;
  const nums = MONITORED_SERVICES.map((s) => values[s]).filter((v): v is number => v !== undefined);
  return nums.length === 0 ? undefined : nums.reduce((a, b) => a + b, 0) / nums.length;
}

interface ReportSnapshot {
  generatedAt: string;
  windowMinutes: number;
  services: string[];
  health: ServiceHealthMap | null;
  graph: DependencyGraphResponse | null;
  metrics: RuntimeMetrics | null;
  rootCauses: RootCauseCandidate[] | null;
  events: ServiceEventRecord[] | null;
  notifications: NotificationRecord[] | null;
  incidentReport: IncidentReport | null;
  sparklines: { requestRate: RangeSample[]; errorRate: RangeSample[]; latencyP95: RangeSample[]; cpu: RangeSample[] } | null;
  dataSources: DataSourceToggles;
}

interface GeneratedReport {
  id: string;
  type: ReportType;
  createdAt: string;
  windowMinutes: number;
  services: string[];
  detailLevel: DetailLevel;
  status: "READY" | "NO_DATA";
  snapshot: ReportSnapshot;
}

function buildRecommendations(s: ReportSnapshot): string[] {
  const recs: string[] = [];
  if (s.rootCauses && s.rootCauses.length > 0) {
    const top = s.rootCauses[0];
    recs.push(`Investigate ${top.service} — top root-cause candidate at ${(top.score * 100).toFixed(0)}% confidence: ${top.reason}`);
  }
  const erroring = s.metrics ? s.services.filter((sv) => (s.metrics!.errorRate[sv] ?? 0) > 0) : [];
  if (erroring.length > 0) recs.push(`Review error handling in: ${erroring.join(", ")} — non-zero error rate at generation time.`);
  const failingEdges = (s.graph?.edges ?? []).filter((e) => e.failedCalls > 0);
  if (failingEdges.length > 0) {
    recs.push(`${failingEdges.length} dependency edge(s) show observed failures: ${failingEdges.map((e) => `${e.sourceService}→${e.targetService}`).join(", ")}.`);
  }
  const down = s.health ? s.services.filter((sv) => s.health![sv] === false) : [];
  if (down.length > 0) recs.push(`${down.join(", ")} reporting DOWN — verify process/container health.`);
  return recs;
}

export default function Reports() {
  // Ambient state - always polled, powers the selector grid's live stats and
  // the KPI overview, independent of whichever report was last generated.
  const health = useFetchState<ServiceHealthMap>();
  const graph = useFetchState<DependencyGraphResponse>();
  const metrics = useFetchState<RuntimeMetrics>();
  const rootCauses = useFetchState<RootCauseCandidate[]>();
  const events = useFetchState<ServiceEventRecord[]>();
  const notifications = useFetchState<NotificationRecord[]>();
  const prometheusUp = useFetchState<boolean>();

  usePolling(() => {
    health.run(getServiceHealth());
    graph.run(getDependencyGraph());
    metrics.run(getMetricsSnapshot());
    rootCauses.run(getRootCauses());
    events.run(getRecentEvents());
    notifications.run(getNotifications(1440));
    prometheusUp.run(getPrometheusReachable());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, 10000);

  // ---- Configuration ----
  const [activeType, setActiveType] = useState<ReportType>("incident");
  const [windowMinutes, setWindowMinutes] = useState(LIVE_WINDOW_MINUTES);
  const [selectedServices, setSelectedServices] = useState<Set<string>>(new Set(MONITORED_SERVICES));
  const [dataSources, setDataSources] = useState<DataSourceToggles>({
    prometheus: true,
    rca: true,
    dependencyGraph: true,
    eventStream: true,
    serviceHealth: true,
  });
  const [detailLevel, setDetailLevel] = useState<DetailLevel>("standard");

  const [reports, setReports] = useState<GeneratedReport[]>([]);
  const [selected, setSelected] = useState<GeneratedReport | null>(null);
  const [generating, setGenerating] = useState<ReportType | null>(null);
  const [copyLabel, setCopyLabel] = useState("Copy report");

  function toggleService(s: string) {
    setSelectedServices((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next.size === 0 ? new Set(MONITORED_SERVICES) : next;
    });
  }

  async function generate(type: ReportType) {
    setGenerating(type);
    try {
      const services = MONITORED_SERVICES.filter((s) => selectedServices.has(s));
      const incidentReport =
        type === "incident" || type === "executive" ? await getIncidentReport(windowMinutes).catch(() => null) : null;

      let sparklines: ReportSnapshot["sparklines"] = null;
      if (dataSources.prometheus && (type === "performance" || type === "executive")) {
        const cw = clampToChartWindow(windowMinutes);
        const [rr, er, lat, cpu] = await Promise.all([
          getRequestRateRange(cw),
          getErrorRateRange(cw),
          getLatencyP95Range(cw),
          getCpuUsageRange(cw),
        ]);
        sparklines = {
          requestRate: rr[0]?.samples ?? [],
          errorRate: er[0]?.samples ?? [],
          latencyP95: lat[0]?.samples ?? [],
          cpu: cpu[0]?.samples ?? [],
        };
      }

      const cutoff = Date.now() - windowMinutes * 60_000;
      const snapshot: ReportSnapshot = {
        generatedAt: new Date().toISOString(),
        windowMinutes,
        services,
        health: dataSources.serviceHealth ? health.data : null,
        graph: dataSources.dependencyGraph ? graph.data : null,
        metrics: dataSources.prometheus ? metrics.data : null,
        rootCauses: dataSources.rca ? rootCauses.data : null,
        events: dataSources.eventStream ? (events.data ?? []).filter((e) => new Date(e.timestamp).getTime() >= cutoff) : null,
        notifications: dataSources.eventStream ? (notifications.data ?? []).filter((n) => new Date(n.timestamp).getTime() >= cutoff) : null,
        incidentReport,
        sparklines,
        dataSources: { ...dataSources },
      };

      const status: GeneratedReport["status"] = type === "incident" && !incidentReport ? "NO_DATA" : "READY";
      const record: GeneratedReport = {
        id: `R-${type.toUpperCase()}-${Date.now()}`,
        type,
        createdAt: snapshot.generatedAt,
        windowMinutes,
        services,
        detailLevel,
        status,
        snapshot,
      };
      setReports((prev) => [record, ...prev].slice(0, 30));
      setSelected(record);
    } finally {
      setGenerating(null);
    }
  }

  function handleExportJson(r: GeneratedReport | null) {
    if (!r) return;
    downloadJson(`${r.id}.json`, r.snapshot);
  }

  function handleExportCsv(r: GeneratedReport | null) {
    if (!r) return;
    const s = r.snapshot;
    if (r.type === "event") {
      downloadCsv(`${r.id}.csv`, ["timestamp", "sourceService", "targetService", "operation", "status", "durationMs"], (s.events ?? []).map((e) => [e.timestamp, e.sourceService, e.targetService, e.operation, e.status, e.durationMs]));
    } else if (r.type === "dependency") {
      downloadCsv(`${r.id}.csv`, ["source", "target", "totalCalls", "failedCalls", "confidence"], (s.graph?.edges ?? []).map((e) => [e.sourceService, e.targetService, e.totalCalls, e.failedCalls, e.confidence]));
    } else if (r.type === "performance") {
      downloadCsv(`${r.id}.csv`, ["service", "requestRate", "errorRate", "latencyP95", "cpu", "memory"], s.services.map((sv) => [sv, s.metrics?.requestRate[sv], s.metrics?.errorRate[sv], s.metrics?.latencyP95[sv], s.metrics?.cpu[sv], s.metrics?.memory[sv]]));
    } else {
      downloadCsv(`${r.id}.csv`, ["service", "status", "requestRate", "errorRate", "p95"], s.services.map((sv) => [sv, s.health?.[sv] === undefined ? "UNKNOWN" : s.health![sv] ? "UP" : "DOWN", s.metrics?.requestRate[sv], s.metrics?.errorRate[sv], s.metrics?.latencyP95[sv]]));
    }
  }

  async function handleCopy(r: GeneratedReport | null) {
    if (!r) return;
    const s = r.snapshot;
    const upCount = s.health ? s.services.filter((sv) => s.health![sv]).length : null;
    const lines = [
      `CloudMicroserviceOps — ${r.type.replace("-", " ")} report`,
      `Generated: ${new Date(r.createdAt).toLocaleString()}`,
      `Window: last ${r.windowMinutes >= 1440 ? `${r.windowMinutes / 1440}d` : `${r.windowMinutes}m`}`,
      `Services: ${s.services.length} monitored${upCount !== null ? ` · ${upCount} healthy` : ""}`,
      `Requests: ${fmtRate(sum(s.metrics?.requestRate))} · Errors: ${fmtRate(sum(s.metrics?.errorRate))} · P95: ${fmtMs(avg(s.metrics?.latencyP95))}`,
      `Active incidents: ${s.rootCauses?.length ?? "—"}`,
    ];
    const ok = await copyText(lines.join("\n"));
    setCopyLabel(ok ? "Copied" : "Copy failed");
    setTimeout(() => setCopyLabel("Copy report"), 1600);
  }

  function lastGeneratedFor(type: ReportType): string | null {
    const found = reports.find((r) => r.type === type);
    return found ? found.createdAt : null;
  }

  function recordCountFor(type: ReportType): number | null {
    switch (type) {
      case "incident":
        return rootCauses.data ? rootCauses.data.length : null;
      case "event":
        return events.data ? events.data.length : null;
      case "dependency":
        return graph.data ? graph.data.edges.length : null;
      default:
        return MONITORED_SERVICES.length;
    }
  }

  function isSourceReady(type: ReportType): boolean {
    const meta = REPORT_TYPES.find((r) => r.id === type)!;
    return meta.sources.every((src) => {
      if (src === "Prometheus") return prometheusUp.data === true;
      if (src === "RCA Engine") return rootCauses.data !== null;
      if (src === "Dependency Graph") return graph.data !== null;
      if (src === "Event Stream") return events.data !== null;
      if (src === "Service Health") return health.data !== null;
      return true;
    });
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Report Center</h1>
        <p>Generated from live RCA, dependency graph, event stream, and Prometheus data — never fabricated.</p>
      </div>

      {/* 1. REPORT TYPE SELECTOR */}
      <section className="panel">
        <h2 className="section-title">Report type</h2>
        <div className="reports-generate-row">
          {REPORT_TYPES.map((rt) => {
            const lastGen = lastGeneratedFor(rt.id);
            const count = recordCountFor(rt.id);
            const ready = isSourceReady(rt.id);
            return (
              <button
                key={rt.id}
                type="button"
                className={`report-type-btn${activeType === rt.id ? " active" : ""}`}
                onClick={() => setActiveType(rt.id)}
              >
                <span className="report-type-btn-title">{rt.title}</span>
                <span className="report-type-btn-desc">{rt.desc}</span>
                <span className="report-type-btn-meta">
                  <span className="report-type-btn-meta-row">
                    <span>Sources</span>
                    <span>{formatSources(rt.sources)}</span>
                  </span>
                  <span className="report-type-btn-meta-row">
                    <span>Last generated</span>
                    <span>{lastGen ? new Date(lastGen).toLocaleTimeString() : "Never"}</span>
                  </span>
                  <span className="report-type-btn-meta-row">
                    <span>Status</span>
                    <span>{ready ? "● AVAILABLE" : "— PENDING"}</span>
                  </span>
                  <span className="report-type-btn-meta-row">
                    <span>Records</span>
                    <span>{count === null ? "—" : count}</span>
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* 2. REPORT CONFIGURATION */}
      <section className="panel">
        <h2 className="section-title">Report configuration</h2>
        <div className="report-config-grid" style={{ marginTop: "0.7rem" }}>
          <div>
            <span className="report-config-group-label">Time window</span>
            <div className="config-chip-row">
              {REPORT_WINDOWS.map((w) => (
                <button
                  key={w.label}
                  type="button"
                  className={`config-chip${windowMinutes === w.minutes ? " active" : ""}`}
                  onClick={() => setWindowMinutes(w.minutes)}
                >
                  {w.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="report-config-group-label">Services ({selectedServices.size}/{MONITORED_SERVICES.length})</span>
            <div className="config-chip-row">
              <button
                type="button"
                className={`config-chip${selectedServices.size === MONITORED_SERVICES.length ? " active" : ""}`}
                onClick={() => setSelectedServices(new Set(MONITORED_SERVICES))}
              >
                All services
              </button>
              {MONITORED_SERVICES.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`config-chip${selectedServices.has(s) ? " active" : ""}`}
                  onClick={() => toggleService(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="report-config-group-label">Data sources</span>
            <div className="config-checkbox-list">
              {DATA_SOURCE_LABELS.map((d) => (
                <label key={d.key}>
                  <input
                    type="checkbox"
                    checked={dataSources[d.key]}
                    onChange={(e) => setDataSources((prev) => ({ ...prev, [d.key]: e.target.checked }))}
                  />
                  {d.label}
                </label>
              ))}
            </div>
          </div>

          <div>
            <span className="report-config-group-label">Report detail</span>
            <div className="segmented-control" role="tablist">
              {(["summary", "standard", "detailed"] as DetailLevel[]).map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  role="tab"
                  aria-selected={detailLevel === lvl}
                  className={`segmented-control-item${detailLevel === lvl ? " active" : ""}`}
                  onClick={() => setDetailLevel(lvl)}
                >
                  {lvl}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="report-generate-action">
          <button type="button" className="report-generate-btn" disabled={generating !== null} onClick={() => generate(activeType)}>
            {generating === activeType ? "Generating…" : "Generate report"}
          </button>
          <span className="report-generate-note">
            {REPORT_TYPES.find((r) => r.id === activeType)?.title} · window{" "}
            {windowMinutes >= 1440 ? `${windowMinutes / 1440}d` : `${windowMinutes}m`} · {selectedServices.size} service
            {selectedServices.size === 1 ? "" : "s"} · {detailLevel}
          </span>
        </div>
      </section>

      {/* 3. REPORT SUMMARY */}
      {selected && (
        <section className="panel">
          <h2 className="section-title">Report overview</h2>
          <div className="summary-row" style={{ marginTop: "0.6rem" }}>
            <div className="summary-item">
              <span className="summary-label">Services monitored</span>
              <span className="summary-value mono">{selected.snapshot.services.length}</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Services healthy</span>
              <span className="summary-value mono">
                {selected.snapshot.health ? selected.snapshot.services.filter((s) => selected.snapshot.health![s]).length : "—"}
              </span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Services degraded</span>
              <span className="summary-value mono">
                {selected.snapshot.health
                  ? selected.snapshot.services.filter((s) => selected.snapshot.health![s] === false).length
                  : "—"}
              </span>
            </div>
            <div className={`summary-item${(selected.snapshot.rootCauses?.length ?? 0) > 0 ? " tone-critical" : ""}`}>
              <span className="summary-label">Active incidents</span>
              <span className={`summary-value mono${(selected.snapshot.rootCauses?.length ?? 0) > 0 ? " tone-critical" : ""}`}>
                {selected.snapshot.rootCauses ? selected.snapshot.rootCauses.length : "—"}
              </span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Total incidents</span>
              <span className="summary-value mono">{selected.snapshot.events ? computeFailureRuns(selected.snapshot.events).length : "—"}</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Requests/sec</span>
              <span className="summary-value mono">{fmtRate(sum(selected.snapshot.metrics?.requestRate))}</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Error rate</span>
              <span className="summary-value mono">{fmtRate(sum(selected.snapshot.metrics?.errorRate))}</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">P95 latency</span>
              <span className="summary-value mono">{fmtMs(avg(selected.snapshot.metrics?.latencyP95))}</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Dependencies</span>
              <span className="summary-value mono">{selected.snapshot.graph ? selected.snapshot.graph.edges.length : "—"}</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Events detected</span>
              <span className="summary-value mono">{selected.snapshot.events ? selected.snapshot.events.length : "—"}</span>
            </div>
          </div>
        </section>
      )}

      {/* 4 + 6. REPORT PREVIEW + DETAILS PANEL */}
      <section className="panel">
        <h2 className="section-title">Report preview</h2>
        {!selected ? (
          <p className="state-message">Configure and generate a report above to see a full preview here.</p>
        ) : (
          <>
            <ReportPreview report={selected} />
            <div className="report-actions-bar">
              <button type="button" onClick={printReport}>
                <Printer size={13} /> Export PDF
              </button>
              <button type="button" onClick={() => handleExportJson(selected)}>
                <FileJson size={13} /> Export JSON
              </button>
              <button type="button" onClick={() => handleExportCsv(selected)}>
                <FileSpreadsheet size={13} /> Export CSV
              </button>
              <button type="button" onClick={() => handleCopy(selected)}>
                <Copy size={13} /> {copyLabel}
              </button>
              <button type="button" onClick={() => handleExportJson(selected)}>
                <Download size={13} /> Export current view
              </button>
            </div>
          </>
        )}
      </section>

      {/* 5. RECENT REPORTS */}
      <section className="panel">
        <h2 className="section-title">Recent reports ({reports.length})</h2>
        <div className="table-wrap" style={{ marginTop: "0.6rem" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Report</th>
                <th>Type</th>
                <th>Generated</th>
                <th>Window</th>
                <th>Services</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {reports.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <div className="structured-empty-state" style={{ margin: "0.4rem 0" }}>
                      <div className="structured-empty-state-title">No reports generated this session</div>
                      <p className="structured-empty-state-body">
                        Pick a report type above and click Generate report — reports appear here as a running history.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                reports.map((r) => (
                  <tr key={r.id} className={`is-selectable${selected?.id === r.id ? " active" : ""}`} onClick={() => setSelected(r)}>
                    <td className="mono">#{r.id.slice(0, 16)}</td>
                    <td className="cell-muted">{REPORT_TYPES.find((rt) => rt.id === r.type)?.title ?? r.type}</td>
                    <td className="cell-muted">{new Date(r.createdAt).toLocaleString()}</td>
                    <td>{r.windowMinutes >= 1440 ? `${r.windowMinutes / 1440}d` : `${r.windowMinutes}m`}</td>
                    <td>{r.services.length} service{r.services.length === 1 ? "" : "s"}</td>
                    <td className={r.status === "NO_DATA" ? "cell-elevated" : undefined}>{r.status === "READY" ? "Ready" : "No data"}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: "flex", gap: "0.35rem" }}>
                        <button type="button" className="incident-action-btn" onClick={() => setSelected(r)}>
                          View
                        </button>
                        <button type="button" className="incident-action-btn" disabled={generating !== null} onClick={() => generate(r.type)}>
                          Regenerate
                        </button>
                        <button type="button" className="incident-action-btn" onClick={() => handleExportJson(r)}>
                          Export
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function ReportPreview({ report }: { report: GeneratedReport }) {
  const s = report.snapshot;
  const upCount = s.health ? s.services.filter((sv) => s.health![sv]).length : null;
  const openByDefault = report.detailLevel === "detailed";
  const activeIncidents = s.rootCauses?.length ?? 0;
  const criticalNotifs = s.notifications?.filter((n) => n.severity === "CRITICAL").length ?? 0;
  const warningNotifs = s.notifications?.filter((n) => n.severity === "WARNING").length ?? 0;

  return (
    <div className="report-preview">
      <div className="report-preview-masthead">
        <h2>CloudMicroserviceOps — {REPORT_TYPES.find((r) => r.id === report.type)?.title ?? report.type}</h2>
        <div className="report-preview-meta">
          Report ID: {report.id}
          <br />
          Generated: {new Date(report.createdAt).toLocaleString()}
        </div>
      </div>

      <div className="report-preview-section">
        <dl className="report-preview-kv">
          <dt>Window</dt>
          <dd>Last {report.windowMinutes >= 1440 ? `${report.windowMinutes / 1440} day${report.windowMinutes > 1440 ? "s" : ""}` : `${report.windowMinutes} minutes`}</dd>
          <dt>Services</dt>
          <dd>{s.services.length} monitored{upCount !== null ? ` · ${upCount} healthy` : ""}</dd>
          <dt>Requests</dt>
          <dd>{fmtRate(sum(s.metrics?.requestRate))}</dd>
          <dt>Error rate</dt>
          <dd>{fmtRate(sum(s.metrics?.errorRate))}</dd>
          <dt>P95 latency</dt>
          <dd>{fmtMs(avg(s.metrics?.latencyP95))}</dd>
        </dl>
      </div>

      {report.status === "NO_DATA" && (
        <div className="report-preview-section">
          <p>No active incident was detected in the {report.windowMinutes}-minute window at generation time. This report reflects a healthy system state.</p>
        </div>
      )}

      <div className="report-preview-section">
        <h3>Executive summary</h3>
        <p>
          At {new Date(report.createdAt).toLocaleString()}, {upCount === null ? "an unknown number of" : upCount} of {s.services.length}{" "}
          monitored services were reporting healthy. {activeIncidents} active incident{activeIncidents === 1 ? "" : "s"} detected
          {criticalNotifs + warningNotifs > 0 ? `, alongside ${criticalNotifs} critical and ${warningNotifs} warning signal(s) in the reporting window` : ""}.
          Aggregate request rate was {fmtRate(sum(s.metrics?.requestRate))} with an error rate of {fmtRate(sum(s.metrics?.errorRate))} and average
          P95 latency of {fmtMs(avg(s.metrics?.latencyP95))}.
        </p>
      </div>

      {report.detailLevel !== "summary" && (
        <>
          <CollapsibleSection title="Service Health" open={openByDefault}>
            <ServiceHealthTable snapshot={s} />
          </CollapsibleSection>

          <CollapsibleSection title="Performance Metrics" open={openByDefault}>
            <PerformanceSection snapshot={s} />
          </CollapsibleSection>

          <CollapsibleSection title="Incident Analysis / Root Cause Analysis" open={openByDefault}>
            <IncidentAnalysisSection snapshot={s} />
          </CollapsibleSection>

          <CollapsibleSection title="Dependency Analysis" open={openByDefault}>
            <DependencyAnalysisSection snapshot={s} />
          </CollapsibleSection>

          <CollapsibleSection title="Event Timeline" open={openByDefault}>
            <EventTimelineSection snapshot={s} />
          </CollapsibleSection>

          <CollapsibleSection title="Recommendations" open={openByDefault}>
            <RecommendationsSection snapshot={s} />
          </CollapsibleSection>
        </>
      )}
    </div>
  );
}

function CollapsibleSection({ title, open, children }: { title: string; open: boolean; children: React.ReactNode }) {
  return (
    <details className="report-section-collapsible" open={open}>
      <summary>{title}</summary>
      <div className="report-section-collapsible-body">{children}</div>
    </details>
  );
}

function ServiceHealthTable({ snapshot: s }: { snapshot: ReportSnapshot }) {
  if (!s.health && !s.metrics) {
    return (
      <div className="structured-empty-state">
        <div className="structured-empty-state-title">Service Health excluded</div>
        <p className="structured-empty-state-body">The "Service Health" data source was disabled when this report was generated.</p>
      </div>
    );
  }
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>Service</th>
            <th>Status</th>
            <th>Request Rate</th>
            <th>Error Rate</th>
            <th>P95</th>
            <th>CPU</th>
            <th>Memory</th>
          </tr>
        </thead>
        <tbody>
          {s.services.map((sv) => {
            const status = deriveServiceStatus(s.health?.[sv], s.metrics?.errorRate[sv]);
            return (
              <tr key={sv}>
                <td className="mono">{sv}</td>
                <td className="mono">{status}</td>
                <td>{fmtRate(s.metrics?.requestRate[sv])}</td>
                <td className={s.metrics?.errorRate[sv] ? "cell-elevated" : undefined}>{fmtRate(s.metrics?.errorRate[sv])}</td>
                <td>{fmtMs(s.metrics?.latencyP95[sv])}</td>
                <td>{fmtPct(s.metrics?.cpu[sv])}</td>
                <td>{fmtMb(s.metrics?.memory[sv])}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function PerformanceSection({ snapshot: s }: { snapshot: ReportSnapshot }) {
  if (!s.metrics) {
    return (
      <div className="structured-empty-state">
        <div className="structured-empty-state-title">Performance data excluded</div>
        <p className="structured-empty-state-body">The "Prometheus" data source was disabled when this report was generated.</p>
      </div>
    );
  }
  return (
    <>
      {s.sparklines && (
        <div className="report-sparkline-grid" style={{ marginBottom: "0.9rem" }}>
          <div className="report-sparkline-cell">
            <span className="report-sparkline-label">Request rate</span>
            <Sparkline samples={s.sparklines.requestRate} width={140} height={30} />
            <span className="report-sparkline-value">{fmtRate(sum(s.metrics.requestRate))}</span>
          </div>
          <div className="report-sparkline-cell">
            <span className="report-sparkline-label">Error rate</span>
            <Sparkline samples={s.sparklines.errorRate} width={140} height={30} tone={sum(s.metrics.errorRate) ? "critical" : "default"} />
            <span className="report-sparkline-value">{fmtRate(sum(s.metrics.errorRate))}</span>
          </div>
          <div className="report-sparkline-cell">
            <span className="report-sparkline-label">P95 latency</span>
            <Sparkline samples={s.sparklines.latencyP95} width={140} height={30} />
            <span className="report-sparkline-value">{fmtMs(avg(s.metrics.latencyP95))}</span>
          </div>
          <div className="report-sparkline-cell">
            <span className="report-sparkline-label">CPU</span>
            <Sparkline samples={s.sparklines.cpu} width={140} height={30} />
            <span className="report-sparkline-value">{fmtPct(avg(s.metrics.cpu))}</span>
          </div>
        </div>
      )}
      <dl className="report-preview-kv">
        <dt>P50 latency</dt>
        <dd>—</dd>
        <dt>P95 latency</dt>
        <dd>{fmtMs(avg(s.metrics.latencyP95))}</dd>
        <dt>P99 latency</dt>
        <dd>—</dd>
        <dt>Memory (avg)</dt>
        <dd>{fmtMb(avg(s.metrics.memory))}</dd>
      </dl>
      <p className="report-note">P50/P99 not exposed by the current metrics backend — only P95 is tracked.</p>
    </>
  );
}

function IncidentAnalysisSection({ snapshot: s }: { snapshot: ReportSnapshot }) {
  const top = s.incidentReport;
  const hasCandidate = s.rootCauses && s.rootCauses.length > 0;
  if (!top && !hasCandidate) {
    return (
      <div className="rca-clean-state tone-good">
        <div className="rca-state-label tone-good">No incidents detected</div>
        <p className="rca-highlight-reason">No root-cause candidates in the {s.windowMinutes}-minute reporting window.</p>
      </div>
    );
  }
  return (
    <dl className="report-preview-kv">
      <dt>Affected service</dt>
      <dd>{top?.rootCauseService ?? s.rootCauses?.[0]?.service ?? "—"}</dd>
      <dt>Suspected root cause</dt>
      <dd>{top?.reason ?? s.rootCauses?.[0]?.reason ?? "—"}</dd>
      <dt>Dependency involved</dt>
      <dd>{top && top.relatedEdges.length > 0 ? top.relatedEdges.map((e) => `${e.sourceService}→${e.targetService}`).join(", ") : "—"}</dd>
      <dt>First detected</dt>
      <dd>{top && top.timeline.length > 0 ? new Date(top.timeline[0].timestamp).toLocaleString() : "—"}</dd>
      <dt>Duration</dt>
      <dd>{top && top.timeline.length > 0 ? fmtDurationMs(Date.now() - new Date(top.timeline[0].timestamp).getTime()) : "—"}</dd>
      <dt>Evidence</dt>
      <dd>{top ? `${top.failureCount} failure event(s) observed` : "—"}</dd>
      <dt>Impact</dt>
      <dd>{top ? `${top.affectedDownstreamServices.length} downstream service(s)` : "—"}</dd>
    </dl>
  );
}

function DependencyAnalysisSection({ snapshot: s }: { snapshot: ReportSnapshot }) {
  if (!s.graph) {
    return (
      <div className="structured-empty-state">
        <div className="structured-empty-state-title">Dependency data excluded</div>
        <p className="structured-empty-state-body">The "Dependency Graph" data source was disabled when this report was generated.</p>
      </div>
    );
  }
  if (s.graph.edges.length === 0) {
    return (
      <div className="structured-empty-state">
        <div className="structured-empty-state-title">No dependencies observed</div>
        <p className="structured-empty-state-body">No service-to-service calls have been traced yet.</p>
      </div>
    );
  }
  const inbound = new Map<string, number>();
  s.graph.edges.forEach((e) => inbound.set(e.targetService, (inbound.get(e.targetService) ?? 0) + 1));
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>Service → Dependency</th>
            <th>Requests</th>
            <th>Errors</th>
            <th>Latency</th>
          </tr>
        </thead>
        <tbody>
          {s.graph.edges.map((e) => {
            const unambiguous = (inbound.get(e.targetService) ?? 0) === 1;
            return (
              <tr key={`${e.sourceService}-${e.targetService}`}>
                <td className="mono">{e.sourceService} → {e.targetService}</td>
                <td>{e.totalCalls} calls</td>
                <td className={e.failedCalls > 0 ? "cell-elevated" : undefined}>{e.failedCalls}</td>
                <td>{unambiguous ? fmtMs(s.metrics?.latencyP95[e.targetService]) : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function EventTimelineSection({ snapshot: s }: { snapshot: ReportSnapshot }) {
  if (!s.events) {
    return (
      <div className="structured-empty-state">
        <div className="structured-empty-state-title">Event stream excluded</div>
        <p className="structured-empty-state-body">The "Event Stream" data source was disabled when this report was generated.</p>
      </div>
    );
  }
  if (s.events.length === 0) {
    return (
      <div className="structured-empty-state">
        <div className="structured-empty-state-title">No events in this window</div>
        <p className="structured-empty-state-body">No service-call events fall within the selected reporting window.</p>
      </div>
    );
  }
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>Time</th>
            <th>Service</th>
            <th>Event</th>
            <th>Source</th>
            <th>Result</th>
          </tr>
        </thead>
        <tbody>
          {s.events.slice(0, 30).map((e) => (
            <tr key={e.eventId}>
              <td className="cell-muted">{new Date(e.timestamp).toLocaleString()}</td>
              <td className="mono">{e.targetService}</td>
              <td>{e.operation}</td>
              <td className="mono">{e.sourceService}</td>
              <td className={e.status !== "SUCCESS" ? "cell-elevated" : undefined}>{e.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RecommendationsSection({ snapshot: s }: { snapshot: ReportSnapshot }) {
  const recs = buildRecommendations(s);
  if (recs.length === 0) {
    return (
      <div className="structured-empty-state">
        <div className="structured-empty-state-title">No anomalies detected</div>
        <p className="structured-empty-state-body">System was nominal at generation time — no recommendations to surface.</p>
      </div>
    );
  }
  return (
    <ul className="report-preview-list">
      {recs.map((r) => (
        <li key={r}>{r}</li>
      ))}
    </ul>
  );
}
