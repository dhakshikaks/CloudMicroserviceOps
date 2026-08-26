package com.cloudmicroops.metrics;

/**
 * Thrown when Prometheus itself is confirmed unreachable (via an explicit
 * {@link PrometheusClient#isReachable()} check) - as opposed to a single
 * PromQL query failing while Prometheus is otherwise fine. Deliberately a
 * plain RuntimeException handled by {@code ApiExceptionHandler} as a
 * ResponseEntity, not a {@code ResponseStatusException}: the latter resolves
 * via {@code response.sendError()}, which triggers an internal forward to
 * {@code /error} that Spring Security re-authorizes against
 * {@code anyRequest().authenticated()} - and that forwarded dispatch does
 * not carry the original request's authentication, so it incorrectly comes
 * back as 401 instead of the intended 503.
 */
public class PrometheusUnavailableException extends RuntimeException {
    public PrometheusUnavailableException(String message) {
        super(message);
    }
}
