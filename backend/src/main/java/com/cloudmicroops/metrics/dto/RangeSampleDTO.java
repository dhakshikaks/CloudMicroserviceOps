package com.cloudmicroops.metrics.dto;

/** Mirrors the frontend's RangeSample { timestampSec, value } exactly - no reshaping needed. */
public record RangeSampleDTO(long timestampSec, double value) {
}
