import { Fragment, useState } from "react";
import { Copy, Download, FileJson, FileSpreadsheet, Printer } from "lucide-react";
import {
  getDependencyGraph,
  getCpuUsage,
  getErrorRate,
  getIncidentReport,
  getLatencyP95,
  getMemoryUsage,
  getRecentEvents,
  getRequestRate,
  getServiceHealth,
  LIVE_WINDOW_MINUTES,
  MONITORED_SERVICES,
} from "../services/api";
import { downloadCsv, downloadJson, printReport, copyText } from "../services/reportExport";
import type { DependencyGraphResponse, IncidentReport, ServiceEventRecord, ServiceHealthMap, ServiceMetrics } from "../types";

type ReportType = "incident" | "service" | "system-health" | "performance" | "event";

const REPORT_TYPES: { id: ReportType; title: string; desc: string }[] = [
  { id: "incident", title: "Incident report", desc: "Root cause, evidence, dependency analysis, timeline" },
  { id: "service", title: "Service report", desc: "Health and dependency snapshot for every monitored service" },
  { id: "system-health", title: "System health report", desc: "Service status and observability backend reachability" },
  { id: "performance", title: "Performance report", desc: "CPU / memory / request / error / latency snapshot" },
  { id: "event", title: "Event report", desc: "Recent event stream summary" },
];

interface ServicePayload {
  generatedAt: string;
  health: ServiceHealthMap;
  graph: DependencyGraphResponse;
}

interface PerformancePayload {
  generatedAt: string;
  cpu: ServiceMetrics;
  memory: ServiceMetrics;
  requestRate: ServiceMetrics;
  errorRate: ServiceMetrics;
  latencyP95: ServiceMetrics;
}

interface EventPayload {
  generatedAt: string;
  events: ServiceEventRecord[];
}

type ReportPayload = IncidentReport | ServicePayload | PerformancePayload | EventPayload | null;

interface GeneratedReport {
  id: string;
  type: ReportType;
  createdAt: string;
  status: "READY" | "NO_DATA";
  payload: ReportPayload;
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

export default function Reports() {
  const [reports, setReports] = useState<GeneratedReport[]>([]);
  const [selected, setSelected] = useState<GeneratedReport | null>(null);
  const [generating, setGenerating] = useState<ReportType | null>(null);
  const [activeType, setActiveType] = useState<ReportType>("incident");
  const [copyLabel, setCopyLabel] = useState("Copy report ID");

  async function generate(type: ReportType) {
    setGenerating(type);
    try {
      let record: GeneratedReport;
      if (type === "incident") {
        const report = await getIncidentReport(LIVE_WINDOW_MINUTES);
        record = report
          ? { id: report.reportId, type, createdAt: report.generatedAt, status: "READY", payload: report }
          : { id: `R-NODATA-${Date.now()}`, type, createdAt: new Date().toISOString(), status: "NO_DATA", payload: null };
      } else if (type === "service" || type === "system-health") {
        const [health, graph] = await Promise.all([getServiceHealth(), getDependencyGraph()]);
        const payload: ServicePayload = { generatedAt: new Date().toISOString(), health, graph };
        record = { id: `R-${type.toUpperCase()}-${Date.now()}`, type, createdAt: payload.generatedAt, status: "READY", payload };
      } else if (type === "performance") {
        const [cpu, memory, requestRate, errorRate, latencyP95] = await Promise.all([
          getCpuUsage(),
          getMemoryUsage(),
          getRequestRate(),
          getErrorRate(),
          getLatencyP95(),
        ]);
        const payload: PerformancePayload = { generatedAt: new Date().toISOString(), cpu, memory, requestRate, errorRate, latencyP95 };
        record = { id: `R-PERF-${Date.now()}`, type, createdAt: payload.generatedAt, status: "READY", payload };
      } else {
        const events = await getRecentEvents();
        const payload: EventPayload = { generatedAt: new Date().toISOString(), events };
        record = { id: `R-EVENT-${Date.now()}`, type, createdAt: payload.generatedAt, status: "READY", payload };
      }
      setReports((prev) => [record, ...prev].slice(0, 20));
      setSelected(record);
    } finally {
      setGenerating(null);
    }
  }

  function handleExportJson() {
    if (!selected) return;
    downloadJson(`${selected.id}.json`, selected.payload);
  }

  function handleExportCsv() {
    if (!selected || !selected.payload) return;
    if (selected.type === "incident") {
      const p = selected.payload as IncidentReport;
      downloadCsv(
        `${selected.id}-timeline.csv`,
        ["timestamp", "sourceService", "targetService", "operation", "status", "durationMs"],
        p.timeline.map((e) => [e.timestamp, e.sourceService, e.targetService, e.operation, e.status, e.durationMs])
      );
    } else if (selected.type === "event") {
      const p = selected.payload as EventPayload;
      downloadCsv(
        `${selected.id}.csv`,
        ["timestamp", "sourceService", "targetService", "operation", "status", "durationMs"],
        p.events.map((e) => [e.timestamp, e.sourceService, e.targetService, e.operation, e.status, e.durationMs])
      );
    } else if (selected.type === "performance") {
      const p = selected.payload as PerformancePayload;
      downloadCsv(
        `${selected.id}.csv`,
        ["service", "requestRate", "errorRate", "latencyP95", "cpu", "memory"],
        MONITORED_SERVICES.map((s) => [s, p.requestRate[s], p.errorRate[s], p.latencyP95[s], p.cpu[s], p.memory[s]])
      );
    } else {
      const p = selected.payload as ServicePayload;
      downloadCsv(
        `${selected.id}.csv`,
        ["service", "status"],
        MONITORED_SERVICES.map((s) => [s, p.health[s] === undefined ? "UNKNOWN" : p.health[s] ? "UP" : "DOWN"])
      );
    }
  }

  async function handleCopyId() {
    if (!selected) return;
    const ok = await copyText(selected.id);
    setCopyLabel(ok ? "Copied" : "Copy failed");
    setTimeout(() => setCopyLabel("Copy report ID"), 1600);
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Report Center</h1>
        <p>Generated from live RCA, dependency graph, event stream, and Prometheus data — never fabricated.</p>
      </div>

      <section className="panel">
        <h2 className="section-title">Generate report</h2>
        <div className="reports-generate-row">
          {REPORT_TYPES.map((rt) => (
            <button
              key={rt.id}
              type="button"
              className={`report-type-btn${activeType === rt.id ? " active" : ""}`}
              onClick={() => setActiveType(rt.id)}
            >
              <span className="report-type-btn-title">{rt.title}</span>
              <span className="report-type-btn-desc">{rt.desc}</span>
            </button>
          ))}
        </div>
        <div className="report-generate-action">
          <button
            type="button"
            className="report-generate-btn"
            disabled={generating !== null}
            onClick={() => generate(activeType)}
          >
            {generating === activeType ? "Generating…" : "Generate report"}
          </button>
          <span className="report-generate-note">Window: {LIVE_WINDOW_MINUTES}m live · Source: RCA Engine / Prometheus / Event Stream</span>
        </div>
      </section>

      <section className="panel">
        <h2 className="section-title">Recent reports ({reports.length})</h2>
        {reports.length === 0 ? (
          <p className="state-message">No reports generated yet this session.</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Report ID</th>
                  <th>Type</th>
                  <th>Created</th>
                  <th>Status</th>
                  <th>Preview</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((r) => (
                  <tr key={r.id} className="is-selectable" onClick={() => setSelected(r)}>
                    <td>#{r.id.slice(0, 14)}</td>
                    <td className="cell-muted">{r.type}</td>
                    <td className="cell-muted">{new Date(r.createdAt).toLocaleString()}</td>
                    <td className={r.status === "NO_DATA" ? "cell-elevated" : undefined}>{r.status}</td>
                    <td>
                      <button
                        type="button"
                        className="panel-header-link"
                        style={{ background: "none", border: "none", cursor: "pointer" }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelected(r);
                        }}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel">
        <h2 className="section-title">Report preview</h2>
        {!selected ? (
          <p className="state-message">Generate a report above to see a full preview here.</p>
        ) : (
          <>
            <ReportPreview report={selected} />
            <div className="report-actions-bar">
              <button type="button" onClick={printReport}>
                <Printer size={13} /> Print / Save as PDF
              </button>
              <button type="button" onClick={handleExportJson}>
                <FileJson size={13} /> Download JSON
              </button>
              <button type="button" onClick={handleExportCsv}>
                <FileSpreadsheet size={13} /> Download CSV
              </button>
              <button type="button" onClick={handleCopyId}>
                <Copy size={13} /> {copyLabel}
              </button>
              <button type="button" onClick={handleExportJson}>
                <Download size={13} /> Export current view
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function ReportPreview({ report }: { report: GeneratedReport }) {
  return (
    <div className="report-preview">
      <div className="report-preview-masthead">
        <h2>CloudMicroserviceOps — {report.type.replace("-", " ")} report</h2>
        <div className="report-preview-meta">
          Report ID: {report.id}
          <br />
          Generated: {new Date(report.createdAt).toLocaleString()}
        </div>
      </div>

      {report.status === "NO_DATA" && (
        <div className="report-preview-section">
          <p>No active incident was detected in the {LIVE_WINDOW_MINUTES}-minute live window at generation time. This report reflects a healthy system state — there is no root cause to report.</p>
        </div>
      )}

      {report.status === "READY" && report.type === "incident" && <IncidentReportBody report={report.payload as IncidentReport} />}
      {report.status === "READY" && (report.type === "service" || report.type === "system-health") && (
        <ServiceReportBody payload={report.payload as ServicePayload} />
      )}
      {report.status === "READY" && report.type === "performance" && <PerformanceReportBody payload={report.payload as PerformancePayload} />}
      {report.status === "READY" && report.type === "event" && <EventReportBody payload={report.payload as EventPayload} />}
    </div>
  );
}

function IncidentReportBody({ report }: { report: IncidentReport }) {
  return (
    <>
      <div className="report-preview-section">
        <h3>Executive summary</h3>
        <p>
          Root-cause analysis identified <strong>{report.rootCauseService}</strong> as the most likely origin of the current
          incident, with a confidence score of {(report.confidence * 100).toFixed(0)}%. {report.failureCount} failure event
          {report.failureCount === 1 ? " was" : "s were"} observed, affecting {report.affectedDownstreamServices.length} downstream
          service{report.affectedDownstreamServices.length === 1 ? "" : "s"}.
        </p>
      </div>
      <div className="report-preview-section">
        <h3>System impact</h3>
        <dl className="report-preview-kv">
          <dt>Root cause service</dt>
          <dd>{report.rootCauseService}</dd>
          <dt>Affected services</dt>
          <dd>{report.affectedDownstreamServices.join(", ") || "none"}</dd>
          <dt>Failure count</dt>
          <dd>{report.failureCount}</dd>
          <dt>Incident ID</dt>
          <dd>{report.incidentId.slice(0, 12)}</dd>
        </dl>
      </div>
      <div className="report-preview-section">
        <h3>Root cause</h3>
        <p>{report.reason}</p>
      </div>
      <div className="report-preview-section">
        <h3>Dependency analysis</h3>
        <ul className="report-preview-list">
          {report.relatedEdges.map((e) => (
            <li key={`${e.sourceService}-${e.targetService}`}>
              {e.sourceService} → {e.targetService}: {e.totalCalls} calls, {e.failedCalls} failed ({Math.round(e.confidence * 100)}% confidence)
            </li>
          ))}
        </ul>
      </div>
      <div className="report-preview-section">
        <h3>Incident timeline</h3>
        {report.timeline.map((e) => (
          <div className="report-preview-timeline-row" key={e.eventId}>
            <span>{new Date(e.timestamp).toLocaleTimeString()}</span>
            <span>
              {e.sourceService} → {e.targetService} · {e.operation}
            </span>
            <span>{e.status}</span>
          </div>
        ))}
      </div>
      <div className="report-preview-section">
        <h3>Evidence</h3>
        <ul className="report-preview-list">
          <li>{report.failureCount} failure event(s) observed in the reporting window.</li>
          <li>Root-cause scorer reasoning: {report.reason}</li>
          <li>{report.relatedEdges.length} dependency edge(s) examined during analysis.</li>
        </ul>
      </div>
      <div className="report-preview-section">
        <h3>Recovery</h3>
        <p>
          This report reflects the state of the system at generation time. Recovery is confirmed when a subsequent Incident
          Center check shows no active root-cause candidate for {report.rootCauseService} across a full observation window.
        </p>
      </div>
    </>
  );
}

function ServiceReportBody({ payload }: { payload: ServicePayload }) {
  return (
    <>
      <div className="report-preview-section">
        <h3>Service status</h3>
        <dl className="report-preview-kv">
          {MONITORED_SERVICES.map((s) => (
            <Fragment key={s}>
              <dt>{s}</dt>
              <dd>{payload.health[s] === undefined ? "UNKNOWN" : payload.health[s] ? "UP" : "DOWN"}</dd>
            </Fragment>
          ))}
        </dl>
      </div>
      <div className="report-preview-section">
        <h3>Dependency graph</h3>
        <ul className="report-preview-list">
          {payload.graph.edges.map((e) => (
            <li key={`${e.sourceService}-${e.targetService}`}>
              {e.sourceService} → {e.targetService}: {e.totalCalls} calls, {e.failedCalls} failed
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

function PerformanceReportBody({ payload }: { payload: PerformancePayload }) {
  return (
    <div className="report-preview-section">
      <h3>Performance snapshot</h3>
      <dl className="report-preview-kv">
        {MONITORED_SERVICES.map((s) => (
          <Fragment key={s}>
            <dt>{s}</dt>
            <dd>
              {fmtRate(payload.requestRate[s])} · err {fmtRate(payload.errorRate[s])} · P95 {fmtMs(payload.latencyP95[s])} · CPU{" "}
              {fmtPct(payload.cpu[s])} · MEM {fmtMb(payload.memory[s])}
            </dd>
          </Fragment>
        ))}
      </dl>
    </div>
  );
}

function EventReportBody({ payload }: { payload: EventPayload }) {
  return (
    <div className="report-preview-section">
      <h3>Recent events ({payload.events.length})</h3>
      {payload.events.map((e) => (
        <div className="report-preview-timeline-row" key={e.eventId}>
          <span>{new Date(e.timestamp).toLocaleTimeString()}</span>
          <span>
            {e.sourceService} → {e.targetService} · {e.operation}
          </span>
          <span>{e.status}</span>
        </div>
      ))}
    </div>
  );
}
