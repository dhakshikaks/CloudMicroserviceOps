package com.cloudops.payment.dto;

import com.cloudops.payment.model.Payment;

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
    public static PaymentResponse from(Payment payment) {
        return new PaymentResponse(
                payment.getId(),
                payment.getOrderId(),
                payment.getItemId(),
                payment.getQuantity(),
                payment.getAmount(),
                payment.getStatus(),
                payment.getCreatedAt()
        );
    }
}
