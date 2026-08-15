import type { ServiceHealthMap, ServiceStatus } from "../types";

/**
 * Derives a 4-state status from real, already-fetched data:
 * UNKNOWN when the service hasn't reported yet, DOWN when Prometheus's `up`
 * metric is 0, DEGRADED when it's up but currently serving errors, else UP.
 */
export function deriveServiceStatus(up: boolean | undefined, errorRate: number | undefined): ServiceStatus {
  if (up === undefined) return "UNKNOWN";
  if (!up) return "DOWN";
  if (errorRate !== undefined && errorRate > 0) return "DEGRADED";
  return "UP";
}

/** Overall system pulse for the sidebar indicator, from the same health map. */
export function deriveSystemPulse(
  health: ServiceHealthMap | null,
  services: string[]
): "ok" | "warn" | "unknown" {
  if (!health) return "unknown";
  const values = services.map((s) => health[s]);
  if (values.some((v) => v === false)) return "warn";
  if (values.some((v) => v === undefined)) return "unknown";
  return "ok";
}
