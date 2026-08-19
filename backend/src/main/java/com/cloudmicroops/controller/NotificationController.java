package com.cloudmicroops.controller;

import com.cloudmicroops.dto.NotificationDTO;
import com.cloudmicroops.service.NotificationService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;
import java.util.List;

@RestController
@RequestMapping("/api/notifications")
public class NotificationController {

    private final NotificationService notificationService;

    public NotificationController(NotificationService notificationService) {
        this.notificationService = notificationService;
    }

    @GetMapping
    public List<NotificationDTO> getNotifications(
            @RequestParam(name = "windowMinutes", required = false, defaultValue = "15") long windowMinutes) {
        return notificationService.getRecentNotifications(Duration.ofMinutes(windowMinutes));
    }
}
