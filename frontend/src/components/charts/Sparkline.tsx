import type { RangeSample } from "../../services/api";

interface Props {
  samples: RangeSample[];
  width?: number;
  height?: number;
  emptyLabel?: string;
  tone?: "default" | "warning" | "critical";
}

// Real Prometheus history only - if fewer than 2 points exist (e.g. a
// freshly-restarted stack with no data volume), this is an honest empty
// state, never an interpolated/fake flat line.
export default function Sparkline({
  samples,
  width = 96,
  height = 28,
  emptyLabel = "Historical data unavailable - collecting since restart",
  tone = "default",
}: Props) {
  if (samples.length < 2) {
    return (
      <div className="sparkline-empty" style={{ width, height }} title={emptyLabel}>
        <span>–</span>
      </div>
    );
  }

  const values = samples.map((s) => s.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = width / (samples.length - 1);

  const points = samples
    .map((s, i) => {
      const x = i * stepX;
      const y = height - ((s.value - min) / range) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg
      className={`sparkline tone-${tone}`}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`Trend: ${values[0].toFixed(2)} to ${values[values.length - 1].toFixed(2)}`}
    >
      <polyline points={points} className="sparkline-line" fill="none" />
    </svg>
  );
}
