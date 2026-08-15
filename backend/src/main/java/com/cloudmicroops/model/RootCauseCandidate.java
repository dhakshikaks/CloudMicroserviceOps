package com.cloudmicroops.model;

import java.util.List;

/**
 * A ranked candidate root-cause service for an observed failure.
 */
public record RootCauseCandidate(
        String service,
        double score,
        int rank,
        List<String> affectedDownstreamServices,
        String reason
) {
}
