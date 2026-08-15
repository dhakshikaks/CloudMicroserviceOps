package com.cloudmicroops.controller;

import com.cloudmicroops.dto.AuthResponse;
import com.cloudmicroops.dto.LoginRequest;
import com.cloudmicroops.dto.RegisterRequest;
import com.cloudmicroops.model.AppUser;
import com.cloudmicroops.model.Role;
import com.cloudmicroops.repository.AppUserRepository;
import com.cloudmicroops.security.JwtService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AppUserRepository repository;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authenticationManager;
    private final JwtService jwtService;

    public AuthController(AppUserRepository repository, PasswordEncoder passwordEncoder,
                           AuthenticationManager authenticationManager, JwtService jwtService) {
        this.repository = repository;
        this.passwordEncoder = passwordEncoder;
        this.authenticationManager = authenticationManager;
        this.jwtService = jwtService;
    }

    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@Valid @RequestBody RegisterRequest request) {
        if (repository.existsByUsername(request.username())) {
            return ResponseEntity.status(HttpStatus.CONFLICT).build();
        }
        Role role = request.role() != null ? request.role() : Role.VIEWER;
        AppUser user = new AppUser(request.username(), passwordEncoder.encode(request.password()), role, Instant.now());
        repository.save(user);

        String token = jwtService.generateToken(user.getUsername(), user.getRole());
        return ResponseEntity.status(HttpStatus.CREATED).body(new AuthResponse(token, user.getUsername(), user.getRole()));
    }

    @PostMapping("/login")
    public AuthResponse login(@Valid @RequestBody LoginRequest request) {
        authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.username(), request.password()));

        AppUser user = repository.findByUsername(request.username())
                .orElseThrow(() -> new BadCredentialsException("Invalid credentials"));
        String token = jwtService.generateToken(user.getUsername(), user.getRole());
        return new AuthResponse(token, user.getUsername(), user.getRole());
    }

    @ExceptionHandler(AuthenticationException.class)
    public ResponseEntity<String> handleAuthFailure() {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Invalid username or password");
    }
}
