package com.cloudmicroops.metrics;

import com.cloudmicroops.metrics.dto.RangeSampleDTO;
import com.cloudmicroops.metrics.dto.RangeSeriesDTO;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Thin wrapper around Prometheus's HTTP API. This is the only place in the
 * backend that knows Prometheus exists - everything else (MetricsService,
 * HealthService) works with plain PromQL strings and gets back real,
 * unmodified numbers. Reachable at prometheus:9090 on the compose network,
 * the same host Nginx already proxies /prometheus/ to for humans.
 */
@Component
public class PrometheusClient {

    private final RestClient restClient;

    public PrometheusClient(@Value("${prometheus.url:http://prometheus:9090}") String prometheusUrl) {
        this.restClient = RestClient.create(prometheusUrl);
    }

    /** @return job label -> instant value, for every series Prometheus returned. */
    public Map<String, Double> queryInstant(String promql) {
        // PromQL queries contain literal { } themselves (e.g. up{job=~"..."}),
        // and UriBuilder.build() re-parses the whole assembled URI as a template
        // and tries to expand any {...} it finds - including ones inside an
        // already-added query param value. Routing the query through a named
        // "{q}" placeholder and build(promql) makes it the one and only
        // template variable, so its value (braces and all) is encoded as opaque
        // data instead of being interpreted as further template syntax.
        PrometheusVectorResponse response = restClient.get()
                .uri(uriBuilder -> uriBuilder.path("/api/v1/query").queryParam("query", "{q}").build(promql))
                .retrieve()
                .body(PrometheusVectorResponse.class);
        Map<String, Double> byJob = new LinkedHashMap<>();
        if (response == null || response.data() == null || response.data().result() == null) {
            return byJob;
        }
        for (VectorResult result : response.data().result()) {
            String job = result.metric().get("job");
            if (job != null && result.value() != null && result.value().size() == 2) {
                byJob.put(job, Double.parseDouble(result.value().get(1)));
            }
        }
        return byJob;
    }

    public List<RangeSeriesDTO> queryRange(String promql, long startSec, long endSec, long stepSec) {
        PrometheusRangeResponse response = restClient.get()
                .uri(uriBuilder -> uriBuilder.path("/api/v1/query_range")
                        .queryParam("query", "{q}")
                        .queryParam("start", startSec)
                        .queryParam("end", endSec)
                        .queryParam("step", stepSec)
                        .build(promql))
                .retrieve()
                .body(PrometheusRangeResponse.class);
        if (response == null || response.data() == null || response.data().result() == null) {
            return List.of();
        }
        return response.data().result().stream()
                .map(result -> new RangeSeriesDTO(
                        result.metric(),
                        result.values().stream()
                                .map(pair -> new RangeSampleDTO((long) Double.parseDouble(pair.get(0)), Double.parseDouble(pair.get(1))))
                                .toList()
                ))
                .toList();
    }

    /** @return true if Prometheus answered a trivial query at all - used by the System Health page. */
    public boolean isReachable() {
        try {
            restClient.get()
                    .uri(uriBuilder -> uriBuilder.path("/api/v1/query").queryParam("query", "up").build())
                    .retrieve()
                    .toBodilessEntity();
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    private record PrometheusVectorResponse(VectorData data) {
    }

    private record VectorData(List<VectorResult> result) {
    }

    private record VectorResult(Map<String, String> metric, List<String> value) {
    }

    private record PrometheusRangeResponse(RangeData data) {
    }

    private record RangeData(List<RangeResult> result) {
    }

    private record RangeResult(Map<String, String> metric, List<List<String>> values) {
    }
}
