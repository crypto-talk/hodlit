package com.cryptalk.asset;

import java.math.BigDecimal;

/** Shared coarse quantity display for private assets and immutable publication snapshots. */
public final class HoldingQuantityBand {
    private HoldingQuantityBand() {}

    public static String of(String symbol, BigDecimal quantity) {
        if (quantity == null || quantity.signum() <= 0) return null;
        if (quantity.compareTo(new BigDecimal("0.1")) < 0) return "0~0.1 " + symbol;
        if (quantity.compareTo(BigDecimal.ONE) < 0) return "0.1~1 " + symbol;
        if (quantity.compareTo(BigDecimal.TEN) < 0) return "1~10 " + symbol;
        if (quantity.compareTo(new BigDecimal("100")) < 0) return "10~100 " + symbol;
        return "100+ " + symbol;
    }
}
