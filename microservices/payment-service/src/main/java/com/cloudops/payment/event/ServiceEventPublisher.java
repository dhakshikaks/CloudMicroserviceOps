package com.cloudops.payment.event;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.UUID;

@Component
public class ServiceEventPublisher {

    private static final String TOPIC = "microservice-events";

    private final KafkaTemplate<String, Object> kafkaTemplate;
    private final String sourceService;

    public ServiceEventPublisher(KafkaTemplate<String, Object> kafkaTemplate,
                                  @Value("${spring.application.name}") String sourceService) {
        this.kafkaTemplate = kafkaTemplate;
        this.sourceService = sourceService;
    }

    public void publish(String targetService, String operation, String status, long durationMs) {
        var event = new ServiceCallEvent(
                UUID.randomUUID().toString(), Instant.now(), sourceService, targetService, operation, status, durationMs);
        kafkaTemplate.send(TOPIC, event.eventId(), event);
    }
}
