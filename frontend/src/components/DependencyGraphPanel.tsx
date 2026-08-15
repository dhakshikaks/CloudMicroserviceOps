import type { DependencyGraphResponse } from "../types";
import SectionState from "./SectionState";

interface Props {
  graph: DependencyGraphResponse | null;
  loading: boolean;
  error: string | null;
}

export default function DependencyGraphPanel({ graph, loading, error }: Props) {
  return (
    <section className="panel">
      <h2>Live Dependency Graph</h2>
      <SectionState
        loading={loading}
        error={error}
        empty={!graph || graph.edges.length === 0}
        emptyMessage="No dependencies observed yet."
      >
        <table className="data-table">
          <thead>
            <tr>
              <th>Source</th>
              <th></th>
              <th>Target</th>
              <th>Confidence</th>
              <th>Calls (ok / failed)</th>
            </tr>
          </thead>
          <tbody>
            {graph?.edges.map((edge) => (
              <tr key={`${edge.sourceService}->${edge.targetService}`}>
                <td>{edge.sourceService}</td>
                <td>&rarr;</td>
                <td>{edge.targetService}</td>
                <td>{(edge.confidence * 100).toFixed(0)}%</td>
                <td>
                  {edge.successfulCalls} / {edge.failedCalls}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </SectionState>
    </section>
  );
}
