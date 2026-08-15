package com.cloudops.user.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;

public record PlaceOrderRequest(
        @NotBlank String itemId,
        @Positive int quantity
) {
}
