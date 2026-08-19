package com.cloudmicroops.controller;

import com.cloudmicroops.metrics.HealthService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/health")
public class HealthController {

    private final HealthService healthService;

    public HealthController(HealthService healthService) {
        this.healthService = healthService;
    }

    @GetMapping("/services")
    public Map<String, Boolean> getServiceHealth() {
        return healthService.serviceHealth();
    }

    @GetMapping("/prometheus")
    public Map<String, Boolean> getPrometheusHealth() {
        return Map.of("reachable", healthService.isPrometheusReachable());
    }
}
