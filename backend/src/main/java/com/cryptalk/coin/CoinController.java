package com.cryptalk.coin;

import com.cryptalk.common.ApiException;
import com.cryptalk.post.PostRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1")
@Tag(name = "코인·커뮤니티", description = "지원 코인 목록과 코인별 커뮤니티 정보 API")
public class CoinController {
    private final CoinRepository coins; private final PostRepository posts;
    private final CommunityStatisticsService statistics;
    public CoinController(CoinRepository coins, PostRepository posts, CommunityStatisticsService statistics) {
        this.coins = coins;
        this.posts = posts;
        this.statistics = statistics;
    }
    @Operation(summary = "전체 방 활동 집계", description = "최근 24시간(24h, 기본) 또는 누적(all)의 글·댓글·조회·좋아요·참여자 수를 반환합니다.")
    @GetMapping("/communities/stats")
    CommunityStatisticsService.StatisticsResponse statistics(@RequestParam(defaultValue="24h") String window) {
        return statistics.statistics(window, null);
    }
    @Operation(summary = "방별 활동 집계", description = "지정한 활성 코인 방의 활동 지표 및 참여자 보유 인증률을 반환합니다.")
    @GetMapping("/communities/{symbol}/stats")
    CommunityStatisticsService.StatisticsResponse statistics(@PathVariable String symbol,
                                                            @RequestParam(defaultValue="24h") String window) {
        return statistics.statistics(window, symbol);
    }
    @Operation(summary = "지원 코인 목록 조회", description = "현재 활성화된 코인을 화면 표시 순서대로 반환합니다.")
    @GetMapping("/coins")
    List<CoinResponse> coins() { return coins.findByActiveTrueOrderByDisplayOrder().stream().map(this::response).toList(); }
    @Operation(summary = "코인 커뮤니티 정보 조회", description = "코인 기본 정보, 게시글 수와 커뮤니티 설명을 반환합니다.")
    @GetMapping("/communities/{symbol}")
    CommunityResponse community(@PathVariable String symbol) {
        Coin coin = coins.findBySymbolIgnoreCaseAndActiveTrue(symbol).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "코인 커뮤니티를 찾을 수 없습니다."));
        long postCount = posts.countByCoinId(coin.getId());
        return new CommunityResponse(response(coin), postCount, coin.getName() + " 홀더와 투자자가 정보를 나누는 공간입니다.");
    }
    private CoinResponse response(Coin coin) {
        return new CoinResponse(coin.getId(), coin.getSymbol(), coin.getName(), coin.getChainType(), coin.getAccentColor(),
            coin.getVerificationAvailability().name(), coin.getChainId(), coin.getAssetType());
    }
    public record CoinResponse(Long id, String symbol, String name, String chainType, String accentColor,
                               String verificationAvailability, Long chainId, String assetType) {}
    public record CommunityResponse(CoinResponse coin, long postCount, String description) {}
}
