package com.cloudmicroops.dto;

import com.cloudmicroops.model.DependencyEdge;
import com.cloudmicroops.model.RootCauseCandidate;
import com.cloudmicroops.model.ServiceEvent;

import java.time.Instant;
import java.util.List;

/**
 * Aggregates the existing RCA, dependency-graph and event data behind the
 * currently-detected incident (if any) into one document. Every field is
 * sourced from RootCauseScorer/DependencyGraphService/ServiceEventRepository
 * unchanged - this record only shapes their output for reporting. This is
 * also the single source of truth the Incident Center page reads from, so
 * dependency traversal (dependencyPath/potentiallyAffected) lives here in
 * Java rather than being re-walked in TypeScript.
 */
public record IncidentReportDTO(
        String reportId,
        Instant generatedAt,
        String incidentId,
        String rootCauseService,
        double confidence,
        String reason,
        List<String> affectedDownstreamServices,
        List<String> dependencyPath,
        List<String> potentiallyAffected,
        List<DependencyEdge> relatedEdges,
        List<ServiceEvent> timeline,
        long failureCount,
        List<RootCauseCandidate> otherCandidates
) {
}
