package com.cloudops.order.dto;

import java.time.Instant;

public record PaymentResponse(
        Long id,
        Long orderId,
        String itemId,
        int quantity,
        double amount,
        String status,
        Instant createdAt
) {
}
