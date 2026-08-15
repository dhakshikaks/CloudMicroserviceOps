package com.cloudops.payment.client;

import com.cloudops.payment.dto.InventoryReservationResponse;
import com.cloudops.payment.dto.ReserveInventoryRequest;
import com.cloudops.payment.event.ServiceEventPublisher;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

@Component
public class InventoryClient {

    private static final String TARGET_SERVICE = "inventory-service";
    private static final String OPERATION = "reserve-inventory";

    private final RestClient inventoryServiceClient;
    private final ServiceEventPublisher eventPublisher;

    public InventoryClient(RestClient inventoryServiceClient, ServiceEventPublisher eventPublisher) {
        this.inventoryServiceClient = inventoryServiceClient;
        this.eventPublisher = eventPublisher;
    }

    public InventoryReservationResponse reserve(Long orderId, String itemId, int quantity) {
        long start = System.currentTimeMillis();
        try {
            InventoryReservationResponse response = inventoryServiceClient.post()
                    .uri("/api/inventory/reservations")
                    .body(new ReserveInventoryRequest(orderId, itemId, quantity))
                    .retrieve()
                    .body(InventoryReservationResponse.class);
            eventPublisher.publish(TARGET_SERVICE, OPERATION, "SUCCESS", System.currentTimeMillis() - start);
            return response;
        } catch (Exception e) {
            eventPublisher.publish(TARGET_SERVICE, OPERATION, "FAILURE", System.currentTimeMillis() - start);
            throw e;
        }
    }
}
