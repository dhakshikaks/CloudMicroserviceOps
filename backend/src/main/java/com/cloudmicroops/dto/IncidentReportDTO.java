package com.cloudmicroops.dto;

import com.cloudmicroops.model.DependencyEdge;
import com.cloudmicroops.model.ServiceEvent;

import java.time.Instant;
import java.util.List;

/**
 * Aggregates the existing RCA, dependency-graph and event data behind the
 * currently-detected incident (if any) into one document. Every field is
 * sourced from RootCauseScorer/DependencyGraphService/ServiceEventRepository
 * unchanged - this record only shapes their output for reporting.
 */
public record IncidentReportDTO(
        String reportId,
        Instant generatedAt,
        String incidentId,
        String rootCauseService,
        double confidence,
        String reason,
        List<String> affectedDownstreamServices,
        List<DependencyEdge> relatedEdges,
        List<ServiceEvent> timeline,
        long failureCount
) {
}
