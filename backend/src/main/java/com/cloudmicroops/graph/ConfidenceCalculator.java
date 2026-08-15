package com.cloudmicroops.graph;

import org.springframework.stereotype.Component;

/**
 * MVP confidence formula: the fraction of observed calls that succeeded.
 * Kept isolated here so the formula can be improved later without touching
 * callers.
 */
@Component
public class ConfidenceCalculator implements ConfidenceScorer {

    @Override
    public double score(long totalCalls, long successfulCalls) {
        if (totalCalls == 0) {
            return 0.0;
        }
        return (double) successfulCalls / totalCalls;
    }
}
