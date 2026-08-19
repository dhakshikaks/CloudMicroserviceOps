package com.cloudmicroops.metrics;

/** Query-string values match the frontend's metric identifiers exactly (kebab-case). */
public enum MetricType {
    REQUEST_RATE("request-rate"),
    ERROR_RATE("error-rate"),
    LATENCY_P95("latency-p95"),
    CPU("cpu"),
    MEMORY("memory");

    private final String wireValue;

    MetricType(String wireValue) {
        this.wireValue = wireValue;
    }

    public static MetricType fromWireValue(String value) {
        for (MetricType type : values()) {
            if (type.wireValue.equals(value)) {
                return type;
            }
        }
        throw new IllegalArgumentException("Unknown metric: " + value);
    }
}
