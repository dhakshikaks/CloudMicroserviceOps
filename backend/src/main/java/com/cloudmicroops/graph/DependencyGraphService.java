package com.cloudmicroops.graph;

import com.cloudmicroops.model.DependencyEdge;

import java.util.List;

/**
 * Builds the live service dependency graph from observed events.
 */
public interface DependencyGraphService {

    List<DependencyEdge> getCurrentGraph();
}
