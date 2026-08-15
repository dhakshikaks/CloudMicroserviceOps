package com.cloudmicroops.security;

import com.cloudmicroops.model.Role;
import io.jsonwebtoken.Claims;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class JwtServiceTest {

    private static final String SECRET = "unit-test-secret-key-needs-32-bytes-minimum";

    private final JwtService jwtService = new JwtService(SECRET, 60_000);

    @Test
    void generatesTokenThatRoundTripsUsernameAndRole() {
        String token = jwtService.generateToken("alice", Role.OPERATOR);

        Optional<Claims> claims = jwtService.parse(token);

        assertTrue(claims.isPresent());
        assertEquals("alice", jwtService.extractUsername(claims.get()));
        assertEquals(Role.OPERATOR, jwtService.extractRole(claims.get()));
    }

    @Test
    void rejectsTamperedToken() {
        String token = jwtService.generateToken("bob", Role.VIEWER);
        String tampered = token.substring(0, token.length() - 2) + "xx";

        assertTrue(jwtService.parse(tampered).isEmpty());
    }

    @Test
    void rejectsExpiredToken() throws InterruptedException {
        JwtService shortLived = new JwtService(SECRET, 1);
        String token = shortLived.generateToken("carol", Role.ADMIN);

        Thread.sleep(10);

        assertTrue(shortLived.parse(token).isEmpty());
    }

    @Test
    void rejectsGarbageInput() {
        assertTrue(jwtService.parse("not-a-jwt").isEmpty());
    }
}
