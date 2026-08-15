package com.cloudmicroops.graph;

import com.cloudmicroops.model.DependencyEdge;

import java.util.List;

/**
 * Graph-friendly view of the dependency graph for visualization clients.
 */
public record DependencyGraphResponse(List<GraphNode> nodes, List<DependencyEdge> edges) {

    public record GraphNode(String id) {
    }
}
