package com.cloudops.user.testing;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Optional;

/**
 * Validates JWTs issued by the backend's /api/auth endpoints. This service
 * never issues tokens itself, only checks them.
 */
@Component
public class JwtValidator {

    private final SecretKey key;

    public JwtValidator(@Value("${jwt.secret}") String secret) {
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
    }

    /** @return the token's role claim, or empty if missing/invalid/expired/tampered. */
    public Optional<String> extractRole(String token) {
        try {
            Claims claims = Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload();
            return Optional.ofNullable(claims.get("role", String.class));
        } catch (JwtException | IllegalArgumentException e) {
            return Optional.empty();
        }
    }
}
