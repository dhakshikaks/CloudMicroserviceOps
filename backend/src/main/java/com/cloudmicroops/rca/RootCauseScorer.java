package com.cloudmicroops.rca;

import com.cloudmicroops.graph.DependencyGraphService;
import com.cloudmicroops.model.DependencyEdge;
import com.cloudmicroops.model.RootCauseCandidate;
import com.cloudmicroops.model.ServiceEvent;
import com.cloudmicroops.repository.ServiceEventRepository;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import java.util.stream.Stream;

/**
 * Ranks the services most likely to be the root cause of an incident,
 * from recent FAILED events and the current dependency graph.
 * <p>
 * Deterministic weighted-sum formula, factors weighted to sum to 1.0:
 * downstream blast radius (0.35), confidence of the affected incoming
 * dependencies (0.25), share of total failures (0.25), recency (0.15).
 */
@Component
public class RootCauseScorer {

    private static final String FAILURE_STATUS = "FAILURE";
    private static final double DOWNSTREAM_WEIGHT = 0.35;
    private static final double INCOMING_CONFIDENCE_WEIGHT = 0.25;
    private static final double FAILURE_SHARE_WEIGHT = 0.25;
    private static final double RECENCY_WEIGHT = 0.15;

    private final ServiceEventRepository eventRepository;
    private final DependencyGraphService dependencyGraphService;

    public RootCauseScorer(ServiceEventRepository eventRepository, DependencyGraphService dependencyGraphService) {
        this.eventRepository = eventRepository;
        this.dependencyGraphService = dependencyGraphService;
    }

    public List<RootCauseCandidate> rankRootCauses(Duration window) {
        Instant now = Instant.now();
        List<ServiceEvent> failures = eventRepository.findByStatusAndTimestampAfter(FAILURE_STATUS, now.minus(window));
        if (failures.isEmpty()) {
            return List.of();
        }

        Set<String> affectedServices = failures.stream()
                .flatMap(e -> Stream.of(e.getSourceService(), e.getTargetService()))
                .collect(Collectors.toSet());
        List<DependencyEdge> graph = dependencyGraphService.getCurrentGraph();
        int totalFailures = failures.size();

        List<RootCauseCandidate> ranked = affectedServices.stream()
                .map(service -> score(service, failures, graph, affectedServices, totalFailures, now, window))
                .sorted(Comparator.comparingDouble(RootCauseCandidate::score).reversed()
                        .thenComparing(RootCauseCandidate::service))
                .toList();

        return IntStream.range(0, ranked.size())
                .mapToObj(i -> withRank(ranked.get(i), i + 1))
                .toList();
    }

    private RootCauseCandidate score(String service, List<ServiceEvent> failures, List<DependencyEdge> graph,
                                      Set<String> affectedServices, int totalFailures, Instant now, Duration window) {
        long failureCount = failures.stream().filter(e -> service.equals(e.getTargetService())).count();

        List<String> downstreamAffected = graph.stream()
                .filter(edge -> service.equals(edge.targetService())
                        && affectedServices.contains(edge.sourceService())
                        && !service.equals(edge.sourceService()))
                .map(DependencyEdge::sourceService)
                .distinct()
                .sorted()
                .toList();
        double downstreamRatio = affectedServices.size() > 1
                ? (double) downstreamAffected.size() / (affectedServices.size() - 1) : 0.0;

        double incomingConfidence = graph.stream()
                .filter(edge -> service.equals(edge.targetService()) && downstreamAffected.contains(edge.sourceService()))
                .mapToDouble(DependencyEdge::confidence)
                .average().orElse(0.0);

        double failureShare = totalFailures > 0 ? (double) failureCount / totalFailures : 0.0;

        Instant lastFailureAt = failures.stream()
                .filter(e -> service.equals(e.getSourceService()) || service.equals(e.getTargetService()))
                .map(ServiceEvent::getTimestamp)
                .max(Comparator.naturalOrder())
                .orElse(now.minus(window));
        double windowMillis = Math.max(1, window.toMillis());
        double ageMillis = Duration.between(lastFailureAt, now).toMillis();
        double recency = Math.max(0.0, 1.0 - (ageMillis / windowMillis));

        double score = round(DOWNSTREAM_WEIGHT * downstreamRatio
                + INCOMING_CONFIDENCE_WEIGHT * incomingConfidence
                + FAILURE_SHARE_WEIGHT * failureShare
                + RECENCY_WEIGHT * recency);

        String reason = reason(downstreamAffected, service, graph, affectedServices);

        return new RootCauseCandidate(service, score, 0, downstreamAffected, reason);
    }

    private String reason(List<String> downstreamAffected, String service, List<DependencyEdge> graph,
                           Set<String> affectedServices) {
        if (!downstreamAffected.isEmpty()) {
            return "failure occurred early and affected " + downstreamAffected.size() + " downstream service(s)";
        }
        boolean dependsOnAffectedService = graph.stream()
                .anyMatch(edge -> service.equals(edge.sourceService()) && affectedServices.contains(edge.targetService())
                        && !service.equals(edge.targetService()));
        return dependsOnAffectedService ? "downstream dependency affected" : "isolated failure";
    }

    private RootCauseCandidate withRank(RootCauseCandidate candidate, int rank) {
        return new RootCauseCandidate(candidate.service(), candidate.score(),
                rank, candidate.affectedDownstreamServices(), candidate.reason());
    }

    private static double round(double value) {
        return Math.round(value * 100.0) / 100.0;
    }
}
