package com.cloudmicroops.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Allows the browser-based dashboard (served from a different origin, no
 * gateway in front of the backend) to call the read-only {@code /api/**}
 * endpoints.
 */
@Configuration
public class CorsConfig implements WebMvcConfigurer {

    @Value("${frontend.url:http://localhost:3000}")
    private String frontendUrl;

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
                .allowedOrigins(frontendUrl)
                .allowedMethods("GET", "POST")
                .allowedHeaders("Authorization", "Content-Type");
    }
}
