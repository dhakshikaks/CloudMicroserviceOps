package com.cloudmicroops.model;

import java.time.Instant;

/**
 * A directed edge in the live dependency graph, aggregated from observed
 * {@code microservice-events}: {@code sourceService} calling
 * {@code targetService}.
 */
public record DependencyEdge(
        String sourceService,
        String targetService,
        long totalCalls,
        long successfulCalls,
        long failedCalls,
        double confidence,
        Instant lastObservedAt
) {
}
