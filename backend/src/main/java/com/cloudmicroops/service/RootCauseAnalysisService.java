package com.cloudmicroops.service;

import com.cloudmicroops.model.FailureSignal;
import com.cloudmicroops.model.RootCauseCandidate;

import java.util.List;

/**
 * Orchestrates {@link com.cloudmicroops.rca.GraphAnalyzer} and
 * {@link com.cloudmicroops.rca.RootCauseRanker} to turn a set of failure
 * signals into ranked root-cause candidates.
 * <p>
 * No implementation is registered yet: both interfaces are unimplemented,
 * so wiring this service is a future task once they exist.
 */
public interface RootCauseAnalysisService {

    List<RootCauseCandidate> analyze(List<FailureSignal> signals);
}
