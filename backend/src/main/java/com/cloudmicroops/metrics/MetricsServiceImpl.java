package com.cloudmicroops.metrics;

import com.cloudmicroops.metrics.dto.MetricsSnapshotDTO;
import com.cloudmicroops.metrics.dto.RangeSeriesDTO;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;

/**
 * Owns every PromQL string this product issues. Ported verbatim from the
 * frontend's former services/api.ts so chart values/resolution are
 * unchanged - only the layer that talks to Prometheus moved.
 */
@Service
public class MetricsServiceImpl implements MetricsService {

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
        return new MetricsSnapshotDTO(
                client.queryInstant("process_cpu_usage{job=~\"" + JOB_FILTER + "\"}"),
                client.queryInstant("sum(jvm_memory_used_bytes{area=\"heap\", job=~\"" + JOB_FILTER + "\"}) by (job)"),
                client.queryInstant("sum(rate(http_server_requests_seconds_count{job=~\"" + JOB_FILTER + "\"}[1m])) by (job)"),
                client.queryInstant("sum(rate(http_server_requests_seconds_count{job=~\"" + JOB_FILTER + "\", status=~\"5..\"}[1m])) by (job)"),
                client.queryInstant("histogram_quantile(0.95, sum(rate(http_server_requests_seconds_bucket{job=~\"" + JOB_FILTER + "\"}[1m])) by (le, job))")
        );
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
