package com.cloudmicroops.metrics;

/**
 * Window length and range-query step, kept numerically identical to the
 * frontend's former TIME_WINDOW_SECONDS/RANGE_STEP_SECONDS tables so chart
 * resolution is unchanged by this migration.
 */
public enum TimeWindow {
    FIVE_MINUTES("5m", 5 * 60, 15),
    FIFTEEN_MINUTES("15m", 15 * 60, 15),
    ONE_HOUR("1h", 60 * 60, 30),
    SIX_HOURS("6h", 6 * 60 * 60, 120),
    TWENTY_FOUR_HOURS("24h", 24 * 60 * 60, 300);

    private final String wireValue;
    private final long durationSeconds;
    private final long stepSeconds;

    TimeWindow(String wireValue, long durationSeconds, long stepSeconds) {
        this.wireValue = wireValue;
        this.durationSeconds = durationSeconds;
        this.stepSeconds = stepSeconds;
    }

    public long durationSeconds() {
        return durationSeconds;
    }

    public long stepSeconds() {
        return stepSeconds;
    }

    public static TimeWindow fromWireValue(String value) {
        for (TimeWindow window : values()) {
            if (window.wireValue.equals(value)) {
                return window;
            }
        }
        throw new IllegalArgumentException("Unknown time window: " + value);
    }
}
