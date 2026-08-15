package com.cloudmicroops.controller;

import com.cloudmicroops.model.ServiceEvent;
import com.cloudmicroops.repository.ServiceEventRepository;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/events")
public class ServiceEventController {

    private final ServiceEventRepository repository;

    public ServiceEventController(ServiceEventRepository repository) {
        this.repository = repository;
    }

    @GetMapping("/recent")
    public List<ServiceEvent> recent() {
        return repository.findTop50ByOrderByReceivedAtDesc();
    }
}
