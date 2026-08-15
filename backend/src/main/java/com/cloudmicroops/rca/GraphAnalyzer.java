package com.cloudmicroops.rca;

import com.cloudmicroops.model.DependencyEdge;
import com.cloudmicroops.model.FailureSignal;

import java.util.List;

/**
 * Module boundary for dependency graph analysis. Given a set of failure
 * signals and the current dependency graph, identifies the subgraph of
 * services plausibly implicated in the failure.
 * <p>
 * Not implemented yet — this is a future task.
 */
public interface GraphAnalyzer {

    List<String> findImplicatedServices(List<FailureSignal> signals, List<DependencyEdge> graph);
}
