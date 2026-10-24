package com.cryptalk.market;

import com.cryptalk.coin.Coin;
import com.cryptalk.common.ApiException;
import com.fasterxml.jackson.databind.JsonNode;
import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

@Service
public class MarketPriceService {
    private static final Duration CACHE_TTL = Duration.ofSeconds(20);
    private final RestClient client;
    private final ConcurrentMap<String, CachedQuote> cache = new ConcurrentHashMap<>();

    public MarketPriceService(@Value("${cryptalk.market-price.base-url}") String baseUrl) {
        SimpleClientHttpRequestFactory requests = new SimpleClientHttpRequestFactory();
        requests.setConnectTimeout(Duration.ofSeconds(3));
        requests.setReadTimeout(Duration.ofSeconds(5));
        this.client = RestClient.builder().baseUrl(baseUrl).requestFactory(requests).build();
    }

    public PriceQuote currentPrice(Coin coin, String requestedCurrency) {
        return currentPrices(List.of(coin), requestedCurrency).get(0);
    }

    public List<PriceQuote> currentPrices(List<Coin> coins, String requestedCurrency) {
        String currency = normalizeCurrency(requestedCurrency);
        Instant now = Instant.now();
        Map<String, PriceQuote> quotes = new LinkedHashMap<>();
        List<Coin> missing = new ArrayList<>();

        for (Coin coin : coins) {
            String marketId = requireMarketId(coin);
            CachedQuote cached = cache.get(cacheKey(marketId, currency));
            if (cached != null && cached.expiresAt().isAfter(now)) quotes.put(marketId, cached.quote());
            else missing.add(coin);
        }

        if (!missing.isEmpty()) {
            fetchPrices(missing, currency, now).forEach(quote -> quotes.put(quote.marketId(), quote.quote()));
        }
        return coins.stream().map(coin -> quotes.get(requireMarketId(coin))).toList();
    }

    private List<FetchedQuote> fetchPrices(List<Coin> coins, String currency, Instant now) {
        try {
            String ids = coins.stream().map(this::requireMarketId).distinct().collect(java.util.stream.Collectors.joining(","));
            JsonNode body = client.get().uri(uri -> uri.path("/simple/price")
                    .queryParam("ids", ids)
                    .queryParam("vs_currencies", currency.toLowerCase(Locale.ROOT))
                    .queryParam("include_24hr_change", true)
                    .queryParam("include_last_updated_at", true)
                    .build())
                .retrieve().body(JsonNode.class);
            List<FetchedQuote> fetched = new ArrayList<>();
            for (Coin coin : coins) {
                String marketId = requireMarketId(coin);
                JsonNode result = body == null ? null : body.get(marketId);
                JsonNode priceNode = result == null ? null : result.get(currency.toLowerCase(Locale.ROOT));
                if (priceNode == null || !priceNode.isNumber()) throw new RestClientException("price missing");
                JsonNode changeNode = result.get(currency.toLowerCase(Locale.ROOT) + "_24h_change");
                JsonNode updatedNode = result.get("last_updated_at");
                Instant capturedAt = updatedNode != null && updatedNode.canConvertToLong()
                    ? Instant.ofEpochSecond(updatedNode.asLong()) : now;
                BigDecimal change24h = changeNode != null && changeNode.isNumber() ? changeNode.decimalValue() : null;
                PriceQuote quote = new PriceQuote(coin.getSymbol(), priceNode.decimalValue(), currency,
                    change24h, capturedAt, "COINGECKO");
                cache.put(cacheKey(marketId, currency), new CachedQuote(quote, now.plus(CACHE_TTL)));
                fetched.add(new FetchedQuote(marketId, quote));
            }
            return fetched;
        } catch (RestClientException exception) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "실시간 자산 가격을 조회하지 못했습니다. 잠시 후 다시 시도해 주세요.");
        }
    }

    private String requireMarketId(Coin coin) {
        String marketId = coin.getMarketPriceId();
        if (marketId == null || marketId.isBlank())
            throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "이 자산은 실시간 시세 조회를 지원하지 않습니다.");
        return marketId;
    }

    private String cacheKey(String marketId, String currency) { return marketId + ":" + currency; }

    private String normalizeCurrency(String value) {
        String currency = value == null || value.isBlank() ? "USD" : value.trim().toUpperCase(Locale.ROOT);
        if (!currency.matches("^[A-Z0-9]{2,10}$"))
            throw new ApiException(HttpStatus.BAD_REQUEST, "가격 통화 형식을 확인해 주세요.");
        return currency;
    }

    public record PriceQuote(String symbol, BigDecimal price, String currency, BigDecimal change24h,
                             Instant capturedAt, String source) {}
    private record FetchedQuote(String marketId, PriceQuote quote) {}
    private record CachedQuote(PriceQuote quote, Instant expiresAt) {}
}
