package com.cloudmicroops.service;

import com.cloudmicroops.kafka.ServiceCallEvent;

/**
 * Persists an inter-service call event observed on Kafka to the event log.
 */
public interface EventIngestionService {

    void ingest(ServiceCallEvent event);
}
