package com.cloudops.inventory.repository;

import com.cloudops.inventory.model.InventoryReservation;
import org.springframework.data.jpa.repository.JpaRepository;

public interface InventoryReservationRepository extends JpaRepository<InventoryReservation, Long> {
}
