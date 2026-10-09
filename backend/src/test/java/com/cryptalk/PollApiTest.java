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

@SpringBootTest(properties="cryptalk.admin.member-ids=100000")
@AutoConfigureMockMvc
class PollApiTest {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired MemberRepository members;
    @Autowired ObjectMapper json;
    @Autowired PollService polls;
    @MockitoBean(name="pollClock") Clock clock;
    long user;
    String body = "{\"question\":\"ETH direction?\",\"choices\":[\"Up\",\"Down\"]}";

    @BeforeEach
    void setup() {
        jdbc.update("INSERT INTO members(id,nickname,avatar_color,asset_visibility,created_at,updated_at) VALUES(100000,'poll-admin','#123456','EXACT',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)");
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
        mvc.perform(get("/api/v1/communities/BTC/poll")).andExpect(status().isNotFound());
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
}
