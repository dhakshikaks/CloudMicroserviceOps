package com.cloudmicroops.kafka;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.time.Instant;

/**
 * Wire format expected on the {@code microservice-events} Kafka topic.
 * Published by each business microservice around every outbound REST call
 * it makes to another service.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
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
