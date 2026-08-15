package com.cloudops.user.service;

import com.cloudops.user.client.OrderClient;
import com.cloudops.user.dto.CreateUserRequest;
import com.cloudops.user.dto.OrderResponse;
import com.cloudops.user.dto.PlaceOrderRequest;
import com.cloudops.user.model.User;
import com.cloudops.user.repository.UserRepository;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.NoSuchElementException;

@Service
public class UserService {

    private final UserRepository repository;
    private final OrderClient orderClient;

    public UserService(UserRepository repository, OrderClient orderClient) {
        this.repository = repository;
        this.orderClient = orderClient;
    }

    public User create(CreateUserRequest request) {
        User user = new User(request.name(), request.email(), Instant.now());
        return repository.save(user);
    }

    public User get(Long id) {
        return repository.findById(id)
                .orElseThrow(() -> new NoSuchElementException("User not found: " + id));
    }

    public OrderResponse placeOrder(Long userId, PlaceOrderRequest request) {
        get(userId);
        return orderClient.placeOrder(userId, request.itemId(), request.quantity());
    }
}
