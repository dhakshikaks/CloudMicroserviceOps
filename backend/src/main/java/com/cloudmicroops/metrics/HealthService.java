package com.cloudmicroops.metrics;

import java.util.Map;

public interface HealthService {

    /**
     * up/down for every monitored service. A service missing from the map
     * means Prometheus has not scraped it yet - distinct from an explicit
     * down - exactly as the frontend already interprets an absent key.
     */
    Map<String, Boolean> serviceHealth();

    boolean isPrometheusReachable();
}
