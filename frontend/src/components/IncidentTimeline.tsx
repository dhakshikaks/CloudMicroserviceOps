import { useEffect, useRef, useState } from "react";
import type { NotificationRecord, ServiceEventRecord } from "../types";
import Tooltip from "./charts/Tooltip";

interface Props {
  events: ServiceEventRecord[];
  notifications: NotificationRecord[];
  windowMinutes: number;
  height?: number;
}

interface HoverInfo {
  screenX: number;
  screenY: number;
  label: string;
  time: string;
}

/** Thin monochrome event strip: tall bright ticks = failures, short dim
 * ticks = successful traffic, diamonds = a detected incident. No color -
 * severity/kind is read from height, brightness and shape only. */
export default function IncidentTimeline({ events, notifications, windowMinutes, height = 110 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);
  const [hover, setHover] = useState<HoverInfo | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      if (entries[0] && entries[0].contentRect.width > 0) setWidth(Math.floor(entries[0].contentRect.width));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const now = Date.now();
  const windowMs = windowMinutes * 60_000;
  const start = now - windowMs;

  const padding = { left: 12, right: 12, top: 10, bottom: 22 };
  const innerWidth = Math.max(10, width - padding.left - padding.right);
  const baselineY = height - padding.bottom;

  const xFor = (isoTime: string) => {
    const t = new Date(isoTime).getTime();
    const frac = Math.max(0, Math.min(1, (t - start) / windowMs));
    return padding.left + frac * innerWidth;
  };

  const visibleEvents = events.filter((e) => new Date(e.timestamp).getTime() >= start);
  const visibleNotifications = notifications.filter((n) => new Date(n.timestamp).getTime() >= start);

  return (
    <div className="incident-timeline-chart-wrap" ref={containerRef}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="incident-timeline-chart">
        <line x1={padding.left} y1={baselineY} x2={width - padding.right} y2={baselineY} className="incident-timeline-axis" />

        {visibleEvents.length === 0 && visibleNotifications.length === 0 && (
          <text x={width / 2} y={baselineY - 20} textAnchor="middle" className="incident-timeline-empty-label">
            No events in this window
          </text>
        )}

        {visibleEvents.map((e) => {
          const x = xFor(e.timestamp);
          const isFailure = e.status !== "SUCCESS";
          const tickHeight = isFailure ? 34 : 14;
          return (
            <line
              key={e.eventId}
              x1={x}
              y1={baselineY}
              x2={x}
              y2={baselineY - tickHeight}
              className={`incident-timeline-tick${isFailure ? " is-failure" : ""}`}
              onMouseEnter={(ev) =>
                setHover({
                  screenX: ev.clientX,
                  screenY: ev.clientY,
                  label: `${e.sourceService} → ${e.targetService} · ${e.operation} · ${e.status}`,
                  time: new Date(e.timestamp).toLocaleTimeString(),
                })
              }
              onMouseLeave={() => setHover(null)}
            />
          );
        })}

        {visibleNotifications.map((n) => {
          const x = xFor(n.timestamp);
          const y = baselineY - 46;
          const s = 5;
          return (
            <g
              key={n.id}
              onMouseEnter={(ev) => setHover({ screenX: ev.clientX, screenY: ev.clientY, label: n.message, time: new Date(n.timestamp).toLocaleTimeString() })}
              onMouseLeave={() => setHover(null)}
            >
              <line x1={x} y1={baselineY} x2={x} y2={y + s} className="incident-timeline-tick is-marker" />
              <path
                d={`M ${x} ${y - s} L ${x + s} ${y} L ${x} ${y + s} L ${x - s} ${y} Z`}
                className={`incident-timeline-marker${n.severity === "CRITICAL" ? " is-critical" : ""}`}
              />
            </g>
          );
        })}

        <text x={padding.left} y={height - 6} textAnchor="start" className="incident-timeline-time-label">
          −{windowMinutes >= 60 ? `${(windowMinutes / 60).toFixed(0)}h` : `${windowMinutes}m`}
        </text>
        <text x={width - padding.right} y={height - 6} textAnchor="end" className="incident-timeline-time-label">
          now
        </text>
      </svg>

      {hover && (
        <Tooltip x={hover.screenX} y={hover.screenY}>
          <div className="chart-tooltip-time">{hover.time}</div>
          <div className="mono">{hover.label}</div>
        </Tooltip>
      )}

      <div className="incident-timeline-legend">
        <span className="incident-timeline-legend-item">
          <span className="incident-timeline-legend-swatch tall" />
          Failure
        </span>
        <span className="incident-timeline-legend-item">
          <span className="incident-timeline-legend-swatch short" />
          Success
        </span>
        <span className="incident-timeline-legend-item">
          <span className="incident-timeline-legend-swatch diamond" />
          Incident detected
        </span>
      </div>
    </div>
  );
}
