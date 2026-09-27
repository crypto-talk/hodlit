package com.cryptalk.exchange;

import com.cryptalk.common.ApiException;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import java.util.Base64;
import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

@Component
public class ExchangeCredentialCipher {
    private static final SecureRandom RANDOM = new SecureRandom();
    private final byte[] key;

    public ExchangeCredentialCipher(@Value("${cryptalk.exchange.encryption-key:}") String encodedKey) {
        if (encodedKey == null || encodedKey.isBlank()) {
            this.key = null;
            return;
        }
        try {
            this.key = Base64.getDecoder().decode(encodedKey);
        } catch (IllegalArgumentException exception) {
            throw new IllegalStateException("EXCHANGE_CREDENTIAL_ENCRYPTION_KEY must be base64-encoded", exception);
        }
        if (key.length != 32) throw new IllegalStateException("EXCHANGE_CREDENTIAL_ENCRYPTION_KEY must decode to 32 bytes");
    }

    public void requireConfigured() {
        if (key == null) throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "거래소 연결 기능이 설정되지 않았습니다.");
    }

    public String encrypt(String plaintext) {
        requireConfigured();
        byte[] nonce = new byte[12];
        RANDOM.nextBytes(nonce);
        try {
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(key, "AES"), new GCMParameterSpec(128, nonce));
            byte[] encrypted = cipher.doFinal(plaintext.getBytes(StandardCharsets.UTF_8));
            byte[] combined = new byte[nonce.length + encrypted.length];
            System.arraycopy(nonce, 0, combined, 0, nonce.length);
            System.arraycopy(encrypted, 0, combined, nonce.length, encrypted.length);
            return Base64.getEncoder().encodeToString(combined);
        } catch (GeneralSecurityException exception) {
            throw new IllegalStateException("Exchange credential encryption failed", exception);
        }
    }

    public String decrypt(String encoded) {
        requireConfigured();
        try {
            byte[] combined = Base64.getDecoder().decode(encoded);
            if (combined.length < 29) throw new IllegalArgumentException("invalid ciphertext");
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, new SecretKeySpec(key, "AES"), new GCMParameterSpec(128, combined, 0, 12));
            return new String(cipher.doFinal(combined, 12, combined.length - 12), StandardCharsets.UTF_8);
        } catch (GeneralSecurityException | IllegalArgumentException exception) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "저장된 거래소 연결 정보를 읽지 못했습니다.");
        }
    }
}
