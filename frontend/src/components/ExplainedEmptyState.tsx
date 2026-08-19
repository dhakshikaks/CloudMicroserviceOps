import { AlertTriangle, Info } from "lucide-react";

interface Props {
  title: string;
  body: string;
  lastCheckedLabel?: string;
  dataSource?: string;
  isError?: boolean;
  onRetry?: () => void;
}

/** Explained empty/error state - never a bare blank area, always says what/why/what-can-I-do. */
export default function ExplainedEmptyState({ title, body, lastCheckedLabel, dataSource, isError, onRetry }: Props) {
  return (
    <div className={`explained-empty-state${isError ? " is-error" : ""}`}>
      <div className="explained-empty-state-title">
        {isError ? <AlertTriangle size={14} /> : <Info size={14} />}
        {title}
      </div>
      <p className="explained-empty-state-body">{body}</p>
      {(lastCheckedLabel || dataSource) && (
        <div className="explained-empty-state-meta">
          {dataSource && <span>Data source: {dataSource}</span>}
          {lastCheckedLabel && <span>Last checked: {lastCheckedLabel}</span>}
        </div>
      )}
      {onRetry && (
        <button type="button" className="explained-empty-state-retry" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}
