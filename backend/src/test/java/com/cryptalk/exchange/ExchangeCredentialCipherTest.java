package com.cryptalk.exchange;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.cryptalk.common.ApiException;
import org.junit.jupiter.api.Test;

class ExchangeCredentialCipherTest {
    private static final String KEY = "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=";

    @Test
    void encryptsWithDistinctNoncesAndRejectsTampering() {
        ExchangeCredentialCipher cipher = new ExchangeCredentialCipher(KEY);
        String first = cipher.encrypt("very-secret-key");
        String second = cipher.encrypt("very-secret-key");
        assertNotEquals(first, second);
        assertEquals("very-secret-key", cipher.decrypt(first));
        byte[] changed = java.util.Base64.getDecoder().decode(first);
        changed[changed.length - 1] ^= 1;
        assertThrows(ApiException.class, () -> cipher.decrypt(java.util.Base64.getEncoder().encodeToString(changed)));
    }

    @Test
    void refusesConnectionsWithoutConfiguredKey() {
        assertThrows(ApiException.class, () -> new ExchangeCredentialCipher("").encrypt("secret"));
    }
}
