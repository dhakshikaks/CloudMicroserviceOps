import type { DependencyGraphResponse } from "../types";

/** Longest-path-from-a-root layering, computed purely from the real edges. */
export function computeLayers(graph: DependencyGraphResponse): string[][] {
  const ids = graph.nodes.map((n) => n.id);
  const incoming = new Map<string, string[]>(ids.map((id) => [id, []]));
  for (const edge of graph.edges) {
    incoming.get(edge.targetService)?.push(edge.sourceService);
  }

  const depth = new Map<string, number>();
  function depthOf(id: string, visiting: Set<string>): number {
    if (depth.has(id)) return depth.get(id)!;
    if (visiting.has(id)) return 0; // defensive cycle guard
    visiting.add(id);
    const preds = incoming.get(id) ?? [];
    const d = preds.length === 0 ? 0 : Math.max(...preds.map((p) => depthOf(p, visiting))) + 1;
    depth.set(id, d);
    visiting.delete(id);
    return d;
  }
  ids.forEach((id) => depthOf(id, new Set()));

  const maxDepth = ids.length === 0 ? -1 : Math.max(...ids.map((id) => depth.get(id) ?? 0));
  const layers: string[][] = Array.from({ length: maxDepth + 1 }, () => []);
  ids.forEach((id) => layers[depth.get(id) ?? 0].push(id));
  return layers;
}
