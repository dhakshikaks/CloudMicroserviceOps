package com.cloudops.user.client;

import com.cloudops.user.dto.CreateOrderRequest;
import com.cloudops.user.dto.OrderResponse;
import com.cloudops.user.event.ServiceEventPublisher;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

@Component
public class OrderClient {

    private static final String TARGET_SERVICE = "order-service";
    private static final String OPERATION = "create-order";

    private final RestClient orderServiceClient;
    private final ServiceEventPublisher eventPublisher;

    public OrderClient(RestClient orderServiceClient, ServiceEventPublisher eventPublisher) {
        this.orderServiceClient = orderServiceClient;
        this.eventPublisher = eventPublisher;
    }

    public OrderResponse placeOrder(Long userId, String itemId, int quantity) {
        long start = System.currentTimeMillis();
        try {
            OrderResponse response = orderServiceClient.post()
                    .uri("/api/orders")
                    .body(new CreateOrderRequest(userId, itemId, quantity))
                    .retrieve()
                    .body(OrderResponse.class);
            eventPublisher.publish(TARGET_SERVICE, OPERATION, "SUCCESS", System.currentTimeMillis() - start);
            return response;
        } catch (Exception e) {
            eventPublisher.publish(TARGET_SERVICE, OPERATION, "FAILURE", System.currentTimeMillis() - start);
            throw e;
        }
    }
}
