package com.cryptalk;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import com.cryptalk.common.ApiException;
import com.cryptalk.member.Member;
import com.cryptalk.member.MemberRepository;
import com.cryptalk.poll.PollService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Clock;
import java.time.Instant;
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
class PollApiTest {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired MemberRepository members;
    @Autowired ObjectMapper json;
    @Autowired PollService polls;
    @MockitoBean(name="pollClock") Clock clock;
    @MockitoBean com.cryptalk.market.MarketPriceService prices;
    @MockitoBean com.cryptalk.asset.AssetService assets;
    @Autowired com.cryptalk.coin.CoinRepository coins;
    long user;
    String body = "{\"question\":\"ETH direction?\",\"choices\":[\"Up\",\"Down\"]}";

    @BeforeEach
    void setup() {
        jdbc.update("INSERT INTO members(id,role,nickname,avatar_color,asset_visibility,created_at,updated_at) VALUES(100000,'ADMIN','poll-admin','#123456','EXACT',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)");
        user = members.saveAndFlush(new Member(UUID.randomUUID().toString(),"#123456")).getId();
        when(clock.instant()).thenReturn(Instant.parse("2026-10-09T14:59:59Z"));
    }
    @AfterEach
    void cleanup() {
        jdbc.update("DELETE FROM community_polls"); // FK cascades choices/votes in this dedicated test fixture.
        members.deleteById(user);
        members.deleteById(100000L);
    }

    @Test
    void hidesResultsBeforeParticipationAndResetsAtKoreanMidnightWithoutDeletingPoll() throws Exception {
        JsonNode created = create();
        long poll = created.path("id").asLong();
        long up = created.path("choices").get(0).path("id").asLong();
        long down = created.path("choices").get(1).path("id").asLong();
        mvc.perform(get("/api/v1/communities/ETH/poll"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.participatedToday").value(false))
            .andExpect(jsonPath("$.totalVotes").doesNotExist()).andExpect(jsonPath("$.choices[0].voteCount").doesNotExist());
        mvc.perform(get("/api/v1/communities/BTC/poll")).andExpect(status().isForbidden())
            .andExpect(jsonPath("$.code").value("ROOM_CLOSED"));
        mvc.perform(post("/api/v1/polls/{id}/votes",poll).with(jwt().jwt(token -> token.subject(Long.toString(user))))
            .contentType(MediaType.APPLICATION_JSON).content("{\"choiceId\":"+up+"}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.day").value("2026-10-09"))
            .andExpect(jsonPath("$.totalVotes").value(1));
        mvc.perform(post("/api/v1/polls/{id}/votes",poll).with(jwt().jwt(token -> token.subject(Long.toString(user))))
            .contentType(MediaType.APPLICATION_JSON).content("{\"choiceId\":"+down+"}"))
            .andExpect(status().isConflict());
        mvc.perform(get("/api/v1/polls/{id}",poll))
            .andExpect(status().isOk()).andExpect(jsonPath("$.totalVotes").doesNotExist());
        mvc.perform(get("/api/v1/polls/{id}",poll).with(jwt().jwt(token -> token.subject("100000"))))
            .andExpect(status().isOk()).andExpect(jsonPath("$.totalVotes").doesNotExist());
        when(clock.instant()).thenReturn(Instant.parse("2026-10-09T15:00:00Z"));
        mvc.perform(get("/api/v1/polls/{id}",poll).with(jwt().jwt(token -> token.subject(Long.toString(user)))))
            .andExpect(status().isOk()).andExpect(jsonPath("$.id").value(poll))
            .andExpect(jsonPath("$.day").value("2026-10-10"))
            .andExpect(jsonPath("$.participatedToday").value(false)).andExpect(jsonPath("$.totalVotes").doesNotExist());
        mvc.perform(post("/api/v1/polls/{id}/votes",poll).with(jwt().jwt(token -> token.subject(Long.toString(user))))
            .contentType(MediaType.APPLICATION_JSON).content("{\"choiceId\":"+down+"}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.totalVotes").value(1))
            .andExpect(jsonPath("$.choices[0].voteCount").value(0)).andExpect(jsonPath("$.choices[1].voteCount").value(1));
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM poll_votes WHERE poll_id=?",Long.class,poll)).isEqualTo(2L);
    }

    @Test
    void requiresOperatorForCreationAndRejectsInvalidChoiceAndClosedVoting() throws Exception {
        mvc.perform(post("/api/v1/communities/ETH/polls").contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/communities/ETH/polls").with(jwt().jwt(token -> token.subject(Long.toString(user))))
            .contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isForbidden());
        mvc.perform(post("/api/v1/communities/ETH/polls").with(jwt().jwt(token -> token.subject("100000")))
            .contentType(MediaType.APPLICATION_JSON).content(body.replace("Down","Up"))).andExpect(status().isBadRequest());
        var poll = create();
        long id = poll.path("id").asLong();
        long choice = poll.path("choices").get(0).path("id").asLong();
        mvc.perform(post("/api/v1/polls/{id}/votes",id).contentType(MediaType.APPLICATION_JSON).content("{\"choiceId\":"+choice+"}"))
            .andExpect(status().isUnauthorized());
        var btc = json.readTree(mvc.perform(post("/api/v1/communities/BTC/polls")
            .with(jwt().jwt(token -> token.subject("100000"))).contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString());
        long otherChoice = btc.path("choices").get(0).path("id").asLong();
        mvc.perform(get("/api/v1/communities/ETH/poll")).andExpect(jsonPath("$.id").value(id));
        mvc.perform(post("/api/v1/polls/{id}/votes",id).with(jwt().jwt(token -> token.subject(Long.toString(user))))
            .contentType(MediaType.APPLICATION_JSON).content("{\"choiceId\":"+otherChoice+"}"))
            .andExpect(status().isBadRequest());
        mvc.perform(post("/api/v1/polls/{id}/close",id).with(jwt().jwt(token -> token.subject(Long.toString(user)))))
            .andExpect(status().isForbidden());
        mvc.perform(post("/api/v1/polls/{id}/close",id).with(jwt().jwt(token -> token.subject("100000"))))
            .andExpect(status().isNoContent());
        mvc.perform(post("/api/v1/polls/{id}/votes",id).with(jwt().jwt(token -> token.subject(Long.toString(user))))
            .contentType(MediaType.APPLICATION_JSON).content("{\"choiceId\":"+choice+"}"))
            .andExpect(status().isConflict());
    }

    @Test
    void onlyAdministratorsCanDeleteAnActivePoll() throws Exception {
        long id = create().path("id").asLong();

        mvc.perform(delete("/api/v1/polls/{id}", id)).andExpect(status().isUnauthorized());
        mvc.perform(delete("/api/v1/polls/{id}", id).with(jwt().jwt(t -> t.subject(Long.toString(user)))))
            .andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/communities/ETH/poll")).andExpect(status().isOk())
            .andExpect(jsonPath("$.id").value(id));

        mvc.perform(delete("/api/v1/polls/{id}", id).with(jwt().jwt(t -> t.subject("100000"))))
            .andExpect(status().isNoContent());
        mvc.perform(get("/api/v1/communities/ETH/poll")).andExpect(status().isNotFound());
        mvc.perform(delete("/api/v1/polls/{id}", id).with(jwt().jwt(t -> t.subject("100000"))))
            .andExpect(status().isNotFound());
        mvc.perform(delete("/api/v1/polls/{id}", 999999).with(jwt().jwt(t -> t.subject("100000"))))
            .andExpect(status().isNotFound());
    }

    @Test
    void removesADeletedPollFromResultsAndHistoryWhileKeepingItsRecords() throws Exception {
        var deleted = create();
        long deletedId = deleted.path("id").asLong();
        long choiceId = deleted.path("choices").get(0).path("id").asLong();
        polls.vote(user, deletedId, choiceId);
        var retained = create();
        long retainedId = retained.path("id").asLong();
        polls.vote(user, retainedId, retained.path("choices").get(0).path("id").asLong());
        polls.close(100000L, retainedId);

        mvc.perform(delete("/api/v1/polls/{id}", deletedId).with(jwt().jwt(t -> t.subject("100000"))))
            .andExpect(status().isNoContent());
        mvc.perform(get("/api/v1/polls/{id}", deletedId)).andExpect(status().isNotFound());
        mvc.perform(get("/api/v1/polls/{id}/results", deletedId)).andExpect(status().isNotFound());
        mvc.perform(post("/api/v1/polls/{id}/close", deletedId).with(jwt().jwt(t -> t.subject("100000"))))
            .andExpect(status().isNotFound());
        mvc.perform(post("/api/v1/polls/{id}/votes", deletedId).with(jwt().jwt(t -> t.subject(Long.toString(user))))
            .contentType(MediaType.APPLICATION_JSON).content("{\"choiceId\":" + choiceId + "}"))
            .andExpect(status().isNotFound());
        mvc.perform(get("/api/v1/communities/ETH/polls/results").param("size", "1"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(1))
            .andExpect(jsonPath("$.items[0].pollId").value(retainedId));
        mvc.perform(get("/api/v1/me/votes").with(jwt().jwt(t -> t.subject(Long.toString(user)))).param("size", "1"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(1))
            .andExpect(jsonPath("$.items[0].result.pollId").value(retainedId));

        Instant deletedAt = jdbc.queryForObject("SELECT deleted_at FROM community_polls WHERE id = ?",
            (row, index) -> row.getTimestamp(1).toInstant(), deletedId);
        assertThat(deletedAt).isEqualTo(clock.instant());
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM poll_choices WHERE poll_id = ?", Long.class, deletedId))
            .isEqualTo(2L);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM poll_votes WHERE poll_id = ?", Long.class, deletedId))
            .isEqualTo(1L);
    }

    @Test
    void simultaneousSubmissionsCannotVoteTwice() throws Exception {
        var poll = create();
        long id = poll.path("id").asLong();
        long choice = poll.path("choices").get(0).path("id").asLong();
        var start = new java.util.concurrent.CountDownLatch(1);
        try (var executor = java.util.concurrent.Executors.newFixedThreadPool(2)) {
            java.util.concurrent.Callable<Boolean> submit = () -> {
                start.await();
                try { polls.vote(user,id,choice); return true; }
                catch (ApiException expected) { assertThat(expected.status()).isEqualTo(org.springframework.http.HttpStatus.CONFLICT); return false; }
            };
            var first = executor.submit(submit);
            var second = executor.submit(submit);
            start.countDown();
            assertThat(java.util.List.of(first.get(10,java.util.concurrent.TimeUnit.SECONDS),second.get(10,java.util.concurrent.TimeUnit.SECONDS)))
                .containsExactlyInAnyOrder(true,false);
        }
        assertThat(polls.get(id,user).totalVotes()).isEqualTo(1L);
        var replacement = create();
        assertThat(polls.get(id,user).active()).isFalse();
        assertThat(polls.current("ETH",user).id()).isEqualTo(replacement.path("id").asLong());
        mvc.perform(get("/api/v1/polls/999999")).andExpect(status().isNotFound());
    }

    private JsonNode create() throws Exception {
        return json.readTree(mvc.perform(post("/api/v1/communities/ETH/polls")
            .with(jwt().jwt(token -> token.subject("100000"))).contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString());
    }

    @Test
    void publishesPastAndClosedResultsButProtectsActiveToday() throws Exception {
        var poll = create();
        long id = poll.path("id").asLong();
        polls.vote(user,id,poll.path("choices").get(0).path("id").asLong());
        mvc.perform(get("/api/v1/polls/{id}/results",id).param("to","2026-10-09"))
            .andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/polls/{id}/results",id).param("to","2026-10-09")
            .with(jwt().jwt(t -> t.subject("100000")))).andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/polls/{id}/results",id).param("to","2026-10-09")
            .with(jwt().jwt(t -> t.subject(Long.toString(user)))))
            .andExpect(status().isOk()).andExpect(jsonPath("$.items[0].totalVotes").value(1));
        mvc.perform(get("/api/v1/communities/ETH/polls/results"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(0));
        when(clock.instant()).thenReturn(Instant.parse("2026-10-09T15:00:00Z"));
        mvc.perform(get("/api/v1/polls/{id}/results",id))
            .andExpect(status().isOk()).andExpect(jsonPath("$.items[0].day").value("2026-10-09"))
            .andExpect(jsonPath("$.items[0].choices[1].voteCount").value(0));
        polls.vote(user,id,poll.path("choices").get(1).path("id").asLong());
        polls.close(100000L,id);
        mvc.perform(get("/api/v1/polls/{id}",id)).andExpect(status().isOk())
            .andExpect(jsonPath("$.totalVotes").value(1)).andExpect(jsonPath("$.participatedToday").value(false));
        mvc.perform(get("/api/v1/polls/{id}/results",id))
            .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(2))
            .andExpect(jsonPath("$.items[0].day").value("2026-10-10"));
    }

    @Test
    void paginatesSameDayQuestionsAndRestrictsMyHistoryToTheAuthenticatedMember() throws Exception {
        var first = create();
        polls.vote(user,first.path("id").asLong(),first.path("choices").get(0).path("id").asLong());
        var second = create();
        polls.vote(user,second.path("id").asLong(),second.path("choices").get(1).path("id").asLong());
        polls.close(100000L,second.path("id").asLong());
        mvc.perform(get("/api/v1/communities/ETH/polls/results").param("size","1"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(2))
            .andExpect(jsonPath("$.hasNext").value(true))
            .andExpect(jsonPath("$.items[0].pollId").value(second.path("id").asLong()));
        mvc.perform(get("/api/v1/communities/ETH/polls/results").param("size","1").param("page","1"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.items[0].pollId").value(first.path("id").asLong()));
        mvc.perform(get("/api/v1/me/votes")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/me/votes").with(jwt().jwt(t -> t.subject("100000"))))
            .andExpect(status().isOk()).andExpect(jsonPath("$.items").isEmpty());
        mvc.perform(get("/api/v1/me/votes").with(jwt().jwt(t -> t.subject(Long.toString(user)))).param("size","1"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(2))
            .andExpect(jsonPath("$.items[0].choiceLabel").value("Down"));
        for (String path : java.util.List.of("/api/v1/me/votes","/api/v1/communities/ETH/polls/results",
                "/api/v1/polls/"+first.path("id").asLong()+"/results")) {
            mvc.perform(get(path).with(jwt().jwt(t -> t.subject(Long.toString(user)))).param("size","101"))
                .andExpect(status().isBadRequest());
            mvc.perform(get(path).with(jwt().jwt(t -> t.subject(Long.toString(user)))).param("page","-1"))
                .andExpect(status().isBadRequest());
        }
        mvc.perform(get("/api/v1/polls/{id}/results",first.path("id").asLong()).param("to","2026-10-10"))
            .andExpect(status().isBadRequest());
        mvc.perform(get("/api/v1/polls/{id}/results",first.path("id").asLong())
            .param("from","2026-10-09").param("to","2026-10-08")).andExpect(status().isBadRequest());
        mvc.perform(get("/api/v1/polls/999999/results")).andExpect(status().isNotFound());
        mvc.perform(get("/api/v1/communities/BTC/polls/results")).andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/communities/NONE/polls/results")).andExpect(status().isNotFound());
    }

    @Test
    void capturesImmutableSnapshotsAndKeepsQuantitiesAndPricesOutOfResponses() throws Exception {
        var coin = coins.findBySymbolIgnoreCaseAndActiveTrue("ETH").orElseThrow();
        var asset = new com.cryptalk.asset.AssetSnapshot(members.findById(user).orElseThrow(),coin);
        asset.capture(new java.math.BigDecimal("2"),new java.math.BigDecimal("100000"),true,"VERIFIED",1);
        // JPA may load a different Coin instance for the vote transaction.
        when(assets.snapshotForPublication(org.mockito.ArgumentMatchers.eq(user),org.mockito.ArgumentMatchers.any())).thenReturn(asset);
        when(prices.currentPrice(org.mockito.ArgumentMatchers.any(),org.mockito.ArgumentMatchers.eq("USD")))
            .thenReturn(new com.cryptalk.market.MarketPriceService.PriceQuote("ETH",new java.math.BigDecimal("2500"),
                "USD",null,Instant.parse("2026-10-09T14:59:58Z"),"COINGECKO"));
        var poll = create();
        long id = poll.path("id").asLong();
        polls.vote(user,id,poll.path("choices").get(0).path("id").asLong());
        var row = jdbc.queryForMap("SELECT * FROM poll_votes WHERE poll_id=?",id);
        assertThat(row.get("quantity_band")).isEqualTo("1~10 ETH");
        assertThat(row.get("holder_status")).isEqualTo("HOLDER");
        assertThat((java.math.BigDecimal)row.get("price")).isEqualByComparingTo("2500");
        assertThat(row.get("price_source")).isEqualTo("COINGECKO");
        asset.capture(java.math.BigDecimal.ZERO,java.math.BigDecimal.ZERO,false,"VERIFIED",1);
        String response = mvc.perform(get("/api/v1/me/votes").with(jwt().jwt(t -> t.subject(Long.toString(user)))))
            .andExpect(status().isOk()).andExpect(jsonPath("$.items[0].votedAt").value("2026-10-09T14:59:59Z"))
            .andExpect(jsonPath("$.items[0].result.holderResults[0].holderStatus").value("HOLDER"))
            .andReturn().getResponse().getContentAsString();
        assertThat(response).doesNotContain("quantity","price","wallet");
        assertThat(jdbc.queryForObject("SELECT holder_status FROM poll_votes WHERE poll_id=?",String.class,id)).isEqualTo("HOLDER");
    }

    @Test
    void leavesLegacySnapshotsUnknownAndAcceptsVotesDuringPriceOutage() throws Exception {
        var poll = create();
        long id = poll.path("id").asLong();
        long choice = poll.path("choices").get(0).path("id").asLong();
        jdbc.update("INSERT INTO poll_votes(poll_id,member_id,choice_id,vote_date) VALUES(?,?,?,?)",id,user,choice,"2026-10-08");
        mvc.perform(get("/api/v1/me/votes").with(jwt().jwt(t -> t.subject(Long.toString(user)))))
            .andExpect(status().isOk()).andExpect(jsonPath("$.items[0].votedAt").doesNotExist())
            .andExpect(jsonPath("$.items[0].result.holderResults[0].holderStatus").value("UNKNOWN"));
        when(prices.currentPrice(org.mockito.ArgumentMatchers.any(),org.mockito.ArgumentMatchers.any()))
            .thenThrow(new ApiException(org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE,"offline"));
        polls.vote(user,id,choice);
        assertThat(jdbc.queryForObject("SELECT price FROM poll_votes WHERE poll_id=? AND vote_date='2026-10-09'",java.math.BigDecimal.class,id)).isNull();
        assertThat(jdbc.queryForObject("SELECT holder_status FROM poll_votes WHERE poll_id=? AND vote_date='2026-10-09'",String.class,id)).isEqualTo("NOT_CONNECTED");
    }

    @Test
    void capturesFinalKstDayWhenSnapshotRefreshCrossesMidnight() throws Exception {
        var poll = create();
        when(assets.snapshotForPublication(org.mockito.ArgumentMatchers.any(),org.mockito.ArgumentMatchers.any()))
            .thenAnswer(invocation -> {
                when(clock.instant()).thenReturn(Instant.parse("2026-10-09T15:00:00Z"));
                return null;
            });
        var result = polls.vote(user,poll.path("id").asLong(),poll.path("choices").get(0).path("id").asLong());
        assertThat(result.day()).isEqualTo(java.time.LocalDate.parse("2026-10-10"));
        mvc.perform(get("/api/v1/me/votes").with(jwt().jwt(t -> t.subject(Long.toString(user)))))
            .andExpect(status().isOk()).andExpect(jsonPath("$.items[0].day").value("2026-10-10"))
            .andExpect(jsonPath("$.items[0].votedAt").value("2026-10-09T15:00:00Z"));
    }

    @Test
    void aggregatesHolderGroupsAndPreservesPrivateHistoryAfterRoomClosure() throws Exception {
        var poll = create();
        long id = poll.path("id").asLong();
        long up = poll.path("choices").get(0).path("id").asLong();
        long down = poll.path("choices").get(1).path("id").asLong();
        jdbc.update("INSERT INTO poll_votes(poll_id,member_id,choice_id,vote_date,holder_status) VALUES(?,?,?,?,?)",id,user,up,"2026-10-08","HOLDER");
        jdbc.update("INSERT INTO poll_votes(poll_id,member_id,choice_id,vote_date,holder_status) VALUES(?,?,?,?,?)",id,100000L,down,"2026-10-08","EMPTY");
        mvc.perform(get("/api/v1/polls/{id}/results",id))
            .andExpect(status().isOk()).andExpect(jsonPath("$.items[0].totalVotes").value(2))
            .andExpect(jsonPath("$.items[0].holderResults[0].holderStatus").value("EMPTY"))
            .andExpect(jsonPath("$.items[0].holderResults[0].choices[0].voteCount").value(0))
            .andExpect(jsonPath("$.items[0].holderResults[1].holderStatus").value("HOLDER"))
            .andExpect(jsonPath("$.items[0].holderResults[1].choices[0].voteCount").value(1));
        jdbc.update("UPDATE coins SET operation_status='CLOSE' WHERE symbol='ETH'");
        try {
            mvc.perform(get("/api/v1/polls/{id}/results",id)).andExpect(status().isForbidden());
            mvc.perform(get("/api/v1/me/votes").with(jwt().jwt(t -> t.subject(Long.toString(user)))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items[0].result.totalVotes").value(2));
        } finally {
            jdbc.update("UPDATE coins SET operation_status='OPEN' WHERE symbol='ETH'");
        }
    }
}
