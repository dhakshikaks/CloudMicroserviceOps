package com.cloudmicroops.controller;

import com.cloudmicroops.metrics.MetricType;
import com.cloudmicroops.metrics.MetricsService;
import com.cloudmicroops.metrics.TimeWindow;
import com.cloudmicroops.metrics.dto.MetricsSnapshotDTO;
import com.cloudmicroops.metrics.dto.RangeSeriesDTO;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/metrics")
public class MetricsController {

    private final MetricsService metricsService;

    public MetricsController(MetricsService metricsService) {
        this.metricsService = metricsService;
    }

    @GetMapping("/snapshot")
    public MetricsSnapshotDTO getSnapshot() {
        return metricsService.snapshot();
    }

    @GetMapping("/range")
    public List<RangeSeriesDTO> getRange(
            @RequestParam String metric,
            @RequestParam String window,
            @RequestParam(defaultValue = "false") boolean byService) {
        return metricsService.range(MetricType.fromWireValue(metric), TimeWindow.fromWireValue(window), byService);
    }
}
