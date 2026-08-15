package com.cloudmicroops.service;

import com.cloudmicroops.kafka.ServiceCallEvent;
import com.cloudmicroops.model.ServiceEvent;
import com.cloudmicroops.repository.ServiceEventRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.Instant;

@Service
public class EventIngestionServiceImpl implements EventIngestionService {

    private static final Logger log = LoggerFactory.getLogger(EventIngestionServiceImpl.class);

    private final ServiceEventRepository repository;

    public EventIngestionServiceImpl(ServiceEventRepository repository) {
        this.repository = repository;
    }

    @Override
    public void ingest(ServiceCallEvent event) {
        ServiceEvent entity = new ServiceEvent(
                event.eventId(),
                event.timestamp(),
                event.sourceService(),
                event.targetService(),
                event.operation(),
                event.status(),
                event.durationMs(),
                Instant.now()
        );
        repository.save(entity);
        log.debug("Ingested event {} {} -> {} ({})", event.operation(), event.sourceService(),
                event.targetService(), event.status());
    }
}
