package com.cloudops.user.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestClient;

@Configuration
public class RestClientConfig {

    @Bean
    public RestClient orderServiceClient(@Value("${order-service.url}") String baseUrl) {
        return RestClient.builder().baseUrl(baseUrl).build();
    }
}
