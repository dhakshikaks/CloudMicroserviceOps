package com.cloudmicroops.metrics.dto;

import java.util.Map;

/** Mirrors the frontend's RuntimeMetrics { cpu, memory, requestRate, errorRate, latencyP95 } exactly. */
public record MetricsSnapshotDTO(
        Map<String, Double> cpu,
        Map<String, Double> memory,
        Map<String, Double> requestRate,
        Map<String, Double> errorRate,
        Map<String, Double> latencyP95
) {
}
