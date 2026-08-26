package com.cloudmicroops.error;

import com.cloudmicroops.metrics.PrometheusUnavailableException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.client.RestClientException;

import java.time.Instant;
import java.util.Map;

/**
 * Backend-wide fallback for the one class of failure every observability
 * endpoint shares: Prometheus being unreachable, timing out, or returning an
 * error. Reported as a clear, honest 503 with an explanatory body - never
 * swallowed into fabricated data, and never left as a bare unstructured 500.
 * A single query genuinely failing does not itself reach here; callers that
 * can tolerate partial data (see MetricsServiceImpl) catch that case
 * themselves and continue with the metrics that did succeed.
 *
 * Deliberately returns a ResponseEntity directly rather than throwing/using
 * ResponseStatusException: the latter resolves via response.sendError(),
 * which triggers an internal forward to /error that Spring Security
 * re-authorizes from scratch and, for these stateless JWT requests, wrongly
 * answers with 401 instead of the intended status.
 */
@RestControllerAdvice
public class ApiExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(ApiExceptionHandler.class);

    @ExceptionHandler(RestClientException.class)
    public ResponseEntity<Map<String, Object>> handlePrometheusRequestFailure(RestClientException ex) {
        log.warn("Observability backend (Prometheus) request failed: {}", ex.getMessage());
        return unavailable("The observability backend (Prometheus) could not be reached or returned an error.");
    }

    @ExceptionHandler(PrometheusUnavailableException.class)
    public ResponseEntity<Map<String, Object>> handlePrometheusUnavailable(PrometheusUnavailableException ex) {
        log.warn("Observability backend (Prometheus) is unreachable: {}", ex.getMessage());
        return unavailable(ex.getMessage());
    }

    private ResponseEntity<Map<String, Object>> unavailable(String message) {
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(Map.of(
                "timestamp", Instant.now().toString(),
                "status", HttpStatus.SERVICE_UNAVAILABLE.value(),
                "error", "observability_backend_unreachable",
                "message", message
        ));
    }
}
