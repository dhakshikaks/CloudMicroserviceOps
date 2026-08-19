package com.cloudmicroops.metrics;

import com.cloudmicroops.metrics.dto.MetricsSnapshotDTO;
import com.cloudmicroops.metrics.dto.RangeSeriesDTO;

import java.util.List;

public interface MetricsService {

    /** Instant CPU/memory/requestRate/errorRate/latencyP95 for every monitored service, one Prometheus round trip each. */
    MetricsSnapshotDTO snapshot();

    /**
     * Historical series for one metric over one time window.
     * byService=true returns one series per job (Prometheus "by (job)"),
     * byService=false returns a single aggregate series across all monitored services.
     */
    List<RangeSeriesDTO> range(MetricType metric, TimeWindow window, boolean byService);
}
