package com.cloudops.order.client;

import com.cloudops.order.dto.CreatePaymentRequest;
import com.cloudops.order.dto.PaymentResponse;
import com.cloudops.order.event.ServiceEventPublisher;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

@Component
public class PaymentClient {

    private static final String TARGET_SERVICE = "payment-service";
    private static final String OPERATION = "process-payment";

    private final RestClient paymentServiceClient;
    private final ServiceEventPublisher eventPublisher;

    public PaymentClient(RestClient paymentServiceClient, ServiceEventPublisher eventPublisher) {
        this.paymentServiceClient = paymentServiceClient;
        this.eventPublisher = eventPublisher;
    }

    public PaymentResponse pay(Long orderId, String itemId, int quantity, double amount) {
        long start = System.currentTimeMillis();
        try {
            PaymentResponse response = paymentServiceClient.post()
                    .uri("/api/payments")
                    .body(new CreatePaymentRequest(orderId, itemId, quantity, amount))
                    .retrieve()
                    .body(PaymentResponse.class);
            eventPublisher.publish(TARGET_SERVICE, OPERATION, "SUCCESS", System.currentTimeMillis() - start);
            return response;
        } catch (Exception e) {
            eventPublisher.publish(TARGET_SERVICE, OPERATION, "FAILURE", System.currentTimeMillis() - start);
            throw e;
        }
    }
}
