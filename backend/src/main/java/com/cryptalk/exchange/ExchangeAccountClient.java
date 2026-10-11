package com.cryptalk.exchange;

import com.cryptalk.common.ApiException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Base64;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;

/** Read-only provider identity calls. Never accepts an account identifier from the caller. */
@Component
public class ExchangeAccountClient {
    private static final Logger log = LoggerFactory.getLogger(ExchangeAccountClient.class);
    private final RestClient upbit;
    private final RestClient bithumb;
    private final ObjectMapper json;
    private final AtomicLong lastNonce = new AtomicLong();

    public ExchangeAccountClient(
        @Value("${cryptalk.exchange.upbit-base-url:https://api.upbit.com}") String upbitUrl,
        @Value("${cryptalk.exchange.bithumb-base-url:https://api.bithumb.com}") String bithumbUrl,
        ObjectMapper json
    ) {
        this.upbit = client(upbitUrl);
        this.bithumb = client(bithumbUrl);
        this.json = json;
    }

    private RestClient client(String url) {
        var factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(3));
        factory.setReadTimeout(Duration.ofSeconds(5));
        return RestClient.builder().baseUrl(url).requestFactory(factory).build();
    }

    public String accountId(Exchange exchange, String accessKey, String secretKey) {
        try {
            return switch (exchange) {
                case UPBIT -> upbitAccountId(accessKey, secretKey);
                case BITHUMB -> {
                    var data = bithumbRequest("/info/account", "order_currency=BTC&payment_currency=KRW", accessKey, secretKey);
                    var id = data.path("account_id");
                    if (!id.isTextual() || !id.asText().matches("[A-Za-z0-9_-]{1,128}")) throw malformed();
                    yield id.asText();
                }
                // TODO(HODL-50): Coinone's deprecated user_info API has no stable account ID.
                // Implement provider-verified account uniqueness once a supported identity API exists.
                // Do not substitute email, phone, bank account, balance, or an API key for account identity.
                case COINONE -> null;
            };
        } catch (RestClientException exception) {
            throw providerFailure(exchange, exception);
        }
    }

    private String upbitAccountId(String accessKey, String secretKey) {
        JsonNode pockets = upbit.get().uri("/v1/pockets")
            .header("Authorization", "Bearer " + upbitJwt(accessKey, secretKey)).retrieve().body(JsonNode.class);
        if (pockets == null || !pockets.isArray()) throw malformed();
        String mainId = null;
        for (var pocket : pockets) {
            if (!"main".equals(pocket.path("type").asText())) continue;
            if (mainId != null || !pocket.path("uuid").isTextual()) throw malformed();
            String id = pocket.path("uuid").asText();
            try {
                mainId = UUID.fromString(id).toString();
                if (!mainId.equalsIgnoreCase(id)) throw malformed();
            } catch (IllegalArgumentException exception) {
                throw malformed();
            }
        }
        if (mainId == null) throw malformed();
        return mainId;
    }

    /** Bithumb account_id and balances must be read with the same API 1.0 credential. */
    public List<ExchangeBalanceClient.Balance> bithumbBalances(String accessKey, String secretKey) {
        try {
            var data = bithumbRequest("/info/balance", "currency=ALL", accessKey, secretKey);
            List<ExchangeBalanceClient.Balance> result = new ArrayList<>();
            var fields = data.fieldNames();
            while (fields.hasNext()) {
                String field = fields.next();
                if (!field.startsWith("total_")) continue;
                String currency = field.substring("total_".length());
                if (!currency.matches("[a-zA-Z0-9]{1,20}")) throw malformed();
                BigDecimal total = decimal(data.path(field));
                BigDecimal available = decimal(data.path("available_" + currency));
                BigDecimal locked = decimal(data.path("in_use_" + currency));
                if (available.add(locked).compareTo(total) != 0) throw malformed();
                result.add(new ExchangeBalanceClient.Balance(currency.toUpperCase(Locale.ROOT), available, locked, total));
            }
            if (result.isEmpty()) throw malformed();
            return result;
        } catch (RestClientException exception) {
            throw providerFailure(Exchange.BITHUMB, exception);
        }
    }

    private JsonNode bithumbRequest(String path, String parameters, String accessKey, String secretKey) {
        String body = "endpoint=" + URLEncoder.encode(path, StandardCharsets.UTF_8) + "&" + parameters;
        String nonce = Long.toString(lastNonce.updateAndGet(previous -> Math.max(System.currentTimeMillis(), previous + 1)));
        // API 1.0 signs the hex-encoded SHA512 MAC, then Base64-encodes the hex text.
        String mac = HexFormat.of().formatHex(hmac(secretKey, path + ";" + body + ";" + nonce));
        String signature = Base64.getEncoder().encodeToString(mac.getBytes(StandardCharsets.UTF_8));
        JsonNode root = bithumb.post().uri(path).contentType(MediaType.APPLICATION_FORM_URLENCODED)
            .header("api-client-type", "2").header("Api-Key", accessKey)
            .header("Api-Nonce", nonce).header("Api-Sign", signature)
            .body(body).retrieve().body(JsonNode.class);
        if (root == null || !"0000".equals(root.path("status").asText())) {
            throw new ApiException(HttpStatus.BAD_REQUEST,
                "빗썸 API 1.0 키와 회원정보·잔고조회 권한 및 허용 IP를 확인해 주세요.");
        }
        if (!root.path("data").isObject()) throw malformed();
        return root.path("data");
    }

    private String upbitJwt(String accessKey, String secretKey) {
        try {
            String header = Base64.getUrlEncoder().withoutPadding().encodeToString(
                "{\"alg\":\"HS512\",\"typ\":\"JWT\"}".getBytes(StandardCharsets.UTF_8));
            Map<String, String> claims = new LinkedHashMap<>();
            claims.put("access_key", accessKey);
            claims.put("nonce", UUID.randomUUID().toString());
            String payload = Base64.getUrlEncoder().withoutPadding().encodeToString(json.writeValueAsBytes(claims));
            String signed = header + "." + payload;
            return signed + "." + Base64.getUrlEncoder().withoutPadding().encodeToString(hmac(secretKey, signed));
        } catch (java.io.IOException exception) {
            throw new IllegalStateException("Could not sign exchange identity request");
        }
    }

    private byte[] hmac(String secret, String value) {
        try {
            Mac mac = Mac.getInstance("HmacSHA512");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA512"));
            return mac.doFinal(value.getBytes(StandardCharsets.UTF_8));
        } catch (java.security.GeneralSecurityException exception) {
            throw new IllegalStateException("Could not sign exchange identity request");
        }
    }

    private BigDecimal decimal(JsonNode value) {
        try {
            BigDecimal number = new BigDecimal(value.asText());
            if (number.signum() < 0) throw malformed();
            return number;
        } catch (NumberFormatException exception) {
            throw malformed();
        }
    }

    private ApiException malformed() {
        return new ApiException(HttpStatus.BAD_GATEWAY, "거래소 계정 확인 응답 형식이 올바르지 않습니다.");
    }

    private ApiException providerFailure(Exchange exchange, RestClientException exception) {
        int status = exception instanceof RestClientResponseException response ? response.getStatusCode().value() : 0;
        // Only the provider and numeric HTTP status are safe: never log IDs, credentials, bodies or exception text.
        log.warn("Exchange account request failed: exchange={}, status={}", exchange, status);
        if (status == 401 || status == 403) {
            return new ApiException(HttpStatus.BAD_REQUEST, exchange == Exchange.UPBIT
                ? "업비트 메인포켓 키의 자산조회·포켓관리 권한과 허용 IP를 확인해 주세요."
                : "빗썸 API 1.0 키와 회원정보·잔고조회 권한 및 허용 IP를 확인해 주세요.");
        }
        return new ApiException(HttpStatus.BAD_GATEWAY, "거래소 계정을 확인하지 못했습니다.");
    }
}
