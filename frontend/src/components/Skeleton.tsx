interface Props {
  height?: string;
  width?: string;
}

export default function Skeleton({ height = "1rem", width = "100%" }: Props) {
  return <div className="skeleton" style={{ height, width }} />;
}
