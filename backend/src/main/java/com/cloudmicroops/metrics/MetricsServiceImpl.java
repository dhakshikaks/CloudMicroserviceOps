package com.cloudmicroops.metrics;

import com.cloudmicroops.metrics.dto.MetricsSnapshotDTO;
import com.cloudmicroops.metrics.dto.RangeSeriesDTO;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;

import java.time.Instant;
import java.util.List;
import java.util.Map;

/**
 * Owns every PromQL string this product issues. Ported verbatim from the
 * frontend's former services/api.ts so chart values/resolution are
 * unchanged - only the layer that talks to Prometheus moved.
 */
@Service
public class MetricsServiceImpl implements MetricsService {

    private static final Logger log = LoggerFactory.getLogger(MetricsServiceImpl.class);

    // Must stay in sync with MONITORED_SERVICES in frontend/src/services/api.ts.
    static final List<String> MONITORED_SERVICES = List.of(
            "backend", "user-service", "order-service", "payment-service", "inventory-service"
    );
    private static final String JOB_FILTER = String.join("|", MONITORED_SERVICES);

    private final PrometheusClient client;

    public MetricsServiceImpl(PrometheusClient client) {
        this.client = client;
    }

    @Override
    public MetricsSnapshotDTO snapshot() {
        // A fully unreachable Prometheus is a distinct, honest failure - the
        // caller should see that the observability backend is down, not a
        // snapshot that's silently all-empty and indistinguishable from
        // "these five metrics all happen to have no data right now".
        if (!client.isReachable()) {
            throw new PrometheusUnavailableException("Observability backend (Prometheus) is unreachable");
        }
        return new MetricsSnapshotDTO(
                queryOrEmpty("process_cpu_usage{job=~\"" + JOB_FILTER + "\"}"),
                queryOrEmpty("sum(jvm_memory_used_bytes{area=\"heap\", job=~\"" + JOB_FILTER + "\"}) by (job)"),
                queryOrEmpty("sum(rate(http_server_requests_seconds_count{job=~\"" + JOB_FILTER + "\"}[1m])) by (job)"),
                queryOrEmpty("sum(rate(http_server_requests_seconds_count{job=~\"" + JOB_FILTER + "\", status=~\"5..\"}[1m])) by (job)"),
                queryOrEmpty("histogram_quantile(0.95, sum(rate(http_server_requests_seconds_bucket{job=~\"" + JOB_FILTER + "\"}[1m])) by (le, job))")
        );
    }

    /**
     * One metric's query failing (a bad expression, a metric this Prometheus
     * version doesn't expose, a transient scrape gap) must not take down the
     * other four - every consumer of ServiceMetrics already treats a missing
     * job entry as "no data for that metric" (renders as "-"), so an empty
     * map here is the honest signal, not a fabricated one.
     */
    private Map<String, Double> queryOrEmpty(String promql) {
        try {
            return client.queryInstant(promql);
        } catch (RestClientException e) {
            log.warn("Prometheus query failed, returning partial metrics snapshot: {}", promql, e);
            return Map.of();
        }
    }

    @Override
    public List<RangeSeriesDTO> range(MetricType metric, TimeWindow window, boolean byService) {
        String promql = promqlFor(metric, byService);
        long end = Instant.now().getEpochSecond();
        long start = end - window.durationSeconds();
        return client.queryRange(promql, start, end, window.stepSeconds());
    }

    private String promqlFor(MetricType metric, boolean byService) {
        String by = byService ? " by (job)" : "";
        String byLe = byService ? " by (le, job)" : " by (le)";
        return switch (metric) {
            case REQUEST_RATE -> "sum(rate(http_server_requests_seconds_count{job=~\"" + JOB_FILTER + "\"}[1m]))" + by;
            case ERROR_RATE ->
                    "sum(rate(http_server_requests_seconds_count{job=~\"" + JOB_FILTER + "\", status=~\"5..\"}[1m]))" + by;
            case LATENCY_P95 ->
                    "histogram_quantile(0.95, sum(rate(http_server_requests_seconds_bucket{job=~\"" + JOB_FILTER + "\"}[1m]))" + byLe + ")";
            case CPU -> byService ? "process_cpu_usage{job=~\"" + JOB_FILTER + "\"}" : "avg(process_cpu_usage{job=~\"" + JOB_FILTER + "\"})";
            case MEMORY -> "sum(jvm_memory_used_bytes{area=\"heap\", job=~\"" + JOB_FILTER + "\"}) by (job)";
        };
    }
}
