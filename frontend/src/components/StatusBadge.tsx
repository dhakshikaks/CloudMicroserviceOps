interface Props {
  status: string;
}

/** Small status pill; state is structural (weight/border/invert), never color alone - label always shown. */
export default function StatusBadge({ status }: Props) {
  return (
    <span className={`status-badge status-${status.toLowerCase()}`}>
      <span className="status-dot" />
      {status}
    </span>
  );
}
