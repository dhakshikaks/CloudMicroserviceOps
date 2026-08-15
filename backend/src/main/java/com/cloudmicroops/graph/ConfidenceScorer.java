package com.cloudmicroops.graph;

/**
 * Assigns a confidence score to an observed source-to-target communication
 * edge, given how many of the observed calls succeeded.
 */
public interface ConfidenceScorer {

    /**
     * @return a confidence value in {@code [0.0, 1.0]}
     */
    double score(long totalCalls, long successfulCalls);
}
