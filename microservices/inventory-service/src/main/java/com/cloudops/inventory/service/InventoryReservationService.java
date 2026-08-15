package com.cloudops.inventory.service;

import com.cloudops.inventory.dto.ReserveInventoryRequest;
import com.cloudops.inventory.model.InventoryReservation;
import com.cloudops.inventory.repository.InventoryReservationRepository;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.NoSuchElementException;

@Service
public class InventoryReservationService {

    private final InventoryReservationRepository repository;

    public InventoryReservationService(InventoryReservationRepository repository) {
        this.repository = repository;
    }

    public InventoryReservation reserve(ReserveInventoryRequest request) {
        String status = request.quantity() > 0 ? "RESERVED" : "REJECTED";
        InventoryReservation reservation = new InventoryReservation(
                request.orderId(), request.itemId(), request.quantity(), status, Instant.now());
        return repository.save(reservation);
    }

    public InventoryReservation get(Long id) {
        return repository.findById(id)
                .orElseThrow(() -> new NoSuchElementException("Reservation not found: " + id));
    }
}
