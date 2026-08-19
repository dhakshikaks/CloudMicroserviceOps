import type {
  DependencyEdge,
  DependencyGraphResponse,
  IncidentReport,
  NotificationRecord,
  RootCauseCandidate,
  ServiceEventRecord,
  ServiceHealthMap,
  ServiceMetrics,
} from "../types";
import { getToken, logout } from "./auth";

// Same-origin by default: the frontend's own Nginx reverse-proxies these
// under /api, so no absolute host/port is baked in. The frontend no longer
// talks to Prometheus directly - metrics/health are aggregated by the Java
// backend (see com.cloudmicroops.metrics) and served under /api like
// everything else.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api";

export const MONITORED_SERVICES = [
  "backend",
  "user-service",
  "order-service",
  "payment-service",
  "inventory-service",
];

// The single lookback window the dashboard treats as "live" - drives the RCA
// query, the Recent Failures count, and the live/historical split on events.
// The RCA scoring algorithm itself is untouched; this only controls which
// window callers ask it to score.
export const LIVE_WINDOW_MINUTES = 15;

async function getJson<T>(path: string): Promise<T> {
  const token = getToken();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (response.status === 401) {
    logout();
    window.location.href = "/login";
  }
  if (!response.ok) {
    throw new Error(`Request to ${path} failed with status ${response.status}`);
  }
  return response.json() as Promise<T>;
}

// Paths are relative to API_BASE_URL, which already ends in "/api" - do not
// repeat "/api" here or requests become /api/api/....
export function getDependencyGraph(): Promise<DependencyGraphResponse> {
  return getJson("/dependencies/graph");
}

export function getRootCauses(windowMinutes: number = LIVE_WINDOW_MINUTES): Promise<RootCauseCandidate[]> {
  return getJson(`/incidents/root-causes?windowMinutes=${windowMinutes}`);
}

export function getRecentEvents(): Promise<ServiceEventRecord[]> {
  return getJson("/events/recent");
}

// Edge list without the {nodes} wrapper - same data as getDependencyGraph(),
// used where a flat list is more convenient (e.g. filtering to one service).
export function getDependencies(): Promise<DependencyEdge[]> {
  return getJson("/dependencies");
}

export function getNotifications(windowMinutes: number = LIVE_WINDOW_MINUTES): Promise<NotificationRecord[]> {
  return getJson(`/notifications?windowMinutes=${windowMinutes}`);
}

// The backend returns 204 No Content (not a JSON body) when there is no
// active root-cause candidate in the window - handled explicitly here rather
// than through getJson(), which always expects a JSON body.
export async function getIncidentReport(windowMinutes: number = LIVE_WINDOW_MINUTES): Promise<IncidentReport | null> {
  const token = getToken();
  const response = await fetch(`${API_BASE_URL}/reports/incident?windowMinutes=${windowMinutes}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (response.status === 401) {
    logout();
    window.location.href = "/login";
  }
  if (response.status === 204) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Request to /reports/incident failed with status ${response.status}`);
  }
  return response.json() as Promise<IncidentReport>;
}

// ---------------------------------------------------------------------------
// Metrics / health - both now real Java endpoints (com.cloudmicroops.metrics)
// that query Prometheus server-side. Function names/return shapes below are
// unchanged from when they queried Prometheus directly from the browser, so
// every consuming component needed zero changes for this migration.

export function getServiceHealth(): Promise<ServiceHealthMap> {
  return getJson("/health/services");
}

export function getPrometheusReachable(): Promise<boolean> {
  return getJson<{ reachable: boolean }>("/health/prometheus").then((r) => r.reachable);
}

export interface RuntimeMetricsSnapshot {
  cpu: ServiceMetrics;
  memory: ServiceMetrics;
  requestRate: ServiceMetrics;
  errorRate: ServiceMetrics;
  latencyP95: ServiceMetrics;
}

export function getMetricsSnapshot(): Promise<RuntimeMetricsSnapshot> {
  return getJson("/metrics/snapshot");
}

// ---------------------------------------------------------------------------
// Historical (range) metrics. The backend genuinely stores/derives this from
// real Prometheus history - verified live against the running stack - so
// charts built from it are real, not fabricated. Caveat callers must handle:
// Prometheus has no data volume mounted, so history resets to empty on every
// container restart; a fresh stack legitimately returns few/zero points for
// a while.

export type TimeWindow = "5m" | "15m" | "1h" | "6h" | "24h";

export const TIME_WINDOWS: TimeWindow[] = ["5m", "15m", "1h", "6h", "24h"];

export interface RangeSample {
  timestampSec: number;
  value: number;
}

export interface RangeSeries {
  metric: Record<string, string>;
  samples: RangeSample[];
}

type MetricParam = "request-rate" | "error-rate" | "latency-p95" | "cpu" | "memory";

function getMetricRange(metric: MetricParam, window: TimeWindow, byService: boolean): Promise<RangeSeries[]> {
  return getJson(`/metrics/range?metric=${metric}&window=${window}&byService=${byService}`);
}

// Aggregate (single series, summed/averaged across all monitored services by
// the backend's PromQL itself) - used for Overview's command-center trend
// charts, which intentionally show one honest line rather than a multi-color
// per-service overlay.
export function getRequestRateRange(window: TimeWindow): Promise<RangeSeries[]> {
  return getMetricRange("request-rate", window, false);
}

export function getErrorRateRange(window: TimeWindow): Promise<RangeSeries[]> {
  return getMetricRange("error-rate", window, false);
}

export function getLatencyP95Range(window: TimeWindow): Promise<RangeSeries[]> {
  return getMetricRange("latency-p95", window, false);
}

export function getCpuUsageRange(window: TimeWindow): Promise<RangeSeries[]> {
  return getMetricRange("cpu", window, false);
}

// Per-service (one series per job, metric.job identifies which) - used for
// the Metrics page's small-multiples breakdown and the Service Inspector.
export function getRequestRateRangeByService(window: TimeWindow): Promise<RangeSeries[]> {
  return getMetricRange("request-rate", window, true);
}

export function getErrorRateRangeByService(window: TimeWindow): Promise<RangeSeries[]> {
  return getMetricRange("error-rate", window, true);
}

export function getLatencyP95RangeByService(window: TimeWindow): Promise<RangeSeries[]> {
  return getMetricRange("latency-p95", window, true);
}

export function getCpuUsageRangeByService(window: TimeWindow): Promise<RangeSeries[]> {
  return getMetricRange("cpu", window, true);
}

export function getMemoryUsageRangeByService(window: TimeWindow): Promise<RangeSeries[]> {
  return getMetricRange("memory", window, true);
}
