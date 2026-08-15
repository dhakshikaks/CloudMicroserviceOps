package com.cloudmicroops.rca;

import com.cloudmicroops.graph.DependencyGraphService;
import com.cloudmicroops.model.DependencyEdge;
import com.cloudmicroops.model.RootCauseCandidate;
import com.cloudmicroops.model.ServiceEvent;
import com.cloudmicroops.repository.ServiceEventRepository;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class RootCauseScorerTest {

    private final ServiceEventRepository eventRepository = mock(ServiceEventRepository.class);
    private final DependencyGraphService dependencyGraphService = mock(DependencyGraphService.class);
    private final RootCauseScorer scorer = new RootCauseScorer(eventRepository, dependencyGraphService);

    @Test
    void ranksServiceWithDownstreamImpactAboveItsAffectedCaller() {
        Instant now = Instant.now();
        List<ServiceEvent> failures = List.of(
                event("a-to-b-1", "A", "B", now),
                event("a-to-b-2", "A", "B", now)
        );
        when(eventRepository.findByStatusAndTimestampAfter(eq("FAILURE"), any())).thenReturn(failures);
        when(dependencyGraphService.getCurrentGraph()).thenReturn(List.of(
                new DependencyEdge("A", "B", 10, 8, 2, 0.8, now)
        ));

        List<RootCauseCandidate> ranked = scorer.rankRootCauses(Duration.ofMinutes(5));

        assertEquals(2, ranked.size());
        RootCauseCandidate first = ranked.get(0);
        RootCauseCandidate second = ranked.get(1);

        assertEquals("B", first.service());
        assertEquals(1, first.rank());
        assertEquals(List.of("A"), first.affectedDownstreamServices());
        assertTrue(first.reason().contains("downstream"));

        assertEquals("A", second.service());
        assertEquals(2, second.rank());
        assertEquals("downstream dependency affected", second.reason());

        assertTrue(first.score() > second.score());
    }

    @Test
    void returnsEmptyListWhenNoRecentFailures() {
        when(eventRepository.findByStatusAndTimestampAfter(eq("FAILURE"), any())).thenReturn(List.of());

        List<RootCauseCandidate> ranked = scorer.rankRootCauses(Duration.ofMinutes(5));

        assertTrue(ranked.isEmpty());
    }

    @Test
    void marksFailureAsIsolatedWhenNoGraphRelationshipExplainsIt() {
        Instant now = Instant.now();
        when(eventRepository.findByStatusAndTimestampAfter(eq("FAILURE"), any()))
                .thenReturn(List.of(event("e-to-d", "E", "D", now)));
        when(dependencyGraphService.getCurrentGraph()).thenReturn(List.of());

        List<RootCauseCandidate> ranked = scorer.rankRootCauses(Duration.ofMinutes(5));

        RootCauseCandidate d = ranked.stream().filter(c -> c.service().equals("D")).findFirst().orElseThrow();
        assertEquals("isolated failure", d.reason());
        assertTrue(d.affectedDownstreamServices().isEmpty());
    }

    private static ServiceEvent event(String eventId, String source, String target, Instant timestamp) {
        return new ServiceEvent(eventId, timestamp, source, target, "call", "FAILURE", 50, timestamp);
    }
}
