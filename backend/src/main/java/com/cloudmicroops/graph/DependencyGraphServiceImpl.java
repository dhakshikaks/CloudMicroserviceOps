package com.cloudmicroops.graph;

import com.cloudmicroops.model.DependencyEdge;
import com.cloudmicroops.model.ServiceEvent;
import com.cloudmicroops.repository.ServiceEventRepository;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class DependencyGraphServiceImpl implements DependencyGraphService {

    private final ServiceEventRepository eventRepository;
    private final ConfidenceScorer confidenceScorer;

    public DependencyGraphServiceImpl(ServiceEventRepository eventRepository, ConfidenceScorer confidenceScorer) {
        this.eventRepository = eventRepository;
        this.confidenceScorer = confidenceScorer;
    }

    @Override
    public List<DependencyEdge> getCurrentGraph() {
        return eventRepository.findAll().stream()
                .collect(Collectors.groupingBy(e -> new EdgeKey(e.getSourceService(), e.getTargetService())))
                .entrySet().stream()
                .map(entry -> toEdge(entry.getKey(), entry.getValue()))
                .toList();
    }

    private DependencyEdge toEdge(EdgeKey key, List<ServiceEvent> events) {
        long total = events.size();
        long successful = events.stream().filter(e -> "SUCCESS".equals(e.getStatus())).count();
        long failed = total - successful;
        Instant lastObservedAt = events.stream()
                .map(ServiceEvent::getTimestamp)
                .max(Comparator.naturalOrder())
                .orElse(null);

        return new DependencyEdge(key.sourceService(), key.targetService(), total, successful, failed,
                confidenceScorer.score(total, successful), lastObservedAt);
    }

    private record EdgeKey(String sourceService, String targetService) {
    }
}
