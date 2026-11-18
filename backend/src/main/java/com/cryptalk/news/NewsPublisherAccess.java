package com.cryptalk.news;

import com.cryptalk.common.ApiException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

@Component
public class NewsPublisherAccess {
    private final byte[] passwordHash;

    public NewsPublisherAccess(@Value("${cryptalk.news-publisher.token:}") String password) {
        if (!password.isEmpty() && password.getBytes(StandardCharsets.UTF_8).length < 32) {
            throw new IllegalArgumentException("NEWS_PUBLISHER_TOKEN must be at least 32 bytes or empty");
        }
        passwordHash = password.isEmpty() ? null : hash(password);
    }

    public void requirePassword(String supplied) {
        if (passwordHash == null || supplied == null
                || !MessageDigest.isEqual(passwordHash, hash(supplied))) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "뉴스 등록 인증에 실패했습니다.");
        }
    }

    private static byte[] hash(String password) {
        try {
            return MessageDigest.getInstance("SHA-256").digest(password.getBytes(StandardCharsets.UTF_8));
        } catch (NoSuchAlgorithmException error) {
            throw new IllegalStateException("SHA-256 is unavailable", error);
        }
    }
}
