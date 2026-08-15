package com.cloudops.user.dto;

import com.cloudops.user.model.User;

import java.time.Instant;

public record UserResponse(Long id, String name, String email, Instant createdAt) {
    public static UserResponse from(User user) {
        return new UserResponse(user.getId(), user.getName(), user.getEmail(), user.getCreatedAt());
    }
}
