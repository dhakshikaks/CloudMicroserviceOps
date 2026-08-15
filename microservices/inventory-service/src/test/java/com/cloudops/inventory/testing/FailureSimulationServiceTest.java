package com.cloudops.inventory.testing;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class FailureSimulationServiceTest {

    private final FailureSimulationService service = new FailureSimulationService();

    @Test
    void isDisabledByDefault() {
        FailureSimulationStatus status = service.status();
        assertFalse(status.enabled());
        assertNull(status.mode());
    }

    @Test
    void enableSetsModeAndDuration() {
        service.enable(FailureMode.HIGH_LATENCY, 1500);

        FailureSimulationStatus status = service.status();
        assertTrue(status.enabled());
        assertEquals(FailureMode.HIGH_LATENCY, status.mode());
        assertEquals(1500, status.durationMs());
    }

    @Test
    void disableResetsToDefaultState() {
        service.enable(FailureMode.ERROR, 1000);
        service.disable();

        assertEquals(FailureSimulationStatus.disabled(), service.status());
    }

    @Test
    void simulateCpuLoadRunsForApproximatelyRequestedDuration() {
        long start = System.currentTimeMillis();
        service.simulateCpuLoad(100);
        long elapsed = System.currentTimeMillis() - start;

        assertTrue(elapsed >= 90, "expected at least ~100ms of busy work, took " + elapsed + "ms");
        assertTrue(elapsed < 1000, "busy work ran far longer than requested: " + elapsed + "ms");
    }
}
