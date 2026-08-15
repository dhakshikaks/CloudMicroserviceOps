package com.cloudops.inventory.controller;

import com.cloudops.inventory.dto.InventoryReservationResponse;
import com.cloudops.inventory.dto.ReserveInventoryRequest;
import com.cloudops.inventory.service.InventoryReservationService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.NoSuchElementException;

@RestController
@RequestMapping("/api/inventory/reservations")
public class InventoryController {

    private final InventoryReservationService service;

    public InventoryController(InventoryReservationService service) {
        this.service = service;
    }

    @PostMapping
    public ResponseEntity<InventoryReservationResponse> reserve(@Valid @RequestBody ReserveInventoryRequest request) {
        var reservation = service.reserve(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(InventoryReservationResponse.from(reservation));
    }

    @GetMapping("/{id}")
    public InventoryReservationResponse get(@PathVariable Long id) {
        return InventoryReservationResponse.from(service.get(id));
    }

    @ExceptionHandler(NoSuchElementException.class)
    public ResponseEntity<String> handleNotFound(NoSuchElementException e) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(e.getMessage());
    }
}
