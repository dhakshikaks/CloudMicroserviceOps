import type { ReactNode } from "react";
import Skeleton from "./Skeleton";
import ExplainedEmptyState from "./ExplainedEmptyState";

interface Props {
  loading: boolean;
  error: string | null;
  empty: boolean;
  emptyMessage?: string;
  skeletonRows?: number;
  dataSource?: string;
  onRetry?: () => void;
  children: ReactNode;
}

/** Uniform loading/error/empty handling so each panel only renders its data case. */
export default function SectionState({
  loading,
  error,
  empty,
  emptyMessage,
  skeletonRows = 3,
  dataSource,
  onRetry,
  children,
}: Props) {
  if (loading) {
    return (
      <div className="skeleton-stack">
        {Array.from({ length: skeletonRows }).map((_, i) => (
          <Skeleton key={i} height="2.25rem" />
        ))}
      </div>
    );
  }
  if (error) {
    return (
      <ExplainedEmptyState
        title="Data unavailable"
        body={`This section could not load its data: ${error}`}
        dataSource={dataSource}
        lastCheckedLabel={new Date().toLocaleTimeString()}
        isError
        onRetry={onRetry}
      />
    );
  }
  if (empty) {
    return (
      <ExplainedEmptyState
        title="No data yet"
        body={emptyMessage ?? "No data has been observed for this section yet."}
        dataSource={dataSource}
      />
    );
  }
  return <>{children}</>;
}
