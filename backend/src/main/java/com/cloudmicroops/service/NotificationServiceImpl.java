package com.cloudmicroops.service;

import com.cloudmicroops.dto.NotificationDTO;
import com.cloudmicroops.model.RootCauseCandidate;
import com.cloudmicroops.model.ServiceEvent;
import com.cloudmicroops.rca.RootCauseScorer;
import com.cloudmicroops.repository.ServiceEventRepository;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

@Service
public class NotificationServiceImpl implements NotificationService {

    private static final String FAILURE_STATUS = "FAILURE";
    private static final int MAX_FAILURE_NOTIFICATIONS = 5;

    private final RootCauseScorer rootCauseScorer;
    private final ServiceEventRepository eventRepository;

    public NotificationServiceImpl(RootCauseScorer rootCauseScorer, ServiceEventRepository eventRepository) {
        this.rootCauseScorer = rootCauseScorer;
        this.eventRepository = eventRepository;
    }

    @Override
    public List<NotificationDTO> getRecentNotifications(Duration window) {
        List<NotificationDTO> notifications = new ArrayList<>();
        Instant cutoff = Instant.now().minus(window);
        List<ServiceEvent> failures = eventRepository.findByStatusAndTimestampAfter(FAILURE_STATUS, cutoff);

        List<RootCauseCandidate> ranked = rootCauseScorer.rankRootCauses(window);
        if (!ranked.isEmpty()) {
            RootCauseCandidate top = ranked.get(0);
            // Stable id: the earliest real FAILURE event targeting the root-cause
            // service in this window - the same ongoing incident always yields the
            // same notification id across repeated polls, without server-side state.
            ServiceEvent triggeringEvent = failures.stream()
                    .filter(e -> top.service().equals(e.getTargetService()))
                    .min(Comparator.comparing(ServiceEvent::getTimestamp))
                    .orElse(null);
            String id = triggeringEvent != null ? triggeringEvent.getEventId() : "incident-" + top.service();
            Instant timestamp = triggeringEvent != null ? triggeringEvent.getTimestamp() : Instant.now();
            notifications.add(new NotificationDTO(id, "INCIDENT_DETECTED", top.service(), top.reason(), timestamp, "CRITICAL"));
        }

        failures.stream()
                .sorted(Comparator.comparing(ServiceEvent::getTimestamp).reversed())
                .limit(MAX_FAILURE_NOTIFICATIONS)
                .forEach(e -> notifications.add(new NotificationDTO(
                        e.getEventId(),
                        "FAILURE",
                        e.getTargetService(),
                        e.getSourceService() + " -> " + e.getTargetService() + " (" + e.getOperation() + ") failed",
                        e.getTimestamp(),
                        "WARNING"
                )));

        return notifications;
    }
}
