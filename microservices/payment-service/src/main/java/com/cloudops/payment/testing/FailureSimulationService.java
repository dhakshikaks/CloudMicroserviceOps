package com.cloudops.payment.testing;

import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Holds the current failure-simulation state for this service instance.
 * Testing-only: disabled by default, in-memory, not persisted.
 */
@Component
public class FailureSimulationService {

    private final AtomicReference<FailureSimulationStatus> state =
            new AtomicReference<>(FailureSimulationStatus.disabled());

    public void enable(FailureMode mode, long durationMs) {
        state.set(new FailureSimulationStatus(true, mode, durationMs));
    }

    public void disable() {
        state.set(FailureSimulationStatus.disabled());
    }

    public FailureSimulationStatus status() {
        return state.get();
    }

    /** Busy-spins the calling thread for approximately durationMs. */
    public void simulateCpuLoad(long durationMs) {
        long deadline = System.nanoTime() + Duration.ofMillis(durationMs).toNanos();
        double x = 1;
        while (System.nanoTime() < deadline) {
            x = Math.sqrt(x) + 1;
        }
    }
}
