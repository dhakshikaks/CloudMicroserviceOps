package com.cloudmicroops.metrics;

import org.springframework.stereotype.Service;

import java.util.Map;

@Service
public class HealthServiceImpl implements HealthService {

    private static final String JOB_FILTER = String.join("|", MetricsServiceImpl.MONITORED_SERVICES);

    private final PrometheusClient client;

    public HealthServiceImpl(PrometheusClient client) {
        this.client = client;
    }

    @Override
    public Map<String, Boolean> serviceHealth() {
        Map<String, Double> raw = client.queryInstant("up{job=~\"" + JOB_FILTER + "\"}");
        return raw.entrySet().stream()
                .collect(java.util.stream.Collectors.toMap(Map.Entry::getKey, e -> e.getValue() == 1.0));
    }

    @Override
    public boolean isPrometheusReachable() {
        return client.isReachable();
    }
}
