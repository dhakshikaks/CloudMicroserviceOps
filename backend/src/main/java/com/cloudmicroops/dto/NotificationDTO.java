package com.cloudmicroops.dto;

import java.time.Instant;

/**
 * A single notification-worthy signal, derived fresh from real RCA/event
 * data on every request - there is no persisted notification table. The id
 * on an INCIDENT_DETECTED entry is the triggering ServiceEvent's own
 * eventId, so repeated polls of the same ongoing incident produce the same
 * id (letting the frontend dedupe/mark-as-read without server-side state).
 */
public record NotificationDTO(
        String id,
        String type,
        String service,
        String message,
        Instant timestamp,
        String severity
) {
}
