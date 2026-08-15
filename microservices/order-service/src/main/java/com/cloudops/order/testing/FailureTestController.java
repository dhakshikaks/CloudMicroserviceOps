package com.cloudops.order.testing;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Testing-only endpoints to demo monitoring/RCA against realistic failures. */
@RestController
@RequestMapping("/api/test/failure")
public class FailureTestController {

    private final FailureSimulationService simulationService;

    public FailureTestController(FailureSimulationService simulationService) {
        this.simulationService = simulationService;
    }

    @PostMapping("/enable")
    public FailureSimulationStatus enable(@RequestParam FailureMode type,
                                           @RequestParam(defaultValue = "2000") long durationMs) {
        simulationService.enable(type, durationMs);
        return simulationService.status();
    }

    @PostMapping("/disable")
    public FailureSimulationStatus disable() {
        simulationService.disable();
        return simulationService.status();
    }

    @GetMapping("/status")
    public FailureSimulationStatus status() {
        return simulationService.status();
    }
}
