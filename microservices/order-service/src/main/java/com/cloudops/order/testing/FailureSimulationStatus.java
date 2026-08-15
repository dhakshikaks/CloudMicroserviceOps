package com.cloudops.order.testing;

public record FailureSimulationStatus(boolean enabled, FailureMode mode, long durationMs) {

    public static FailureSimulationStatus disabled() {
        return new FailureSimulationStatus(false, null, 0);
    }
}
