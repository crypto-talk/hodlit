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
    @Operation(summary = "전체 방 활동 집계", description = "24h(기본)는 지금 뜨는 방을 hotScore·활동 회원 수·마지막 활동 시각 순으로 반환하고 활동이 없는 방을 제외합니다. 회원별 마지막 글·댓글·좋아요 활동에 1시간 이내 3점, 6시간 이내 2점, 나머지 24시간 1점을 부여합니다. 조회수·인증률은 점수에 포함하지 않습니다. all은 모든 활성 방의 누적 통계를 기존 방 순서로 반환합니다.")
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
    @Operation(summary = "방 목록 페이지 조회", description = "활성 코인 방만 표시 순서·ID 순으로 조회합니다. page 0부터, size 기본 20.")
    @GetMapping("/coins/page")
    com.cryptalk.common.PageResponse<CoinResponse> coinPage(@RequestParam(defaultValue="0") int page,
                                                          @RequestParam(defaultValue="20") int size) {
        var request = com.cryptalk.common.PageResponse.request(page, size,
            org.springframework.data.domain.Sort.by("displayOrder", "id"));
        return com.cryptalk.common.PageResponse.of(coins.findByActiveTrue(request).map(this::response));
    }
    @Operation(summary = "코인 커뮤니티 정보 조회", description = "코인 기본 정보, 게시글 수와 커뮤니티 설명을 반환합니다.")
    @GetMapping("/communities/{symbol}")
    CommunityResponse community(@PathVariable String symbol) {
        Coin coin = coins.findBySymbolIgnoreCaseAndActiveTrue(symbol).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "코인 커뮤니티를 찾을 수 없습니다."));
        long postCount = coin.getOperationStatus() == RoomOperationStatus.OPEN ? posts.countByCoinId(coin.getId()) : 0;
        return new CommunityResponse(response(coin), postCount, coin.getName() + " 홀더와 투자자가 정보를 나누는 공간입니다.");
    }
    private CoinResponse response(Coin coin) {
        return new CoinResponse(coin.getId(), coin.getSymbol(), coin.getName(), coin.getChainType(), coin.getAccentColor(),
            coin.getVerificationAvailability().name(), coin.getChainId(), coin.getAssetType(), coin.getOperationStatus());
    }
    public record CoinResponse(Long id, String symbol, String name, String chainType, String accentColor,
                               String verificationAvailability, Long chainId, String assetType, RoomOperationStatus operationStatus) {}
    public record CommunityResponse(CoinResponse coin, long postCount, String description) {}
}
