package com.cloudops.user.dto;

import java.time.Instant;

public record OrderResponse(
        Long id,
        Long userId,
        String itemId,
        int quantity,
        double amount,
        String status,
        Instant createdAt
) {
}
