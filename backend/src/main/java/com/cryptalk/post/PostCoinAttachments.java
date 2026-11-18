package com.cryptalk.post;

import com.cryptalk.coin.Coin;
import com.cryptalk.coin.CoinRepository;
import com.cryptalk.coin.VerificationAvailability;
import com.cryptalk.common.ApiException;
import com.cryptalk.member.AssetPublicationService;
import com.cryptalk.member.AssetVisibility;
import com.cryptalk.post.PostDtos.AttachedCoinSnapshotResponse;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

@Component
public class PostCoinAttachments {
    public static final int MAX_SELECTIONS = 3;
    public static final String COIN_SYMBOL_PATTERN = "[A-Za-z0-9]{2,20}";

    private final CoinRepository coins;
    private final PostCoinSnapshotRepository snapshots;
    private final AssetPublicationService publication;

    public PostCoinAttachments(CoinRepository coins, PostCoinSnapshotRepository snapshots,
                               AssetPublicationService publication) {
        this.coins = coins;
        this.snapshots = snapshots;
        this.publication = publication;
    }

    List<Coin> selectExtraCoins(Coin room, List<String> symbols) {
        if (symbols == null) return List.of();
        var selected = new ArrayList<Coin>();
        var seen = new HashSet<String>();
        for (String symbol : symbols) {
            if (!seen.add(symbol.toUpperCase(Locale.ROOT))) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "첨부 코인은 중복할 수 없습니다.");
            }
            if (symbol.equalsIgnoreCase(room.getSymbol()) && !room.isGeneralRoom()) continue;
            Coin coin = coins.findBySymbolIgnoreCaseAndActiveTrue(symbol)
                .filter(candidate -> !candidate.isGeneralRoom()
                    && candidate.getVerificationAvailability() == VerificationAvailability.SUPPORTED)
                .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, "보유 인증을 지원하는 활성 코인만 첨부할 수 있습니다."));
            selected.add(coin);
        }
        return selected;
    }

    public List<AttachedCoinSnapshotResponse> visibleSnapshots(Post post, PostHolderSnapshot roomSnapshot) {
        if (post.getMember().getAssetVisibility() == AssetVisibility.HIDDEN) return List.of();
        Long memberId = post.getMember().getId();
        var results = new ArrayList<AttachedCoinSnapshotResponse>();
        if (roomSnapshot != null && !post.getCoin().isGeneralRoom()
                && publication.visible(memberId, post.getCoin().getId())) {
            results.add(response(roomSnapshot));
        }
        for (PostCoinSnapshot snapshot : snapshots.findByPostIdOrderByDisplayOrder(post.getId())) {
            if (publication.visible(memberId, snapshot.getCoin().getId())) results.add(response(snapshot));
        }
        return results;
    }

    private AttachedCoinSnapshotResponse response(PostHoldingSnapshot snapshot) {
        return new AttachedCoinSnapshotResponse(snapshot.getCoin().getSymbol(), snapshot.getVerificationAvailability(),
            snapshot.getHolderStatus(), snapshot.isVerifiedHolder(), snapshot.getQuantityBand(),
            snapshot.getHoldingMonths(), snapshot.getBadge(), snapshot.getVerificationLevel(),
            snapshot.getSyncStatus(), snapshot.getCapturedAt());
    }
}
