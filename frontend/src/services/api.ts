import type {
  DependencyEdge,
  DependencyGraphResponse,
  RootCauseCandidate,
  ServiceEventRecord,
  ServiceHealthMap,
  ServiceMetrics,
} from "../types";
import { getToken, logout } from "./auth";

// Same-origin by default: the frontend's own Nginx reverse-proxies these
// under /api and /prometheus, so no absolute host/port is baked in.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api";
const PROMETHEUS_URL = import.meta.env.VITE_PROMETHEUS_URL ?? "/prometheus";

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

const JOB_FILTER = MONITORED_SERVICES.join("|");

async function getJson<T>(baseUrl: string, path: string): Promise<T> {
  const token = getToken();
  const response = await fetch(`${baseUrl}${path}`, {
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
  return getJson(API_BASE_URL, "/dependencies/graph");
}

export function getRootCauses(windowMinutes: number = LIVE_WINDOW_MINUTES): Promise<RootCauseCandidate[]> {
  return getJson(API_BASE_URL, `/incidents/root-causes?windowMinutes=${windowMinutes}`);
}

export function getRecentEvents(): Promise<ServiceEventRecord[]> {
  return getJson(API_BASE_URL, "/events/recent");
}

// Edge list without the {nodes} wrapper - same data as getDependencyGraph(),
// used where a flat list is more convenient (e.g. filtering to one service).
export function getDependencies(): Promise<DependencyEdge[]> {
  return getJson(API_BASE_URL, "/dependencies");
}

interface PrometheusVectorResult {
  data: {
    result: Array<{ metric: Record<string, string>; value: [number, string] }>;
  };
}

async function queryPrometheus(promql: string): Promise<ServiceMetrics> {
  const response = await fetch(`${PROMETHEUS_URL}/api/v1/query?query=${encodeURIComponent(promql)}`);
  if (!response.ok) {
    throw new Error(`Prometheus query failed with status ${response.status}`);
  }
  const body = (await response.json()) as PrometheusVectorResult;
  const byJob: ServiceMetrics = {};
  for (const item of body.data.result) {
    byJob[item.metric.job] = Number(item.value[1]);
  }
  return byJob;
}

export async function getServiceHealth(): Promise<ServiceHealthMap> {
  const values = await queryPrometheus(`up{job=~"${JOB_FILTER}"}`);
  const health: ServiceHealthMap = {};
  for (const service of MONITORED_SERVICES) {
    // Undefined (service missing from the Prometheus vector) is distinct from
    // an explicit 0 - the former means "not scraped yet", not "down".
    health[service] = service in values ? values[service] === 1 : undefined;
  }
  return health;
}

export function getCpuUsage(): Promise<ServiceMetrics> {
  return queryPrometheus(`process_cpu_usage{job=~"${JOB_FILTER}"}`);
}

export function getMemoryUsage(): Promise<ServiceMetrics> {
  return queryPrometheus(`sum(jvm_memory_used_bytes{area="heap", job=~"${JOB_FILTER}"}) by (job)`);
}

export function getRequestRate(): Promise<ServiceMetrics> {
  return queryPrometheus(`sum(rate(http_server_requests_seconds_count{job=~"${JOB_FILTER}"}[1m])) by (job)`);
}

export function getErrorRate(): Promise<ServiceMetrics> {
  return queryPrometheus(
    `sum(rate(http_server_requests_seconds_count{job=~"${JOB_FILTER}", status=~"5.."}[1m])) by (job)`
  );
}

export function getLatencyP95(): Promise<ServiceMetrics> {
  return queryPrometheus(
    `histogram_quantile(0.95, sum(rate(http_server_requests_seconds_bucket{job=~"${JOB_FILTER}"}[1m])) by (le, job))`
  );
}

// ---------------------------------------------------------------------------
// Historical (query_range) data. Prometheus genuinely stores this - verified
// live against the running stack - so charts built from it are real, not
// fabricated. Caveat callers must handle: Prometheus has no data volume
// mounted, so history resets to empty on every container restart; a fresh
// stack legitimately returns few/zero points for a while.

export type TimeWindow = "5m" | "15m" | "1h" | "6h" | "24h";

export const TIME_WINDOWS: TimeWindow[] = ["5m", "15m", "1h", "6h", "24h"];

const TIME_WINDOW_SECONDS: Record<TimeWindow, number> = {
  "5m": 5 * 60,
  "15m": 15 * 60,
  "1h": 60 * 60,
  "6h": 6 * 60 * 60,
  "24h": 24 * 60 * 60,
};

// Step chosen per window to keep each series to a few hundred points at most.
const RANGE_STEP_SECONDS: Record<TimeWindow, number> = {
  "5m": 15,
  "15m": 15,
  "1h": 30,
  "6h": 120,
  "24h": 300,
};

export interface RangeSample {
  timestampSec: number;
  value: number;
}

export interface RangeSeries {
  metric: Record<string, string>;
  samples: RangeSample[];
}

export function buildRangeParams(window: TimeWindow, nowSec: number = Date.now() / 1000) {
  const end = Math.floor(nowSec);
  const start = end - TIME_WINDOW_SECONDS[window];
  const step = RANGE_STEP_SECONDS[window];
  return { start, end, step };
}

interface PrometheusRangeResult {
  data: {
    result: Array<{ metric: Record<string, string>; values: Array<[number, string]> }>;
  };
}

export async function queryPrometheusRange(promql: string, window: TimeWindow): Promise<RangeSeries[]> {
  const { start, end, step } = buildRangeParams(window);
  const url = `${PROMETHEUS_URL}/api/v1/query_range?query=${encodeURIComponent(promql)}&start=${start}&end=${end}&step=${step}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Prometheus range query failed with status ${response.status}`);
  }
  const body = (await response.json()) as PrometheusRangeResult;
  return body.data.result.map((series) => ({
    metric: series.metric,
    samples: series.values.map(([timestampSec, value]) => ({ timestampSec, value: Number(value) })),
  }));
}

// Aggregate (single series, summed/averaged across all monitored services via
// PromQL itself) - used for Overview's command-center trend charts, which
// intentionally show one honest line rather than a multi-color per-service
// overlay (see index.css / design notes on restrained color use).
export function getRequestRateRange(window: TimeWindow): Promise<RangeSeries[]> {
  return queryPrometheusRange(`sum(rate(http_server_requests_seconds_count{job=~"${JOB_FILTER}"}[1m]))`, window);
}

export function getErrorRateRange(window: TimeWindow): Promise<RangeSeries[]> {
  return queryPrometheusRange(
    `sum(rate(http_server_requests_seconds_count{job=~"${JOB_FILTER}", status=~"5.."}[1m]))`,
    window
  );
}

export function getLatencyP95Range(window: TimeWindow): Promise<RangeSeries[]> {
  return queryPrometheusRange(
    `histogram_quantile(0.95, sum(rate(http_server_requests_seconds_bucket{job=~"${JOB_FILTER}"}[1m])) by (le))`,
    window
  );
}

export function getCpuUsageRange(window: TimeWindow): Promise<RangeSeries[]> {
  return queryPrometheusRange(`avg(process_cpu_usage{job=~"${JOB_FILTER}"})`, window);
}

// Per-service (one series per job, metric.job identifies which) - used for
// the Metrics page's small-multiples breakdown and the Service Inspector.
export function getRequestRateRangeByService(window: TimeWindow): Promise<RangeSeries[]> {
  return queryPrometheusRange(`sum(rate(http_server_requests_seconds_count{job=~"${JOB_FILTER}"}[1m])) by (job)`, window);
}

export function getErrorRateRangeByService(window: TimeWindow): Promise<RangeSeries[]> {
  return queryPrometheusRange(
    `sum(rate(http_server_requests_seconds_count{job=~"${JOB_FILTER}", status=~"5.."}[1m])) by (job)`,
    window
  );
}

export function getLatencyP95RangeByService(window: TimeWindow): Promise<RangeSeries[]> {
  return queryPrometheusRange(
    `histogram_quantile(0.95, sum(rate(http_server_requests_seconds_bucket{job=~"${JOB_FILTER}"}[1m])) by (le, job))`,
    window
  );
}

export function getCpuUsageRangeByService(window: TimeWindow): Promise<RangeSeries[]> {
  return queryPrometheusRange(`process_cpu_usage{job=~"${JOB_FILTER}"}`, window);
}

export function getMemoryUsageRangeByService(window: TimeWindow): Promise<RangeSeries[]> {
  return queryPrometheusRange(`sum(jvm_memory_used_bytes{area="heap", job=~"${JOB_FILTER}"}) by (job)`, window);
}
