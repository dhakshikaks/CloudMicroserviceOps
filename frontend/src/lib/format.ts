export function fmtPercent(v: number | undefined): string {
  return v === undefined ? "—" : `${(v * 100).toFixed(1)}%`;
}
export function fmtMb(v: number | undefined): string {
  return v === undefined ? "—" : `${(v / 1024 / 1024).toFixed(1)} MB`;
}
export function fmtRate(v: number | undefined): string {
  return v === undefined ? "—" : `${v.toFixed(2)} req/s`;
}
export function fmtMs(v: number | undefined): string {
  return v === undefined ? "—" : `${(v * 1000).toFixed(0)} ms`;
}
/** Error % derived from two real Prometheus values (errorRate / requestRate) - not fabricated. */
export function fmtErrPct(errorRate: number | undefined, requestRate: number | undefined): string {
  if (errorRate === undefined || requestRate === undefined) return "—";
  if (requestRate <= 0) return "0.0%";
  return `${((errorRate / requestRate) * 100).toFixed(1)}%`;
}
