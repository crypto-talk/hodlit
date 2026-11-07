package com.cryptalk;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.cryptalk.asset.AssetService;
import com.cryptalk.asset.AssetSnapshot;
import com.cryptalk.coin.*;
import com.cryptalk.draft.Draft;
import com.cryptalk.draft.DraftRepository;
import com.cryptalk.market.MarketPriceService;
import com.cryptalk.member.*;
import com.cryptalk.post.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class PostCoinAttachmentsApiTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired MemberRepository members;
    @Autowired CoinRepository coins;
    @Autowired PostRepository posts;
    @Autowired DraftRepository drafts;
    @Autowired PostHolderSnapshotRepository roomSnapshots;
    @Autowired AssetPublicationService publication;
    @Autowired JdbcTemplate jdbc;
    @Autowired EntityManager em;
    @MockitoBean AssetService assets;
    @MockitoBean MarketPriceService prices;
    Member owner;
    Coin eth;
    Coin pol;
    Coin general;
    AssetSnapshot ethHolding;
    AssetSnapshot polHolding;

    @BeforeEach
    void setup() {
        owner = members.saveAndFlush(new Member("attachment-owner", "#123456"));
        eth = coins.findBySymbolIgnoreCaseAndActiveTrue("ETH").orElseThrow();
        pol = coins.findBySymbolIgnoreCaseAndActiveTrue("POL").orElseThrow();
        general = new Coin("OTHER", "기타", 999, null);
        general.changeOperationStatus(RoomOperationStatus.OPEN);
        coins.saveAndFlush(general);
        coins.saveAndFlush(new Coin("UNSUPPORTED", "미지원", 1000, null));
        ethHolding = holding(eth, "5");
        polHolding = holding(pol, "100");
        when(assets.snapshotForPublication(eq(owner.getId()), any())).thenReturn(ethHolding);
        when(assets.snapshotsForPublication(eq(owner.getId()), anyList()))
            .thenReturn(Map.of(eth.getId(), ethHolding, pol.getId(), polHolding));
        when(prices.currentPrice(any(Coin.class), nullable(String.class))).thenReturn(
            new MarketPriceService.PriceQuote("ETH", BigDecimal.ONE, "USD", BigDecimal.ZERO, Instant.now(), "TEST"));
    }

    @Test
    void publicationAutomaticallyIncludesRoomAndFreezesSelectionsAndProof() throws Exception {
        long id = publish("ETH", "[\"pol\"]");
        assertSymbols(id, "ETH", "POL");
        mvc.perform(get("/api/v1/posts/{id}", id))
            .andExpect(jsonPath("$.attachedCoinSnapshots[0].badge.name").value("돌고래"))
            .andExpect(jsonPath("$.attachedCoinSnapshots[0].quantityBand").value("1~10 ETH"));
        verify(assets).snapshotsForPublication(eq(owner.getId()), argThat(selected ->
            selected.stream().map(Coin::getSymbol).toList().equals(List.of("ETH", "POL"))));
        verify(assets, never()).snapshotForPublication(anyLong(), any());
        ethHolding.capture(BigDecimal.ZERO, BigDecimal.ZERO, false, "VERIFIED", 1);
        mvc.perform(put("/api/v1/posts/{id}", id).with(jwt().jwt(t -> t.subject(owner.getId().toString())))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"title\":\"edited\",\"content\":\"edited\",\"attachedCoins\":[]}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.attachedCoinSnapshots[0].holderStatus").value("HOLDER"));
        assertSymbols(id, "ETH", "POL");
        mvc.perform(get("/api/v1/communities/ETH/posts"))
            .andExpect(status().isOk()).andExpect(jsonPath("$[0].attachedCoinSnapshots.length()").value(2));
        mvc.perform(get("/api/v1/members/{id}/posts/page", owner.getId()))
            .andExpect(status().isOk()).andExpect(jsonPath("$.items[0].attachedCoinSnapshots.length()").value(2));
        String body = mvc.perform(get("/api/v1/posts/{id}", id)).andReturn().getResponse().getContentAsString();
        assertThat(json.readTree(body).findValues("quantityExact")).isEmpty();
        assertThat(json.readTree(body).findValues("holdingSince")).isEmpty();
    }

    @Test
    void generalRoomHasOnlySelectedCoinsAndAllowsEmptySelection() throws Exception {
        long empty = publish("OTHER", "[]");
        assertSymbols(empty);
        verifyNoInteractions(assets);
        long selected = publish("OTHER", "[\"ETH\",\"POL\"]");
        assertSymbols(selected, "ETH", "POL");
        mvc.perform(get("/api/v1/posts/{id}", selected))
            .andExpect(jsonPath("$.verifiedHolder").value(false));
    }

    @Test
    void duplicatesUnsupportedUnknownAndExcessSelectionsAreRejectedAtomically() throws Exception {
        long before = posts.count();
        for (String selection : List.of("[\"POL\",\"pol\"]", "[\"OTHER\"]", "[\"NOCOIN\"]",
                "[\"UNSUPPORTED\"]", "[null]", "[\"ETH\",\"POL\",\"SOL\",\"XRP\"]")) {
            mvc.perform(post("/api/v1/posts").with(jwt().jwt(t -> t.subject(owner.getId().toString())))
                    .contentType(MediaType.APPLICATION_JSON).content(payload("ETH", selection)))
                .andExpect(status().isBadRequest());
        }
        assertThat(posts.count()).isEqualTo(before);
        verifyNoInteractions(assets);
        mvc.perform(post("/api/v1/posts").contentType(MediaType.APPLICATION_JSON).content(payload("ETH", "[]")))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void threeAdditionalCoinsAreAllowedAndExplicitRoomSelectionIsDeduplicated() throws Exception {
        for (String symbol : List.of("ALT1", "ALT2")) {
            Coin coin = new Coin(symbol, symbol, 1001, null);
            coin.enableVerification();
            coins.saveAndFlush(coin);
        }
        long full = publish("ETH", "[\"POL\",\"ALT1\",\"ALT2\"]");
        assertSymbols(full, "ETH", "POL", "ALT1", "ALT2");
        long roomOnly = publish("ETH", "[\"eth\"]");
        assertSymbols(roomOnly, "ETH");
    }

    @Test
    void inactiveCoinCannotBeSelected() throws Exception {
        pol.updateCatalog(pol.getName(), pol.getDisplayOrder(), null, false);
        coins.flush();
        mvc.perform(post("/api/v1/posts").with(jwt().jwt(t -> t.subject(owner.getId().toString())))
                .contentType(MediaType.APPLICATION_JSON).content(payload("ETH", "[\"POL\"]")))
            .andExpect(status().isBadRequest());
    }

    @Test
    void snapshotsFollowGlobalAndPerCoinPrivacyWithoutChangingStoredProof() throws Exception {
        long id = publish("ETH", "[\"POL\"]");
        publication.save(owner.getId(), "POL", false);
        assertSymbols(id, "ETH");
        publication.save(owner.getId(), "POL", true);
        owner.changeAssetVisibility(AssetVisibility.HIDDEN);
        members.flush();
        assertSymbols(id);
        mvc.perform(get("/api/v1/members/{id}/posts/page", owner.getId()))
            .andExpect(status().isOk()).andExpect(jsonPath("$.items[0].attachedCoinSnapshots").isEmpty());
        owner.changeAssetVisibility(AssetVisibility.RANGE);
        members.flush();
        assertSymbols(id, "ETH", "POL");
    }

    @Test
    void unconnectedEmptyAndFailedHoldingsAreDistinctAndCanBeAttached() throws Exception {
        when(assets.snapshotsForPublication(eq(owner.getId()), anyList())).thenReturn(Map.of());
        long unconnected = publish("OTHER", "[\"POL\"]");
        mvc.perform(get("/api/v1/posts/{id}", unconnected))
            .andExpect(jsonPath("$.attachedCoinSnapshots[0].holderStatus").value("NOT_CONNECTED"));
        polHolding.capture(BigDecimal.ZERO, BigDecimal.ZERO, false, "VERIFIED", 1);
        when(assets.snapshotsForPublication(eq(owner.getId()), anyList())).thenReturn(Map.of(pol.getId(), polHolding));
        long empty = publish("OTHER", "[\"POL\"]");
        mvc.perform(get("/api/v1/posts/{id}", empty))
            .andExpect(jsonPath("$.attachedCoinSnapshots[0].holderStatus").value("EMPTY"));
        polHolding.capture(BigDecimal.ZERO, BigDecimal.ZERO, false, "UNKNOWN", 1);
        polHolding.captureSources("UNVERIFIED", 0, "PARTIAL");
        long failed = publish("OTHER", "[\"POL\"]");
        mvc.perform(get("/api/v1/posts/{id}", failed))
            .andExpect(jsonPath("$.attachedCoinSnapshots[0].holderStatus").value("UNKNOWN"));
    }

    @Test
    void oldPostsExposeOnlyExistingRoomSnapshotAndDeleteCascadesExtraRows() throws Exception {
        Post legacy = posts.saveAndFlush(new Post(owner, eth, "old", "body", null, false,
            null, null, null, null, null, null, null, null, null, null));
        assertSymbols(legacy.getId());
        roomSnapshots.saveAndFlush(new PostHolderSnapshot(legacy, ethHolding));
        assertSymbols(legacy.getId(), "ETH");
        long id = publish("ETH", "[\"POL\"]");
        em.flush();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM post_coin_snapshots WHERE post_id=?", Long.class, id)).isEqualTo(1);
        mvc.perform(delete("/api/v1/posts/{id}", id).with(jwt().jwt(t -> t.subject(owner.getId().toString()))))
            .andExpect(status().isNoContent());
        em.flush();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM posts WHERE id=?", Long.class, id)).isZero();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM post_coin_snapshots WHERE post_id=?", Long.class, id)).isZero();
    }

    @Test
    void draftsRoundTripSelectionsAndOldPayloadsRemainReadable() throws Exception {
        long id = json.readTree(mvc.perform(post("/api/v1/drafts")
                .with(jwt().jwt(t -> t.subject(owner.getId().toString()))).contentType(MediaType.APPLICATION_JSON)
                .content("{\"attachedCoins\":[\"ETH\",\"POL\"]}"))
            .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString()).path("id").asLong();
        mvc.perform(get("/api/v1/drafts/{id}", id).with(jwt().jwt(t -> t.subject(owner.getId().toString()))))
            .andExpect(status().isOk()).andExpect(jsonPath("$.attachedCoins.length()").value(2));
        mvc.perform(put("/api/v1/drafts/{id}", id).with(jwt().jwt(t -> t.subject(owner.getId().toString())))
                .contentType(MediaType.APPLICATION_JSON).content("{\"attachedCoins\":[\"POL\"]}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.attachedCoins[0]").value("POL"));
        Draft legacy = drafts.saveAndFlush(new Draft(owner, "{\"title\":\"old\"}"));
        mvc.perform(get("/api/v1/drafts/{id}", legacy.getId()).with(jwt().jwt(t -> t.subject(owner.getId().toString()))))
            .andExpect(status().isOk()).andExpect(jsonPath("$.attachedCoins").isEmpty());
        verifyNoInteractions(assets);
    }

    private long publish(String symbol, String selection) throws Exception {
        String body = mvc.perform(post("/api/v1/posts").with(jwt().jwt(t -> t.subject(owner.getId().toString())))
                .contentType(MediaType.APPLICATION_JSON).content(payload(symbol, selection)))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return json.readTree(body).path("id").asLong();
    }

    private String payload(String symbol, String selection) {
        return "{\"coinSymbol\":\"" + symbol + "\",\"title\":\"test\",\"content\":\"body\",\"attachedCoins\":" + selection + "}";
    }

    private void assertSymbols(long id, String... expected) throws Exception {
        String body = mvc.perform(get("/api/v1/posts/{id}", id)).andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString();
        var symbols = new java.util.ArrayList<String>();
        json.readTree(body).path("attachedCoinSnapshots").forEach(item -> symbols.add(item.path("coinSymbol").asText()));
        assertThat(symbols).containsExactly(expected);
    }

    private AssetSnapshot holding(Coin coin, String amount) {
        AssetSnapshot holding = new AssetSnapshot(owner, coin);
        holding.capture(new BigDecimal(amount), BigDecimal.ZERO, true, "VERIFIED", 1);
        holding.captureSources("WALLET", 0, "READY");
        return holding;
    }
}
