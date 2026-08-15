package com.cloudops.payment.service;

import com.cloudops.payment.client.InventoryClient;
import com.cloudops.payment.dto.CreatePaymentRequest;
import com.cloudops.payment.model.Payment;
import com.cloudops.payment.repository.PaymentRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.NoSuchElementException;

@Service
public class PaymentService {

    private static final Logger log = LoggerFactory.getLogger(PaymentService.class);

    private final PaymentRepository repository;
    private final InventoryClient inventoryClient;

    public PaymentService(PaymentRepository repository, InventoryClient inventoryClient) {
        this.repository = repository;
        this.inventoryClient = inventoryClient;
    }

    public Payment process(CreatePaymentRequest request) {
        Payment payment = new Payment(
                request.orderId(), request.itemId(), request.quantity(), request.amount(), "PENDING", Instant.now());
        payment = repository.save(payment);

        try {
            var reservation = inventoryClient.reserve(request.orderId(), request.itemId(), request.quantity());
            payment.setStatus("RESERVED".equals(reservation.status()) ? "COMPLETED" : "FAILED");
        } catch (Exception e) {
            log.warn("Inventory reservation failed for order {}: {}", request.orderId(), e.getMessage());
            payment.setStatus("FAILED");
        }

        return repository.save(payment);
    }

    public Payment get(Long id) {
        return repository.findById(id)
                .orElseThrow(() -> new NoSuchElementException("Payment not found: " + id));
    }
}
