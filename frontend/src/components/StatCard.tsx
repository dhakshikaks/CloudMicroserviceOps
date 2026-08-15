interface Props {
  label: string;
  value: string;
  detail?: string;
  tone?: "default" | "good" | "warning" | "critical" | "accent";
}

export default function StatCard({ label, value, detail, tone = "default" }: Props) {
  return (
    <div className={`stat-card${tone !== "default" ? ` tone-${tone}` : ""}`}>
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
      {detail && <span className="stat-detail">{detail}</span>}
    </div>
  );
}
