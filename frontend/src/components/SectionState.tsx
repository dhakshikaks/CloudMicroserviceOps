import type { ReactNode } from "react";
import Skeleton from "./Skeleton";

interface Props {
  loading: boolean;
  error: string | null;
  empty: boolean;
  emptyMessage?: string;
  skeletonRows?: number;
  children: ReactNode;
}

/** Uniform loading/error/empty handling so each panel only renders its data case. */
export default function SectionState({ loading, error, empty, emptyMessage, skeletonRows = 3, children }: Props) {
  if (loading) {
    return (
      <div className="skeleton-stack">
        {Array.from({ length: skeletonRows }).map((_, i) => (
          <Skeleton key={i} height="2.25rem" />
        ))}
      </div>
    );
  }
  if (error) return <p className="state-message state-error">Error: {error}</p>;
  if (empty) return <p className="state-message">{emptyMessage ?? "No data yet."}</p>;
  return <>{children}</>;
}
