package com.cloudmicroops.controller;

import com.cloudmicroops.dto.IncidentReportDTO;
import com.cloudmicroops.service.ReportService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;

@RestController
@RequestMapping("/api/reports")
public class ReportController {

    private final ReportService reportService;

    public ReportController(ReportService reportService) {
        this.reportService = reportService;
    }

    @GetMapping("/incident")
    public ResponseEntity<IncidentReportDTO> getIncidentReport(
            @RequestParam(name = "windowMinutes", required = false, defaultValue = "15") long windowMinutes) {
        return reportService.generateIncidentReport(Duration.ofMinutes(windowMinutes))
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.noContent().build());
    }
}
