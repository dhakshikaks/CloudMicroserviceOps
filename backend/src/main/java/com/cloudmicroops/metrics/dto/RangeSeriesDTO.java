package com.cloudmicroops.metrics.dto;

import java.util.List;
import java.util.Map;

/** Mirrors the frontend's RangeSeries { metric, samples } exactly - no reshaping needed. */
public record RangeSeriesDTO(Map<String, String> metric, List<RangeSampleDTO> samples) {
}
