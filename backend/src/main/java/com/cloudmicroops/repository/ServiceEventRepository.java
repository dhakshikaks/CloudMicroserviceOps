package com.cloudmicroops.repository;

import com.cloudmicroops.model.ServiceEvent;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;

public interface ServiceEventRepository extends JpaRepository<ServiceEvent, String> {

    List<ServiceEvent> findTop50ByOrderByReceivedAtDesc();

    List<ServiceEvent> findByStatusAndTimestampAfter(String status, Instant timestamp);
}
