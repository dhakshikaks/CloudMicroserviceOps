package com.cloudops.order.service;

import com.cloudops.order.client.PaymentClient;
import com.cloudops.order.dto.CreateOrderRequest;
import com.cloudops.order.model.Order;
import com.cloudops.order.repository.OrderRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.NoSuchElementException;

@Service
public class OrderService {

    private static final Logger log = LoggerFactory.getLogger(OrderService.class);
    private static final double UNIT_PRICE = 25.0;

    private final OrderRepository repository;
    private final PaymentClient paymentClient;

    public OrderService(OrderRepository repository, PaymentClient paymentClient) {
        this.repository = repository;
        this.paymentClient = paymentClient;
    }

    public Order create(CreateOrderRequest request) {
        double amount = request.quantity() * UNIT_PRICE;
        Order order = new Order(
                request.userId(), request.itemId(), request.quantity(), amount, "PENDING", Instant.now());
        order = repository.save(order);

        try {
            var payment = paymentClient.pay(order.getId(), request.itemId(), request.quantity(), amount);
            order.setStatus("COMPLETED".equals(payment.status()) ? "CONFIRMED" : "FAILED");
        } catch (Exception e) {
            log.warn("Payment failed for order {}: {}", order.getId(), e.getMessage());
            order.setStatus("FAILED");
        }

        return repository.save(order);
    }

    public Order get(Long id) {
        return repository.findById(id)
                .orElseThrow(() -> new NoSuchElementException("Order not found: " + id));
    }
}
