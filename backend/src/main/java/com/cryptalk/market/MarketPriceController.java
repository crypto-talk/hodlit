package com.cryptalk.market;

import com.cryptalk.coin.Coin;
import com.cryptalk.coin.CoinRepository;
import com.cryptalk.common.ApiException;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/market/prices")
@Tag(name = "실시간 시세", description = "외부 시세 공급자가 제공하는 코인 가격과 24시간 등락률 API")
public class MarketPriceController {
    private final CoinRepository coins;
    private final MarketPriceService prices;

    public MarketPriceController(CoinRepository coins, MarketPriceService prices) {
        this.coins = coins; this.prices = prices;
    }

    @Operation(summary = "전체 코인 실시간 시세 조회", description = "모든 활성 코인의 현재 가격과 24시간 등락률을 지정 통화로 반환합니다.")
    @GetMapping
    List<MarketPriceService.PriceQuote> current(@RequestParam(defaultValue = "KRW") String currency) {
        return prices.currentPrices(coins.findByActiveTrueOrderByDisplayOrder(), currency);
    }

    @Operation(summary = "코인 실시간 시세 조회", description = "코인 심볼에 해당하는 현재 가격과 24시간 등락률을 지정 통화로 반환합니다.")
    @GetMapping("/{symbol}")
    MarketPriceService.PriceQuote current(@PathVariable String symbol,
                                           @RequestParam(defaultValue = "USD") String currency) {
        Coin coin = coins.findBySymbolIgnoreCaseAndActiveTrue(symbol)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "코인 커뮤니티를 찾을 수 없습니다."));
        return prices.currentPrice(coin, currency);
    }
}
