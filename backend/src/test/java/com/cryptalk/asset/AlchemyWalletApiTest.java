package com.cryptalk.asset;

import static org.hamcrest.Matchers.containsString;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.cryptalk.coin.Coin;
import com.cryptalk.exchange.ExchangeConnectionService;
import com.cryptalk.market.MarketPriceService;
import com.cryptalk.member.Member;
import com.cryptalk.member.MemberRepository;
import com.cryptalk.wallet.Wallet;
import com.cryptalk.wallet.WalletRepository;
import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
class AlchemyWalletApiTest {
    private static final String CONTRACT = "0x3333333333333333333333333333333333333333";
    @Autowired MockMvc mvc;
    @Autowired MemberRepository members;
    @Autowired WalletRepository wallets;
    @Autowired JdbcTemplate jdbc;
    @MockitoBean AlchemyPortfolioClient alchemy;
    @MockitoBean ExchangeConnectionService exchanges;
    @MockitoBean MarketPriceService prices;
    Member owner;
    String address;

    @BeforeEach void setup() {
        jdbc.update("UPDATE coins SET operation_status='OPEN' WHERE symbol IN ('POL','LINK')");
        owner = members.saveAndFlush(new Member(UUID.randomUUID().toString(), "#123456"));
        address = "0x" + UUID.randomUUID().toString().replace("-", "") + "12345678";
        wallets.saveAndFlush(new Wallet(owner, address));
        when(alchemy.isConfigured()).thenReturn(true);
        when(alchemy.fetch(anyList(), any(Duration.class))).thenReturn(result(List.of(token(1, null, "ETH", "1000000000000000000"),
            token(137, null, "POL", "5000000000000000000"), token(1, CONTRACT, "UNLISTED", "2000000000000000000")), List.of()));
        when(prices.currentPrice(any(Coin.class), nullable(String.class))).thenAnswer(call ->
            new MarketPriceService.PriceQuote(((Coin) call.getArgument(0)).getSymbol(), BigDecimal.TEN,
                "KRW", BigDecimal.ZERO, Instant.now(), "TEST"));
    }
    @AfterEach void restoreRegistry() {
        jdbc.update("UPDATE coins SET operation_status='CLOSE' WHERE symbol IN ('POL','LINK')");
        jdbc.update("UPDATE coins SET chain_id=NULL, contract_address=NULL, token_decimals=NULL, verification_availability='NOT_CONFIGURED' WHERE symbol='LINK'");
    }

    @Test void walletOnlyEndpointReturnsUnlistedTokensWithoutFetchingExchanges() throws Exception {
        mvc.perform(get("/api/v1/me/wallets/assets?memberId=9999").with(jwt().jwt(token -> token.subject(owner.getId().toString()))))
            .andExpect(status().isOk())
            .andExpect(header().string("Cache-Control", containsString("no-store")))
            .andExpect(jsonPath("$.assets[2].symbol").value("UNLISTED"))
            .andExpect(jsonPath("$.assets[2].contractAddress").value(CONTRACT))
            .andExpect(jsonPath("$.assets[2].quantity").value(2))
            .andExpect(jsonPath("$.syncStatus").value("READY"));
        verify(alchemy).fetch(eq(List.of(address)), any(Duration.class));
        verifyNoInteractions(exchanges);
    }

    @Test void combinedEndpointUsesTheSameBatchAndIncludesPrivateWalletPortfolio() throws Exception {
        mvc.perform(get("/api/v1/me/assets").with(jwt().jwt(token -> token.subject(owner.getId().toString()))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.assets[?(@.symbol == 'POL')].verificationLevel").value("WALLET"))
            .andExpect(jsonPath("$.assets[?(@.symbol == 'ETH')].holderStatus").value("HOLDER"))
            .andExpect(jsonPath("$.walletAssets.assets[2].symbol").value("UNLISTED"));
        verify(alchemy, times(1)).fetch(eq(List.of(address)), any(Duration.class));
    }

    @Test void partialNetworkFailureCannotCertifyAnEmptyPolygonWallet() throws Exception {
        when(alchemy.fetch(anyList(), any(Duration.class))).thenReturn(result(
            List.of(token(1, null, "ETH", "1000000000000000000")), List.of("matic-mainnet")));
        mvc.perform(get("/api/v1/me/assets").with(jwt().jwt(token -> token.subject(owner.getId().toString()))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.assets[?(@.symbol == 'ETH')].holderStatus").value("HOLDER"))
            .andExpect(jsonPath("$.unresolvedAssets[?(@.symbol == 'POL')].holderStatus").value("UNKNOWN"))
            .andExpect(jsonPath("$.unresolvedAssets[?(@.symbol == 'POL')].syncStatus").value("PARTIAL"));
    }

    @Test void certificationMatchesChainAndContractRatherThanProviderSymbol() throws Exception {
        jdbc.update("UPDATE coins SET chain_id=1, contract_address=?, token_decimals=18 WHERE symbol='LINK'", CONTRACT);
        when(alchemy.fetch(anyList(), any(Duration.class))).thenReturn(result(List.of(
            token(1, CONTRACT, "NOT_LINK", "2000000000000000000"),
            token(137, CONTRACT, "LINK", "9000000000000000000"),
            token(1, "0x4444444444444444444444444444444444444444", "LINK", "9000000000000000000")), List.of()));
        mvc.perform(post("/api/v1/posts").with(jwt().jwt(token -> token.subject(owner.getId().toString())))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"coinSymbol\":\"LINK\",\"title\":\"test\",\"content\":\"body\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.holderSnapshot.verificationLevel").value("WALLET"))
            .andExpect(jsonPath("$.holderSnapshot.quantityBand").value("1~10 LINK"));
    }

    @Test void requiresAuthenticationAndConfiguredKeyForConnectedWallets() throws Exception {
        mvc.perform(get("/api/v1/me/wallets/assets")).andExpect(status().isUnauthorized());
        when(alchemy.isConfigured()).thenReturn(false);
        mvc.perform(get("/api/v1/me/wallets/assets").with(jwt().jwt(token -> token.subject(owner.getId().toString()))))
            .andExpect(status().isServiceUnavailable());
        mvc.perform(get("/api/v1/me/assets").with(jwt().jwt(token -> token.subject(owner.getId().toString()))))
            .andExpect(status().isServiceUnavailable());
        verify(alchemy, never()).fetch(anyList(), any(Duration.class));
    }

    @Test void missingKeyCannotReuseFreshCachedHoldingsForPublication() throws Exception {
        mvc.perform(get("/api/v1/me/assets").with(jwt().jwt(token -> token.subject(owner.getId().toString()))))
            .andExpect(status().isOk());
        when(alchemy.isConfigured()).thenReturn(false);
        mvc.perform(post("/api/v1/posts").with(jwt().jwt(token -> token.subject(owner.getId().toString())))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"coinSymbol\":\"POL\",\"title\":\"test\",\"content\":\"body\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.holderSnapshot.holderStatus").value("UNKNOWN"))
            .andExpect(jsonPath("$.holderSnapshot.syncStatus").value("PARTIAL"))
            .andExpect(jsonPath("$.holderSnapshot.quantityBand").doesNotExist());
        verify(alchemy, times(1)).fetch(anyList(), any(Duration.class));
    }

    @Test void polygonProofUsesAlchemyAndCombinesMultipleConnectedWallets() throws Exception {
        wallets.saveAndFlush(new Wallet(owner, "0x" + UUID.randomUUID().toString().replace("-", "") + "87654321"));
        when(alchemy.fetch(anyList(), any(Duration.class))).thenAnswer(call -> {
            List<String> addresses = call.getArgument(0);
            return result(addresses.stream().map(walletAddress -> new AlchemyPortfolioClient.Token(walletAddress,
                "matic-mainnet", 137, null, "POL", "Polygon", 18, "5000000000000000000", new BigDecimal("5"), "READY")).toList(), List.of());
        });
        mvc.perform(get("/api/v1/me/assets").with(jwt().jwt(token -> token.subject(owner.getId().toString()))))
            .andExpect(status().isOk())
            .andExpect(response -> {
                var body = new com.fasterxml.jackson.databind.ObjectMapper().readTree(response.getResponse().getContentAsString());
                var pol = java.util.stream.StreamSupport.stream(body.path("assets").spliterator(), false)
                    .filter(asset -> "POL".equals(asset.path("symbol").asText())).findFirst().orElseThrow();
                org.junit.jupiter.api.Assertions.assertEquals(0, pol.path("quantity").decimalValue().compareTo(BigDecimal.TEN));
            })
            .andExpect(jsonPath("$.assets[?(@.symbol == 'POL')].walletCount").value(2));
        mvc.perform(post("/api/v1/posts").with(jwt().jwt(token -> token.subject(owner.getId().toString())))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"coinSymbol\":\"POL\",\"title\":\"test\",\"content\":\"body\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.holderSnapshot.verificationLevel").value("WALLET"))
            .andExpect(jsonPath("$.holderSnapshot.quantityBand").value("10~100 POL"));
    }

    @Test void oversizedBalanceCannotOverflowSnapshotStorageOrClaimVerifiedHoldings() throws Exception {
        when(alchemy.fetch(anyList(), any(Duration.class))).thenReturn(result(List.of(
            token(1, null, "ETH", java.math.BigInteger.ONE.shiftLeft(255).toString())), List.of()));
        mvc.perform(get("/api/v1/me/assets").with(jwt().jwt(token -> token.subject(owner.getId().toString()))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.unresolvedAssets[?(@.symbol == 'ETH')].holderStatus").value("UNKNOWN"))
            .andExpect(jsonPath("$.assets").isEmpty());
    }

    @Test void otherMemberCannotQueryOwnersWalletAndMissingMemberIsNotFound() throws Exception {
        Member other = members.saveAndFlush(new Member(UUID.randomUUID().toString(), "#123456"));
        mvc.perform(get("/api/v1/me/wallets/assets").with(jwt().jwt(token -> token.subject(other.getId().toString()))))
            .andExpect(status().isOk()).andExpect(jsonPath("$.assets").isEmpty());
        mvc.perform(get("/api/v1/me/wallets/assets").with(jwt().jwt(token -> token.subject("9223372036854775807"))))
            .andExpect(status().isNotFound());
        verify(alchemy, never()).fetch(anyList(), any(Duration.class));
    }

    @Test void zeroBalancesAreHiddenButPositiveRawBalanceWithoutMetadataRemainsVisible() throws Exception {
        var tiny = new AlchemyPortfolioClient.Token(address, "eth-mainnet", 1, CONTRACT, "UNLISTED", null,
            null, "1", null, "READY");
        when(alchemy.fetch(anyList(), any(Duration.class))).thenReturn(result(List.of(
            token(1, null, "ETH", "0"), token(137, null, "POL", "0"), tiny), List.of()));
        mvc.perform(get("/api/v1/me/wallets/assets").with(jwt().jwt(token -> token.subject(owner.getId().toString()))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.assets.length()").value(1))
            .andExpect(jsonPath("$.assets[0].rawBalance").value("1"))
            .andExpect(jsonPath("$.assets[0].quantity").doesNotExist())
            .andExpect(jsonPath("$.unresolvedAssets").isEmpty());
        mvc.perform(get("/api/v1/me/assets").with(jwt().jwt(token -> token.subject(owner.getId().toString()))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.assets").isEmpty())
            .andExpect(jsonPath("$.unresolvedAssets").isEmpty())
            .andExpect(jsonPath("$.walletAssets.assets.length()").value(1));
        // Filtering the HTTP list must not destroy the verified zero used at publication.
        mvc.perform(post("/api/v1/posts").with(jwt().jwt(token -> token.subject(owner.getId().toString())))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"coinSymbol\":\"POL\",\"title\":\"empty\",\"content\":\"body\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.holderSnapshot.holderStatus").value("EMPTY"));
    }

    @Test void unreadableTokenIsReportedSeparatelyInsteadOfClaimedAsAnAsset() throws Exception {
        var unknown = new AlchemyPortfolioClient.Token(address, "eth-mainnet", 1, null, "ETH", "Ethereum",
            18, null, null, "UNKNOWN");
        when(alchemy.fetch(anyList(), any(Duration.class))).thenReturn(result(List.of(unknown), List.of("eth-mainnet")));
        mvc.perform(get("/api/v1/me/wallets/assets").with(jwt().jwt(token -> token.subject(owner.getId().toString()))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.assets").isEmpty())
            .andExpect(jsonPath("$.unresolvedAssets[0].status").value("UNKNOWN"))
            .andExpect(jsonPath("$.failedNetworks[0]").value("eth-mainnet"));
        mvc.perform(get("/api/v1/me/assets").with(jwt().jwt(token -> token.subject(owner.getId().toString()))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.assets").isEmpty())
            .andExpect(jsonPath("$.unresolvedAssets[?(@.symbol == 'ETH')].holderStatus").value("UNKNOWN"))
            .andExpect(jsonPath("$.walletAssets.unresolvedAssets[0].status").value("UNKNOWN"));
    }

    @Test void positiveKnownSubtotalRemainsVisibleWhenAnotherSourceFails() throws Exception {
        when(exchanges.list(owner.getId())).thenReturn(List.of(new ExchangeConnectionService.ConnectionResponse(
            com.cryptalk.exchange.Exchange.UPBIT, Instant.now())));
        when(exchanges.assets(owner.getId(), com.cryptalk.exchange.Exchange.UPBIT)).thenThrow(
            new com.cryptalk.common.ApiException(org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE, "unavailable"));
        mvc.perform(get("/api/v1/me/assets").with(jwt().jwt(token -> token.subject(owner.getId().toString()))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.assets[?(@.symbol == 'ETH' && @.quantity > 0)].symbol").value("ETH"))
            .andExpect(jsonPath("$.assets[?(@.symbol == 'ETH')].syncStatus").value("PARTIAL"))
            .andExpect(jsonPath("$.assets[?(@.symbol == 'ETH')].verified").value(true))
            .andExpect(jsonPath("$.unresolvedAssets[?(@.symbol == 'ETH')].holderStatus").value("HOLDER"));
    }

    private AlchemyPortfolioClient.Result result(List<AlchemyPortfolioClient.Token> tokens, List<String> failed) {
        return new AlchemyPortfolioClient.Result(tokens, failed, true, failed.isEmpty() ? "READY" : "PARTIAL", Instant.now());
    }
    private AlchemyPortfolioClient.Token token(long chain, String contract, String symbol, String raw) {
        return new AlchemyPortfolioClient.Token(address, chain == 1 ? "eth-mainnet" : "matic-mainnet", chain,
            contract, symbol, "Test", 18, raw, new BigDecimal(new java.math.BigInteger(raw), 18), "READY");
    }
}
