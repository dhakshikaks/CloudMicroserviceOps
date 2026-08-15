package com.cloudmicroops.controller;

import com.cloudmicroops.model.RootCauseCandidate;
import com.cloudmicroops.rca.RootCauseScorer;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;
import java.util.List;

@RestController
@RequestMapping("/api/incidents")
public class IncidentController {

    private final RootCauseScorer rootCauseScorer;

    public IncidentController(RootCauseScorer rootCauseScorer) {
        this.rootCauseScorer = rootCauseScorer;
    }

    @GetMapping("/root-causes")
    public List<RootCauseCandidate> getRootCauses(
            @RequestParam(name = "windowMinutes", required = false, defaultValue = "5") long windowMinutes) {
        return rootCauseScorer.rankRootCauses(Duration.ofMinutes(windowMinutes));
    }
}
