import { useRef, useState, type MouseEvent } from "react";
import type { RangeSample } from "../../services/api";
import Tooltip from "./Tooltip";

interface Props {
  samples: RangeSample[];
  width?: number;
  height?: number;
  yFormat?: (v: number) => string;
  emptyLabel?: string;
  /** critical = error-data series, rendered in red instead of the default blue. */
  tone?: "default" | "critical";
}

const DEFAULT_EMPTY_LABEL = "Historical data unavailable - collecting since restart";

/** Single-series line chart with axis labels + hover crosshair, fed by real query_range data. */
export default function LineChart({
  samples,
  width = 560,
  height = 160,
  yFormat = (v) => v.toFixed(2),
  emptyLabel = DEFAULT_EMPTY_LABEL,
  tone = "default",
}: Props) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  if (samples.length < 2) {
    return (
      <div className="linechart-empty" style={{ height }}>
        {emptyLabel}
      </div>
    );
  }

  const padding = { top: 12, right: 12, bottom: 22, left: 48 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  const values = samples.map((s) => s.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = innerWidth / (samples.length - 1);

  const xFor = (i: number) => padding.left + i * stepX;
  const yFor = (v: number) => padding.top + innerHeight - ((v - min) / range) * innerHeight;

  const pathD = samples.map((s, i) => `${i === 0 ? "M" : "L"}${xFor(i).toFixed(1)},${yFor(s.value).toFixed(1)}`).join(" ");
  const baselineY = (padding.top + innerHeight).toFixed(1);
  const areaD = `${pathD} L${xFor(samples.length - 1).toFixed(1)},${baselineY} L${xFor(0).toFixed(1)},${baselineY} Z`;

  function handleMouseMove(e: MouseEvent<SVGSVGElement>) {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * width - padding.left;
    const idx = Math.round(relX / stepX);
    setHoverIndex(Math.max(0, Math.min(samples.length - 1, idx)));
  }

  const hovered = hoverIndex !== null ? samples[hoverIndex] : null;
  const midValue = min + range / 2;
  const timeLabel = (sec: number) => new Date(sec * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  let hoverScreenX = 0;
  let hoverScreenY = 0;
  if (hovered && hoverIndex !== null && svgRef.current) {
    const rect = svgRef.current.getBoundingClientRect();
    const scale = rect.width / width;
    hoverScreenX = rect.left + xFor(hoverIndex) * scale;
    hoverScreenY = rect.top + yFor(hovered.value) * scale;
  }

  const lastIndex = samples.length - 1;
  const lastX = xFor(lastIndex);
  const lastY = yFor(samples[lastIndex].value);

  return (
    <div className="linechart-wrap">
      <svg
        ref={svgRef}
        className={`linechart${tone === "critical" ? " tone-critical" : ""}`}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoverIndex(null)}
      >
        <line x1={padding.left} y1={padding.top} x2={width - padding.right} y2={padding.top} className="linechart-grid" />
        <line
          x1={padding.left}
          y1={padding.top + innerHeight / 2}
          x2={width - padding.right}
          y2={padding.top + innerHeight / 2}
          className="linechart-grid"
        />
        <line x1={padding.left} y1={padding.top} x2={padding.left} y2={padding.top + innerHeight} className="linechart-axis" />
        <line
          x1={padding.left}
          y1={padding.top + innerHeight}
          x2={width - padding.right}
          y2={padding.top + innerHeight}
          className="linechart-axis"
        />

        <text x={padding.left - 6} y={padding.top + 4} className="linechart-axis-label" textAnchor="end">
          {yFormat(max)}
        </text>
        <text x={padding.left - 6} y={padding.top + innerHeight / 2 + 4} className="linechart-axis-label" textAnchor="end">
          {yFormat(midValue)}
        </text>
        <text x={padding.left - 6} y={padding.top + innerHeight + 4} className="linechart-axis-label" textAnchor="end">
          {yFormat(min)}
        </text>

        <text x={padding.left} y={height - 4} className="linechart-time-label" textAnchor="start">
          {timeLabel(samples[0].timestampSec)}
        </text>
        <text x={width - padding.right} y={height - 4} className="linechart-time-label" textAnchor="end">
          {timeLabel(samples[samples.length - 1].timestampSec)}
        </text>

        <path d={areaD} className="linechart-area" />
        <path d={pathD} className="linechart-line" />

        {/* Live indicator - a soft pulsing ring on the most recent real datapoint,
            communicating this series is still streaming, not a static snapshot. */}
        <circle cx={lastX} cy={lastY} r={7} className="linechart-live-ring" />
        <circle cx={lastX} cy={lastY} r={2.5} className="linechart-live-dot" />

        {hovered && hoverIndex !== null && (
          <>
            <line
              x1={xFor(hoverIndex)}
              y1={padding.top}
              x2={xFor(hoverIndex)}
              y2={padding.top + innerHeight}
              className="linechart-crosshair"
            />
            <circle cx={xFor(hoverIndex)} cy={yFor(hovered.value)} r={3} className="linechart-dot" />
          </>
        )}
      </svg>
      {hovered && (
        <Tooltip x={hoverScreenX} y={hoverScreenY}>
          <div className="chart-tooltip-time">{new Date(hovered.timestampSec * 1000).toLocaleTimeString()}</div>
          <div className="chart-tooltip-value">{yFormat(hovered.value)}</div>
        </Tooltip>
      )}
    </div>
  );
}
