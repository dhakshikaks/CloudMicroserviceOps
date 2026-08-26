export interface MonoRingSegment {
  label: string;
  value: number;
  /** Texture is the only thing that tells segments apart - no hue allowed. */
  pattern: "solid" | "dashed" | "dotted" | "dim";
}

interface Props {
  segments: MonoRingSegment[];
  size?: number;
  strokeWidth?: number;
  centerLabel?: string;
  centerSublabel?: string;
}

function arcPoint(cx: number, cy: number, r: number, angleRad: number) {
  return { x: cx + r * Math.sin(angleRad), y: cy - r * Math.cos(angleRad) };
}

const DASH: Record<MonoRingSegment["pattern"], string | undefined> = {
  solid: undefined,
  dashed: "7 5",
  dotted: "1.5 4.5",
  dim: undefined,
};

/** Real SVG arc paths (not a full-circle dasharray hack) - each segment's
 * texture is genuinely confined to its own angular span. Black/white only. */
export default function MonoRing({ segments, size = 132, strokeWidth = 14, centerLabel, centerSublabel }: Props) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  const cx = size / 2;
  const cy = size / 2;
  const r = (size - strokeWidth) / 2;
  const gapRad = total > 0 ? 0.035 : 0;

  let cursor = -Math.PI; // start at 9 o'clock going the long way isn't needed; use 12 o'clock (0) start
  cursor = 0;

  return (
    <div className="mono-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--border-strong)" strokeWidth={strokeWidth} />
        {total > 0 &&
          segments
            .filter((s) => s.value > 0)
            .map((seg) => {
              const span = (seg.value / total) * (Math.PI * 2) - gapRad;
              const start = cursor;
              const end = cursor + Math.max(span, 0.001);
              cursor += (seg.value / total) * (Math.PI * 2);
              const p1 = arcPoint(cx, cy, r, start);
              const p2 = arcPoint(cx, cy, r, end);
              const largeArc = end - start > Math.PI ? 1 : 0;
              const d = `M ${p1.x.toFixed(2)} ${p1.y.toFixed(2)} A ${r} ${r} 0 ${largeArc} 1 ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
              return (
                <path
                  key={seg.label}
                  d={d}
                  fill="none"
                  stroke="var(--text-primary)"
                  strokeWidth={strokeWidth}
                  strokeDasharray={DASH[seg.pattern]}
                  strokeLinecap={seg.pattern === "dotted" ? "round" : "butt"}
                  opacity={seg.pattern === "dim" ? 0.32 : 1}
                />
              );
            })}
      </svg>
      <div className="mono-ring-center">
        {centerLabel && <span className="mono-ring-value mono">{centerLabel}</span>}
        {centerSublabel && <span className="mono-ring-sublabel">{centerSublabel}</span>}
      </div>
    </div>
  );
}
