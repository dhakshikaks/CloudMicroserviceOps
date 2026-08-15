package com.cloudops.payment.dto;

public record ReserveInventoryRequest(Long orderId, String itemId, int quantity) {
}
