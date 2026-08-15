package com.cloudops.payment.dto;

import java.time.Instant;

public record InventoryReservationResponse(
        Long id,
        Long orderId,
        String itemId,
        int quantity,
        String status,
        Instant createdAt
) {
}
