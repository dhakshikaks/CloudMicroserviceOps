package com.cloudops.payment.testing;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Optional;
import java.util.Set;

/**
 * Requires an OPERATOR or ADMIN JWT for the failure-simulation control
 * endpoints only. Does not affect any other endpoint or the simulation
 * behavior itself.
 */
@Component
public class FailureSimulationAuthFilter extends OncePerRequestFilter {

    private static final Set<String> ALLOWED_ROLES = Set.of("OPERATOR", "ADMIN");

    private final JwtValidator jwtValidator;

    public FailureSimulationAuthFilter(JwtValidator jwtValidator) {
        this.jwtValidator = jwtValidator;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        if (!request.getRequestURI().startsWith("/api/test/failure/")) {
            chain.doFilter(request, response);
            return;
        }

        String header = request.getHeader("Authorization");
        if (header == null || !header.startsWith("Bearer ")) {
            respond(response, HttpServletResponse.SC_UNAUTHORIZED, "Missing bearer token");
            return;
        }

        Optional<String> role = jwtValidator.extractRole(header.substring(7));
        if (role.isEmpty()) {
            respond(response, HttpServletResponse.SC_UNAUTHORIZED, "Invalid or expired token");
            return;
        }
        if (!ALLOWED_ROLES.contains(role.get())) {
            respond(response, HttpServletResponse.SC_FORBIDDEN, "OPERATOR or ADMIN role required");
            return;
        }
        chain.doFilter(request, response);
    }

    private void respond(HttpServletResponse response, int status, String message) throws IOException {
        response.setStatus(status);
        response.setContentType("application/json");
        response.getWriter().write("{\"error\":\"" + message + "\"}");
    }
}
