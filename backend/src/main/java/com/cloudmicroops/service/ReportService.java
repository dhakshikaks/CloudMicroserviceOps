package com.cloudmicroops.service;

import com.cloudmicroops.dto.IncidentReportDTO;

import java.time.Duration;
import java.util.Optional;

public interface ReportService {

    /** Empty when RCA has no active root-cause candidate in the given window. */
    Optional<IncidentReportDTO> generateIncidentReport(Duration window);
}
