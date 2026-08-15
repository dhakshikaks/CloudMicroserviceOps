package com.cloudmicroops.model;

/**
 * ADMIN has full access; OPERATOR additionally may run failure simulation
 * on the business microservices; VIEWER is read-only.
 */
public enum Role {
    VIEWER,
    OPERATOR,
    ADMIN
}
