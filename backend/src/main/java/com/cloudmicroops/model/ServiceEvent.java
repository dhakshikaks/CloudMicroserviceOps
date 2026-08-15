package com.cloudmicroops.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;

/**
 * Normalized, persisted representation of a single inter-service REST call
 * observed on the {@code microservice-events} Kafka topic. This is the raw
 * substrate used to infer the service dependency graph.
 */
@Entity
@Table(name = "service_events")
public class ServiceEvent {

    @Id
    @Column(name = "event_id")
    private String eventId;

    @Column(nullable = false)
    private Instant timestamp;

    @Column(name = "source_service", nullable = false)
    private String sourceService;

    @Column(name = "target_service", nullable = false)
    private String targetService;

    @Column(nullable = false)
    private String operation;

    @Column(nullable = false)
    private String status;

    @Column(name = "duration_ms", nullable = false)
    private long durationMs;

    @Column(name = "received_at", nullable = false)
    private Instant receivedAt;

    protected ServiceEvent() {
        // JPA
    }

    public ServiceEvent(String eventId, Instant timestamp, String sourceService, String targetService,
                         String operation, String status, long durationMs, Instant receivedAt) {
        this.eventId = eventId;
        this.timestamp = timestamp;
        this.sourceService = sourceService;
        this.targetService = targetService;
        this.operation = operation;
        this.status = status;
        this.durationMs = durationMs;
        this.receivedAt = receivedAt;
    }

    public String getEventId() {
        return eventId;
    }

    public Instant getTimestamp() {
        return timestamp;
    }

    public String getSourceService() {
        return sourceService;
    }

    public String getTargetService() {
        return targetService;
    }

    public String getOperation() {
        return operation;
    }

    public String getStatus() {
        return status;
    }

    public long getDurationMs() {
        return durationMs;
    }

    public Instant getReceivedAt() {
        return receivedAt;
    }
}
