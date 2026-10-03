package com.cryptalk.exchange;

import com.cryptalk.common.ApiException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;

@Component
public class ExchangeBalanceClient {
    private static final Logger log = LoggerFactory.getLogger(ExchangeBalanceClient.class);
    private static final java.util.Set<String> SAFE_ERROR_CODES = java.util.Set.of(
        "jwt_verification", "invalid_access_key", "expired_access_key", "out_of_scope",
        "ip_address_not_allowed", "invalid_query_payload", "too_many_requests", "server_error"
    );

    private final RestClient upbit;
    private final RestClient bithumb;
    private final RestClient coinone;
    private final ObjectMapper json;

    public ExchangeBalanceClient(
        @Value("${cryptalk.exchange.upbit-base-url:https://api.upbit.com}") String upbitUrl,
        @Value("${cryptalk.exchange.bithumb-base-url:https://api.bithumb.com}") String bithumbUrl,
        @Value("${cryptalk.exchange.coinone-base-url:https://api.coinone.co.kr}") String coinoneUrl,
        ObjectMapper json
    ) {
        this.upbit = client(upbitUrl);
        this.bithumb = client(bithumbUrl);
        this.coinone = client(coinoneUrl);
        this.json = json;
    }

    private RestClient client(String baseUrl) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(3));
        factory.setReadTimeout(Duration.ofSeconds(5));
        return RestClient.builder().baseUrl(baseUrl).requestFactory(factory).build();
    }

    public List<Balance> balances(Exchange exchange, String accessKey, String secretKey) {
        try {
            return switch (exchange) {
                case UPBIT -> parseAccounts(upbit.get().uri("/v1/accounts")
                    .header("Authorization", "Bearer " + jwt(accessKey, secretKey, "HmacSHA512", false))
                    .retrieve().body(JsonNode.class));
                case BITHUMB -> parseAccounts(bithumb.get().uri("/v1/accounts")
                    .header("Authorization", "Bearer " + jwt(accessKey, secretKey, "HmacSHA256", true))
                    .retrieve().body(JsonNode.class));
                case COINONE -> coinoneBalances(accessKey, secretKey);
            };
        } catch (RestClientResponseException exception) {
            log.warn("Exchange balance request failed: exchange={}, status={}, errorCode={}",
                exchange, exception.getStatusCode().value(), safeErrorCode(exception));
            if (exception.getStatusCode().value() == 401 || exception.getStatusCode().value() == 403)
                throw new ApiException(HttpStatus.BAD_REQUEST, "거래소 API 키, 자산조회 권한 또는 허용 IP를 확인해 주세요.");
            throw new ApiException(HttpStatus.BAD_GATEWAY, "거래소 잔고 조회에 실패했습니다.");
        } catch (RestClientException exception) {
            // Exception messages and causes may contain credentials or upstream response bodies.
            log.warn("Exchange balance request failed: exchange={}, status=unavailable, errorCode=transport_error",
                exchange);
            throw new ApiException(HttpStatus.BAD_GATEWAY, "거래소에 연결하지 못했습니다.");
        }
    }

    private String safeErrorCode(RestClientResponseException exception) {
        try {
            JsonNode root = json.readTree(exception.getResponseBodyAsByteArray());
            String code = root == null ? "" : root.path("error").path("name").asText("");
            return SAFE_ERROR_CODES.contains(code) ? code : "unknown";
        } catch (java.io.IOException exceptionIgnored) {
            return "unknown";
        }
    }

    private List<Balance> coinoneBalances(String accessKey, String secretKey) {
        try {
            String payload = json.writeValueAsString(Map.of("access_token", accessKey, "nonce", UUID.randomUUID().toString()));
            String encoded = Base64.getEncoder().encodeToString(payload.getBytes(StandardCharsets.UTF_8));
            String signature = hex(hmac("HmacSHA512", secretKey, encoded));
            JsonNode root = coinone.post().uri("/v2.1/account/balance/all")
                .header("Content-Type", "application/json")
                .header("X-COINONE-PAYLOAD", encoded)
                .header("X-COINONE-SIGNATURE", signature)
                .body(encoded).retrieve().body(JsonNode.class);
            if (root == null || !"success".equals(root.path("result").asText())) {
                log.warn("Exchange balance request failed: exchange=COINONE, status=200, errorCode=unknown");
                throw new ApiException(HttpStatus.BAD_REQUEST, "코인원 API 키, 잔고조회 권한 또는 허용 IP를 확인해 주세요.");
            }
            return parseCoinone(root.path("balances"));
        } catch (com.fasterxml.jackson.core.JsonProcessingException exception) {
            throw new IllegalStateException("Could not encode Coinone balance request", exception);
        }
    }

    private String jwt(String accessKey, String secretKey, String algorithm, boolean timestamp) {
        String header = Base64.getUrlEncoder().withoutPadding().encodeToString(
            ("{\"alg\":\"" + (timestamp ? "HS256" : "HS512") + "\",\"typ\":\"JWT\"}").getBytes(StandardCharsets.UTF_8));
        Map<String, Object> claims = new java.util.LinkedHashMap<>();
        claims.put("access_key", accessKey);
        claims.put("nonce", UUID.randomUUID().toString());
        if (timestamp) claims.put("timestamp", Instant.now().toEpochMilli());
        try {
            String body = Base64.getUrlEncoder().withoutPadding().encodeToString(json.writeValueAsBytes(claims));
            String signingInput = header + "." + body;
            String signature = Base64.getUrlEncoder().withoutPadding().encodeToString(hmac(algorithm, secretKey, signingInput));
            return signingInput + "." + signature;
        } catch (com.fasterxml.jackson.core.JsonProcessingException exception) {
            throw new IllegalStateException("Could not encode exchange JWT", exception);
        }
    }

    private byte[] hmac(String algorithm, String secret, String value) {
        try {
            Mac mac = Mac.getInstance(algorithm);
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), algorithm));
            return mac.doFinal(value.getBytes(StandardCharsets.UTF_8));
        } catch (java.security.GeneralSecurityException exception) {
            throw new IllegalStateException("Exchange request signing failed", exception);
        }
    }

    private String hex(byte[] bytes) { return java.util.HexFormat.of().formatHex(bytes); }

    private List<Balance> parseAccounts(JsonNode accounts) {
        if (accounts == null || !accounts.isArray())
            throw new ApiException(HttpStatus.BAD_GATEWAY, "거래소 잔고 응답 형식이 올바르지 않습니다.");
        List<Balance> balances = new ArrayList<>();
        for (JsonNode item : accounts) {
            String currency = item.path("currency").asText("");
            if (!currency.matches("[A-Za-z0-9]{2,20}"))
                throw new ApiException(HttpStatus.BAD_GATEWAY, "거래소 잔고 응답 형식이 올바르지 않습니다.");
            BigDecimal available = decimal(item.path("balance"));
            BigDecimal locked = decimal(item.path("locked"));
            balances.add(new Balance(currency.toUpperCase(java.util.Locale.ROOT), available, locked, available.add(locked)));
        }
        return balances;
    }

    private List<Balance> parseCoinone(JsonNode values) {
        if (!values.isArray()) throw new ApiException(HttpStatus.BAD_GATEWAY, "코인원 잔고 응답 형식이 올바르지 않습니다.");
        List<Balance> balances = new ArrayList<>();
        for (JsonNode item : values) {
            String currency = item.path("currency").asText("");
            if (!currency.matches("[A-Za-z0-9]{2,20}"))
                throw new ApiException(HttpStatus.BAD_GATEWAY, "코인원 잔고 응답 형식이 올바르지 않습니다.");
            BigDecimal available = decimal(item.path("available"));
            BigDecimal locked = decimal(item.path("limit"));
            balances.add(new Balance(currency.toUpperCase(java.util.Locale.ROOT), available, locked, available.add(locked)));
        }
        return balances;
    }

    private BigDecimal decimal(JsonNode value) {
        try {
            BigDecimal number = new BigDecimal(value.asText());
            if (number.signum() < 0) throw new NumberFormatException("negative balance");
            return number;
        } catch (NumberFormatException exception) {
            throw new ApiException(HttpStatus.BAD_GATEWAY, "거래소 잔고 응답 형식이 올바르지 않습니다.");
        }
    }

    public record Balance(String currency, BigDecimal available, BigDecimal locked, BigDecimal total) {}
}
