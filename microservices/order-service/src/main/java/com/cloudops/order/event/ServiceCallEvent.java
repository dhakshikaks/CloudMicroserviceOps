package com.cloudops.order.event;

import java.time.Instant;

/**
 * Wire format published to the {@code microservice-events} Kafka topic for
 * every outbound REST call this service makes. Consumed and persisted by
 * the backend.
 */
public record ServiceCallEvent(
        String eventId,
        Instant timestamp,
        String sourceService,
        String targetService,
        String operation,
        String status,
        long durationMs
) {
}
