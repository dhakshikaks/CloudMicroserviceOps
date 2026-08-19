package com.cloudmicroops.service;

import com.cloudmicroops.dto.NotificationDTO;

import java.time.Duration;
import java.util.List;

public interface NotificationService {

    /** Recomputed fresh on every call from real RCA/event data - never persisted. */
    List<NotificationDTO> getRecentNotifications(Duration window);
}
