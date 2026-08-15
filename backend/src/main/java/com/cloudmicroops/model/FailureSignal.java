package com.cloudmicroops.model;

import java.time.Instant;

/**
 * An observed failure symptom (e.g. elevated error rate, health check
 * failure) that triggers root-cause analysis.
 */
public record FailureSignal(
        String serviceName,
        String signalType,
        String description,
        Instant observedAt
) {
}
