package com.cloudmicroops.rca;

import com.cloudmicroops.model.DependencyEdge;
import com.cloudmicroops.model.FailureSignal;
import com.cloudmicroops.model.RootCauseCandidate;

import java.util.List;

/**
 * Module boundary for root-cause ranking. Given the services implicated in
 * a multi-service failure and the dependency graph, produces a ranked list
 * of the most likely root cause(s).
 * <p>
 * Not implemented yet — this is a future task.
 */
public interface RootCauseRanker {

    List<RootCauseCandidate> rank(List<FailureSignal> signals, List<DependencyEdge> graph);
}
