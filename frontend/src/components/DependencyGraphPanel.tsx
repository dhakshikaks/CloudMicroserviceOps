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
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Source</th>
                <th></th>
                <th>Target</th>
                <th>Total Calls</th>
                <th>Successful</th>
                <th>Failed</th>
                <th>Confidence</th>
              </tr>
            </thead>
            <tbody>
              {graph?.edges.map((edge) => (
                <tr key={`${edge.sourceService}->${edge.targetService}`}>
                  <td>{edge.sourceService}</td>
                  <td>&rarr;</td>
                  <td>{edge.targetService}</td>
                  <td>{edge.totalCalls}</td>
                  <td>{edge.successfulCalls}</td>
                  <td>{edge.failedCalls}</td>
                  <td>{(edge.confidence * 100).toFixed(0)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionState>
    </section>
  );
}
