import type { ReactNode } from "react";

interface Props {
  loading: boolean;
  error: string | null;
  empty: boolean;
  emptyMessage?: string;
  children: ReactNode;
}

/** Uniform loading/error/empty handling so each panel only renders its data case. */
export default function SectionState({ loading, error, empty, emptyMessage, children }: Props) {
  if (loading) return <p className="state-message">Loading...</p>;
  if (error) return <p className="state-message state-error">Error: {error}</p>;
  if (empty) return <p className="state-message">{emptyMessage ?? "No data yet."}</p>;
  return <>{children}</>;
}
