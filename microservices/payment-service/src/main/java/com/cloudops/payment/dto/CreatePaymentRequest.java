package com.cloudops.payment.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

public record CreatePaymentRequest(
        @NotNull Long orderId,
        @NotBlank String itemId,
        @Positive int quantity,
        @Positive double amount
) {
}
