package com.cryptalk.exchange;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;

final class ExchangeCredentialFingerprint {
    private ExchangeCredentialFingerprint() {}
    static String of(Exchange exchange,String accessKey) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                .digest((exchange.name()+"\0"+accessKey).getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException impossible) {
            throw new IllegalStateException("SHA-256 unavailable",impossible);
        }
    }
}
