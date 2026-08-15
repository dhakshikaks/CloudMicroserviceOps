package com.cloudmicroops.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/root-cause")
public class RootCauseController {

    @GetMapping("/status")
    public Map<String, String> status() {
        return Map.of(
                "module", "root-cause-analysis",
                "status", "scaffold",
                "rankingAlgorithm", "not yet implemented"
        );
    }
}
