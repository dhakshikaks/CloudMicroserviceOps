package com.cloudmicroops.dto;

import com.cloudmicroops.model.Role;

public record AuthResponse(String token, String username, Role role) {
}
