package com.cloudmicroops.service;

import com.cloudmicroops.dto.IncidentReportDTO;
import com.cloudmicroops.graph.DependencyGraphService;
import com.cloudmicroops.model.DependencyEdge;
import com.cloudmicroops.model.RootCauseCandidate;
import com.cloudmicroops.model.ServiceEvent;
import com.cloudmicroops.rca.RootCauseScorer;
import com.cloudmicroops.repository.ServiceEventRepository;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

@Service
public class ReportServiceImpl implements ReportService {

    private static final String FAILURE_STATUS = "FAILURE";

    private final RootCauseScorer rootCauseScorer;
    private final DependencyGraphService dependencyGraphService;
    private final ServiceEventRepository eventRepository;

    public ReportServiceImpl(RootCauseScorer rootCauseScorer, DependencyGraphService dependencyGraphService,
                              ServiceEventRepository eventRepository) {
        this.rootCauseScorer = rootCauseScorer;
        this.dependencyGraphService = dependencyGraphService;
        this.eventRepository = eventRepository;
    }

    @Override
    public Optional<IncidentReportDTO> generateIncidentReport(Duration window) {
        List<RootCauseCandidate> ranked = rootCauseScorer.rankRootCauses(window);
        if (ranked.isEmpty()) {
            return Optional.empty();
        }
        RootCauseCandidate top = ranked.get(0);

        Set<String> affectedServices = new HashSet<>(top.affectedDownstreamServices());
        affectedServices.add(top.service());

        Instant cutoff = Instant.now().minus(window);
        // Reuses the same top-50 read the Events endpoint already serves - no new
        // repository method needed, and it honestly includes both SUCCESS and
        // FAILURE events for the affected services, not just failures.
        List<ServiceEvent> timeline = eventRepository.findTop50ByOrderByReceivedAtDesc().stream()
                .filter(e -> affectedServices.contains(e.getSourceService()) || affectedServices.contains(e.getTargetService()))
                .filter(e -> !e.getTimestamp().isBefore(cutoff))
                .sorted(Comparator.comparing(ServiceEvent::getTimestamp))
                .toList();

        long failureCount = timeline.stream().filter(e -> FAILURE_STATUS.equals(e.getStatus())).count();

        List<DependencyEdge> relatedEdges = dependencyGraphService.getCurrentGraph().stream()
                .filter(edge -> affectedServices.contains(edge.sourceService()) || affectedServices.contains(edge.targetService()))
                .toList();

        String incidentId = timeline.stream()
                .filter(e -> FAILURE_STATUS.equals(e.getStatus()))
                .findFirst()
                .map(ServiceEvent::getEventId)
                .orElse("incident-" + top.service());

        String reportId = "R-" + incidentId.substring(0, Math.min(8, incidentId.length())).toUpperCase()
                + "-" + Instant.now().getEpochSecond();

        return Optional.of(new IncidentReportDTO(
                reportId,
                Instant.now(),
                incidentId,
                top.service(),
                top.score(),
                top.reason(),
                top.affectedDownstreamServices(),
                relatedEdges,
                timeline,
                failureCount
        ));
    }
}
