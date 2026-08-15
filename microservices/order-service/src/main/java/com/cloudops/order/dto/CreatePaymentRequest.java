package com.cloudops.order.dto;

public record CreatePaymentRequest(Long orderId, String itemId, int quantity, double amount) {
}
