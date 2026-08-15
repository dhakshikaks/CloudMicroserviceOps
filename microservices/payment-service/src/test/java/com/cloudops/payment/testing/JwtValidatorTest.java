package com.cloudops.payment.testing;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.Test;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class JwtValidatorTest {

    private static final String SECRET = "unit-test-secret-key-needs-32-bytes-minimum";

    private final JwtValidator validator = new JwtValidator(SECRET);

    @Test
    void extractsRoleFromValidToken() {
        String token = tokenFor("OPERATOR", 60_000);

        assertEquals(Optional.of("OPERATOR"), validator.extractRole(token));
    }

    @Test
    void rejectsExpiredToken() throws InterruptedException {
        String token = tokenFor("ADMIN", 1);
        Thread.sleep(10);

        assertTrue(validator.extractRole(token).isEmpty());
    }

    @Test
    void rejectsGarbageToken() {
        assertTrue(validator.extractRole("not-a-jwt").isEmpty());
    }

    private String tokenFor(String role, long expirationMs) {
        SecretKey key = Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8));
        Date now = new Date();
        return Jwts.builder()
                .subject("tester")
                .claim("role", role)
                .issuedAt(now)
                .expiration(new Date(now.getTime() + expirationMs))
                .signWith(key)
                .compact();
    }
}
