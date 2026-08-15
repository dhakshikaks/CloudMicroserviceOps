package com.cloudops.inventory.dto;

import com.cloudops.inventory.model.InventoryReservation;

import java.time.Instant;

public record InventoryReservationResponse(
        Long id,
        Long orderId,
        String itemId,
        int quantity,
        String status,
        Instant createdAt
) {
    public static InventoryReservationResponse from(InventoryReservation reservation) {
        return new InventoryReservationResponse(
                reservation.getId(),
                reservation.getOrderId(),
                reservation.getItemId(),
                reservation.getQuantity(),
                reservation.getStatus(),
                reservation.getCreatedAt()
        );
    }
}
