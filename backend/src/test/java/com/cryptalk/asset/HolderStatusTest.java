package com.cryptalk.asset;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.cryptalk.coin.Coin;
import com.cryptalk.coin.VerificationAvailability;
import com.cryptalk.comment.Comment;
import com.cryptalk.comment.CommentHolderSnapshot;
import com.cryptalk.member.Member;
import com.cryptalk.post.Post;
import com.cryptalk.post.PostHolderSnapshot;
import java.math.BigDecimal;
import org.junit.jupiter.api.Test;

class HolderStatusTest {
    @Test
    void postAndCommentSnapshotsFreezeTheExplicitFourStateStatus() {
        Coin coin = mock(Coin.class);
        when(coin.getVerificationAvailability()).thenReturn(VerificationAvailability.SUPPORTED);
        when(coin.getSymbol()).thenReturn("ETH");
        Post post = mock(Post.class);
        when(post.getCoin()).thenReturn(coin);
        Comment comment = mock(Comment.class);
        when(comment.getPost()).thenReturn(post);
        assertEquals("NOT_CONNECTED", new PostHolderSnapshot(post, null).getHolderStatus());
        assertEquals("NOT_CONNECTED", new CommentHolderSnapshot(comment, null).getHolderStatus());
        AssetSnapshot asset = new AssetSnapshot(mock(Member.class), coin);
        asset.capture(BigDecimal.ONE, BigDecimal.ONE, true, "VERIFIED", 1);
        var earlier = new PostHolderSnapshot(post, asset);
        assertEquals("HOLDER", earlier.getHolderStatus());
        asset.capture(BigDecimal.ZERO, BigDecimal.ZERO, false, "VERIFIED", 1);
        assertEquals("EMPTY", new PostHolderSnapshot(post, asset).getHolderStatus());
        assertEquals("EMPTY", new CommentHolderSnapshot(comment, asset).getHolderStatus());
        asset.capture(BigDecimal.ZERO, BigDecimal.ZERO, false, "RPC_ERROR", 1);
        assertEquals("UNKNOWN", new PostHolderSnapshot(post, asset).getHolderStatus());
        assertEquals("UNKNOWN", new CommentHolderSnapshot(comment, asset).getHolderStatus());
        assertEquals("HOLDER", earlier.getHolderStatus());
    }
}
