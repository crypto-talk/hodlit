package com.cryptalk;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.doAnswer;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.cryptalk.banner.BannerService;
import com.cryptalk.coin.Coin;
import com.cryptalk.coin.CoinRepository;
import com.cryptalk.coin.RoomOperationStatus;
import com.cryptalk.media.MediaService;
import com.cryptalk.post.Post;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.Map;
import java.util.concurrent.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

@SpringBootTest(properties = "spring.datasource.hikari.transaction-isolation=TRANSACTION_REPEATABLE_READ")
@AutoConfigureMockMvc
class MediaReferenceIsolationTest {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired ObjectMapper json;
    @Autowired BannerService banners;
    @Autowired CoinRepository coins;
    @Autowired PlatformTransactionManager transactions;
    @MockitoSpyBean MediaService media;

    @Test
    void waitingPublicationSeesBannerCommittedAfterItsEarlierMemberReads() throws Exception {
        long actor = 900000L;
        String file = "00000000-0000-0000-0000-000000000009.png";
        String image = "/api/v1/media/" + file;
        jdbc.update("INSERT INTO members(id,role,nickname,avatar_color,asset_visibility,created_at,updated_at) VALUES(?,'ADMIN','media-isolation','#123456','EXACT',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)", actor);
        jdbc.update("INSERT INTO media_assets(file_name,member_id,media_type,content_type,size_bytes,created_at) VALUES(?,?,'IMAGE','image/png',100,CURRENT_TIMESTAMP)", file, actor);
        var coin = new Coin("LOCKTEST", "Lock test", 100, null);
        coin.changeOperationStatus(RoomOperationStatus.OPEN);
        coins.saveAndFlush(coin);
        var bannerSaved = new CountDownLatch(1);
        var allowCommit = new CountDownLatch(1);
        var claimEntered = new CountDownLatch(1);
        var pool = Executors.newFixedThreadPool(2);
        try {
            doAnswer(invocation -> {
                claimEntered.countDown();
                return invocation.callRealMethod();
            }).when(media).claim(eq(actor), any(Post.class), eq(image), anyBoolean());

            Future<?> banner = pool.submit(() -> new TransactionTemplate(transactions).execute(status -> {
                banners.save(actor, null, new BannerService.SaveRequest("Banner", image, "Image", null, true, 0));
                bannerSaved.countDown();
                try {
                    if (!allowCommit.await(15, TimeUnit.SECONDS)) throw new IllegalStateException("Publication did not enter claim");
                } catch (InterruptedException exception) {
                    Thread.currentThread().interrupt();
                    throw new IllegalStateException(exception);
                }
                return null;
            }));
            assertThat(bannerSaved.await(15, TimeUnit.SECONDS)).isTrue();
            String body = json.writeValueAsString(Map.of("coinSymbol", "LOCKTEST", "title", "Post", "content", "Body",
                "media", List.of(Map.of("type", "IMAGE", "url", image))));
            Future<?> publication = pool.submit(() -> {
                mvc.perform(post("/api/v1/posts").with(jwt().jwt(t -> t.subject(Long.toString(actor))))
                    .contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isConflict());
                return null;
            });
            assertThat(claimEntered.await(15, TimeUnit.SECONDS)).isTrue();
            allowCommit.countDown();
            banner.get(15, TimeUnit.SECONDS);
            publication.get(15, TimeUnit.SECONDS);
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM posts WHERE member_id=?", Long.class, actor)).isZero();
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM banners WHERE image_url=?", Long.class, image)).isEqualTo(1);
        } finally {
            allowCommit.countDown();
            pool.shutdownNow();
            pool.awaitTermination(15, TimeUnit.SECONDS);
            jdbc.update("DELETE FROM banners WHERE image_url=?", image);
            jdbc.update("DELETE FROM media_assets WHERE file_name=?", file);
            jdbc.update("DELETE FROM posts WHERE member_id=?", actor);
            jdbc.update("DELETE FROM coins WHERE id=?", coin.getId());
            jdbc.update("DELETE FROM members WHERE id=?", actor);
        }
    }
}
