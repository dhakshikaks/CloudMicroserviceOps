package com.cloudops.order.dto;

import com.cloudops.order.model.Order;

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
    public static OrderResponse from(Order order) {
        return new OrderResponse(
                order.getId(),
                order.getUserId(),
                order.getItemId(),
                order.getQuantity(),
                order.getAmount(),
                order.getStatus(),
                order.getCreatedAt()
        );
    }
}
