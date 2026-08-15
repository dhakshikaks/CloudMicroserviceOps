package com.cloudops.order.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

public record CreateOrderRequest(
        @NotNull Long userId,
        @NotBlank String itemId,
        @Positive int quantity
) {
}
