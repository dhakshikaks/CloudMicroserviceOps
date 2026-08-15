package com.cloudmicroops.graph;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class ConfidenceCalculatorTest {

    private final ConfidenceCalculator calculator = new ConfidenceCalculator();

    @Test
    void scoresRatioOfSuccessfulToTotalCalls() {
        assertEquals(0.75, calculator.score(4, 3), 0.0001);
    }

    @Test
    void scoresFullConfidenceWhenAllCallsSucceed() {
        assertEquals(1.0, calculator.score(5, 5), 0.0001);
    }

    @Test
    void scoresZeroWhenNoCallsSucceed() {
        assertEquals(0.0, calculator.score(5, 0), 0.0001);
    }

    @Test
    void scoresZeroWhenNoCallsObserved() {
        assertEquals(0.0, calculator.score(0, 0), 0.0001);
    }
}
