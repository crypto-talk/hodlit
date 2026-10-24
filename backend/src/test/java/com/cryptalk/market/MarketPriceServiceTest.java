package com.cryptalk.market;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.cryptalk.coin.Coin;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.math.BigDecimal;
import java.net.InetSocketAddress;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class MarketPriceServiceTest {
    private HttpServer server;
    private final AtomicReference<String> query = new AtomicReference<>();

    @BeforeEach
    void startServer() throws IOException {
        server = HttpServer.create(new InetSocketAddress(0), 0);
        server.createContext("/simple/price", exchange -> {
            query.set(URLDecoder.decode(exchange.getRequestURI().getRawQuery(), StandardCharsets.UTF_8));
            byte[] response = "{\"ethereum\":{\"krw\":4321000.50,\"krw_24h_change\":2.75,\"last_updated_at\":1788220800},"
                .concat("\"bitcoin\":{\"krw\":158200000,\"krw_24h_change\":-1.25,\"last_updated_at\":1788220801}}")
                .getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, response.length);
            exchange.getResponseBody().write(response);
            exchange.close();
        });
        server.start();
    }

    @AfterEach
    void stopServer() { server.stop(0); }

    @Test
    void fetchesProviderPriceAndTimestamp() {
        Coin coin = mock(Coin.class);
        when(coin.getMarketPriceId()).thenReturn("ethereum");
        when(coin.getSymbol()).thenReturn("ETH");
        MarketPriceService prices = new MarketPriceService("http://localhost:" + server.getAddress().getPort());

        MarketPriceService.PriceQuote quote = prices.currentPrice(coin, "krw");

        assertEquals("ETH", quote.symbol());
        assertEquals(0, new BigDecimal("4321000.50").compareTo(quote.price()));
        assertEquals("KRW", quote.currency());
        assertEquals(0, new BigDecimal("2.75").compareTo(quote.change24h()));
        assertEquals(Instant.ofEpochSecond(1788220800), quote.capturedAt());
        assertEquals("COINGECKO", quote.source());
    }

    @Test
    void fetchesSeveralPricesInOneProviderRequest() {
        Coin ethereum = coin("ethereum", "ETH");
        Coin bitcoin = coin("bitcoin", "BTC");
        MarketPriceService prices = new MarketPriceService("http://localhost:" + server.getAddress().getPort());

        List<MarketPriceService.PriceQuote> quotes = prices.currentPrices(List.of(bitcoin, ethereum), "KRW");

        assertEquals(List.of("BTC", "ETH"), quotes.stream().map(MarketPriceService.PriceQuote::symbol).toList());
        assertEquals(0, new BigDecimal("-1.25").compareTo(quotes.get(0).change24h()));
        assertEquals(0, new BigDecimal("4321000.50").compareTo(quotes.get(1).price()));
        org.junit.jupiter.api.Assertions.assertTrue(query.get().contains("ids=bitcoin,ethereum"));
        org.junit.jupiter.api.Assertions.assertTrue(query.get().contains("include_24hr_change=true"));
    }

    private Coin coin(String marketId, String symbol) {
        Coin coin = mock(Coin.class);
        when(coin.getMarketPriceId()).thenReturn(marketId);
        when(coin.getSymbol()).thenReturn(symbol);
        return coin;
    }
}
