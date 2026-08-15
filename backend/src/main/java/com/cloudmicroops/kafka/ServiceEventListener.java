package com.cloudmicroops.kafka;

import com.cloudmicroops.service.EventIngestionService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

@Component
public class ServiceEventListener {

    private static final Logger log = LoggerFactory.getLogger(ServiceEventListener.class);

    private final EventIngestionService ingestionService;
    private final ObjectMapper objectMapper;

    public ServiceEventListener(EventIngestionService ingestionService, ObjectMapper objectMapper) {
        this.ingestionService = ingestionService;
        this.objectMapper = objectMapper;
    }

    @KafkaListener(topics = "microservice-events", groupId = "backend")
    public void onMessage(String rawMessage) {
        try {
            ServiceCallEvent event = objectMapper.readValue(rawMessage, ServiceCallEvent.class);
            ingestionService.ingest(event);
        } catch (Exception e) {
            log.error("Failed to process message from microservice-events: {}", e.getMessage());
        }
    }
}
