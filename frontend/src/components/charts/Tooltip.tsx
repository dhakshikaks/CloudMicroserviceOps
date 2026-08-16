import type { CSSProperties, ReactNode } from "react";

interface Props {
  x: number;
  y: number;
  children: ReactNode;
}

/** Fixed-position tooltip, clamped inside the viewport. Shared by all charts + topology. */
export default function Tooltip({ x, y, children }: Props) {
  const style: CSSProperties = {
    position: "fixed",
    left: Math.min(x + 12, window.innerWidth - 240),
    top: Math.min(y + 12, window.innerHeight - 90),
  };
  return (
    <div className="chart-tooltip" style={style}>
      {children}
    </div>
  );
}
