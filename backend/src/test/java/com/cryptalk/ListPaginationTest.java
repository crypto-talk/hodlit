package com.cryptalk;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.cryptalk.coin.CoinRepository;
import com.cryptalk.member.Member;
import com.cryptalk.member.MemberRepository;
import java.sql.Timestamp;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class ListPaginationTest {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired MemberRepository members;
    @Autowired CoinRepository coins;

    @Test
    void pagesAllPostsRoomPostsAndCommentsWithStableOrdering() throws Exception {
        long member = members.saveAndFlush(new Member("pagination-author", "#123456")).getId();
        long coin = coins.findBySymbolIgnoreCaseAndActiveTrue("ETH").orElseThrow().getId();
        Timestamp time = Timestamp.from(Instant.now());
        for (int i = 0; i < 23; i++) {
            jdbc.update("INSERT INTO posts(member_id,coin_id,title,content,author_verified,created_at,updated_at) VALUES(?,?,?,?,?,?,?)",
                member, coin, "title-" + i, "body", i == 22, time, time);
        }
        long post = jdbc.queryForObject("SELECT MAX(id) FROM posts WHERE member_id=?", Long.class, member);
        for (int i = 0; i < 21; i++) {
            jdbc.update("INSERT INTO comments(post_id,member_id,content,created_at) VALUES(?,?,?,?)",
                post, member, "comment-" + i, time);
        }
        mvc.perform(get("/api/v1/posts/page"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.items.length()").value(20))
            .andExpect(jsonPath("$.items[0].title").value("title-22"))
            .andExpect(jsonPath("$.totalElements").value(23)).andExpect(jsonPath("$.totalPages").value(2))
            .andExpect(jsonPath("$.hasNext").value(true));
        mvc.perform(get("/api/v1/communities/eth/posts/page").param("page", "1"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.items.length()").value(3))
            .andExpect(jsonPath("$.hasNext").value(false)).andExpect(jsonPath("$.hasPrevious").value(true));
        mvc.perform(get("/api/v1/communities/eth/posts/page").param("verified", "true"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(1));
        mvc.perform(get("/api/v1/posts/{id}/comments/page", post).param("page", "1"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(21))
            .andExpect(jsonPath("$.items.length()").value(1))
            .andExpect(jsonPath("$.items[0].content").value("comment-20"));
        mvc.perform(get("/api/v1/posts/page").param("page", "5"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.items.length()").value(0))
            .andExpect(jsonPath("$.totalElements").value(23));
    }

    @Test
    void numbersCombinedFeedsWithoutLosingRepostEventsOrFollowingScope() throws Exception {
        long author = members.saveAndFlush(new Member("page-feed-author", "#123456")).getId();
        long outsider = members.saveAndFlush(new Member("page-feed-outsider", "#123456")).getId();
        long viewer = members.saveAndFlush(new Member("page-feed-viewer", "#123456")).getId();
        long coin = coins.findBySymbolIgnoreCaseAndActiveTrue("ETH").orElseThrow().getId();
        Timestamp time = Timestamp.from(Instant.now());
        for (int i=0; i<25; i++) {
            jdbc.update("INSERT INTO posts(member_id,coin_id,title,content,created_at,updated_at) VALUES(?,?,?,?,?,?)",
                i<23 ? author : outsider,coin,"feed-"+i,"body",time,time);
        }
        long followedPost = jdbc.queryForObject("SELECT MAX(id) FROM posts WHERE member_id=?",Long.class,author);
        long outsiderPost = jdbc.queryForObject("SELECT MAX(id) FROM posts WHERE member_id=?",Long.class,outsider);
        jdbc.update("INSERT INTO post_reposts(post_id,member_id,created_at) VALUES(?,?,?)",followedPost,outsider,time);
        jdbc.update("INSERT INTO post_reposts(post_id,member_id,created_at) VALUES(?,?,?)",outsiderPost,author,time);
        jdbc.update("INSERT INTO member_follows(follower_id,following_id,created_at) VALUES(?,?,?)",viewer,author,time);
        mvc.perform(get("/api/v1/feed/page"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(27))
            .andExpect(jsonPath("$.items.length()").value(20)).andExpect(jsonPath("$.items[0].eventType").value("REPOST"));
        mvc.perform(get("/api/v1/feed/page").param("page","1"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.items.length()").value(7));
        mvc.perform(get("/api/v1/feed/following/page")).andExpect(status().isUnauthorized());
        var jwt = org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt()
            .jwt(token -> token.subject(Long.toString(viewer)));
        mvc.perform(get("/api/v1/feed/following/page").with(jwt))
            .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(24))
            .andExpect(jsonPath("$.items[0].actor.id").value(author))
            .andExpect(jsonPath("$.items[0].post.author.id").value(outsider));
        mvc.perform(get("/api/v1/feed/following/page").with(jwt).param("page","1"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.items.length()").value(4));
    }

    @Test
    void privatePagesRequireAuthenticationAndKeepWalletOwnership() throws Exception {
        long owner = members.saveAndFlush(new Member("page-wallet-owner", "#123456")).getId();
        long other = members.saveAndFlush(new Member("page-wallet-other", "#123456")).getId();
        Timestamp time = Timestamp.from(Instant.now());
        for (int i = 0; i < 21; i++) {
            jdbc.update("INSERT INTO wallets(member_id,chain_type,address,created_at) VALUES(?,'EVM',?,?)",
                owner, String.format("0x%040x", i + 9000), time);
        }
        jdbc.update("INSERT INTO member_follows(follower_id,following_id,created_at) VALUES(?,?,?)", owner, other, time);
        for (String path : new String[] {"/api/v1/me/wallets/page", "/api/v1/me/exchanges/page", "/api/v1/me/bookmarks/page"}) {
            mvc.perform(get(path)).andExpect(status().isUnauthorized());
        }
        var ownJwt = org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt()
            .jwt(token -> token.subject(Long.toString(owner)));
        var otherJwt = org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt()
            .jwt(token -> token.subject(Long.toString(other)));
        mvc.perform(get("/api/v1/me/wallets/page").with(ownJwt))
            .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(21));
        mvc.perform(get("/api/v1/me/wallets/page").with(otherJwt))
            .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(0));
        mvc.perform(get("/api/v1/me/exchanges/page").with(ownJwt)).andExpect(status().isOk());
        mvc.perform(get("/api/v1/me/bookmarks/page").with(ownJwt)).andExpect(status().isOk());
        mvc.perform(get("/api/v1/members/{id}/followers/page", other))
            .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(1));
        mvc.perform(get("/api/v1/members/{id}/following/page", owner))
            .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(1));
    }

    @Test
    void validatesBoundsAndPagesOnlyActiveRooms() throws Exception {
        mvc.perform(get("/api/v1/coins/page"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.size").value(20))
            .andExpect(jsonPath("$.totalElements").value(20));
        jdbc.update("UPDATE coins SET active=FALSE WHERE symbol='BTC'");
        mvc.perform(get("/api/v1/coins/page").param("size", "5"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(19))
            .andExpect(jsonPath("$.totalPages").value(4));
        for (String page : new String[] {"-1", "2147483647"}) {
            mvc.perform(get("/api/v1/posts/page").param("page", page)).andExpect(status().isBadRequest());
        }
        for (String size : new String[] {"0", "101"}) {
            mvc.perform(get("/api/v1/coins/page").param("size", size)).andExpect(status().isBadRequest());
        }
        mvc.perform(get("/api/v1/communities/MISSING/posts/page")).andExpect(status().isNotFound());
        mvc.perform(get("/api/v1/posts/999999/comments/page")).andExpect(status().isNotFound());
    }
}
