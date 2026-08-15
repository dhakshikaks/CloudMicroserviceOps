package com.cloudops.inventory.testing;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * Applies the active failure simulation (if any) to real request traffic.
 * Test-control and actuator endpoints are exempt so the simulation can
 * always be observed and disabled.
 */
@Component
public class FailureSimulationFilter extends OncePerRequestFilter {

    private final FailureSimulationService simulationService;

    public FailureSimulationFilter(FailureSimulationService simulationService) {
        this.simulationService = simulationService;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String path = request.getRequestURI();
        FailureSimulationStatus status = simulationService.status();

        if (!status.enabled() || path.startsWith("/api/test/") || path.startsWith("/actuator/")) {
            chain.doFilter(request, response);
            return;
        }

        switch (status.mode()) {
            case ERROR -> {
                response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
                response.setContentType("application/json");
                response.getWriter().write("{\"error\":\"simulated failure\"}");
                return;
            }
            case HIGH_LATENCY -> sleep(status.durationMs());
            case CPU_LOAD -> simulationService.simulateCpuLoad(status.durationMs());
        }
        chain.doFilter(request, response);
    }

    private void sleep(long durationMs) {
        try {
            Thread.sleep(durationMs);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
