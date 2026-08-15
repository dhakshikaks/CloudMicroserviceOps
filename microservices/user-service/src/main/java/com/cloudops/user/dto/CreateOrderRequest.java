package com.cloudops.user.dto;

public record CreateOrderRequest(Long userId, String itemId, int quantity) {
}
