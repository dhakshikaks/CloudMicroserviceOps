import type {
  DependencyGraphResponse,
  RootCauseCandidate,
  ServiceEventRecord,
  ServiceHealthMap,
  ServiceMetrics,
} from "../types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080";
const PROMETHEUS_URL = import.meta.env.VITE_PROMETHEUS_URL ?? "http://localhost:9090";

export const MONITORED_SERVICES = [
  "backend",
  "user-service",
  "order-service",
  "payment-service",
  "inventory-service",
];

const JOB_FILTER = MONITORED_SERVICES.join("|");

async function getJson<T>(baseUrl: string, path: string): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`);
  if (!response.ok) {
    throw new Error(`Request to ${path} failed with status ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export function getDependencyGraph(): Promise<DependencyGraphResponse> {
  return getJson(API_BASE_URL, "/api/dependencies/graph");
}

export function getRootCauses(): Promise<RootCauseCandidate[]> {
  return getJson(API_BASE_URL, "/api/incidents/root-causes");
}

export function getRecentEvents(): Promise<ServiceEventRecord[]> {
  return getJson(API_BASE_URL, "/api/events/recent");
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
    health[service] = values[service] === 1;
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
