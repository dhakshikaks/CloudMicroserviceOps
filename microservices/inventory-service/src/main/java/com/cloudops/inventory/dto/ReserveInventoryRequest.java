package com.cloudops.inventory.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

public record ReserveInventoryRequest(
        @NotNull Long orderId,
        @NotBlank String itemId,
        @Positive int quantity
) {
}
