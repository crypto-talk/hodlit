package com.cryptalk.search;

import com.cryptalk.coin.CoinRepository;
import com.cryptalk.common.ApiException;
import com.cryptalk.common.PageResponse;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class RoomSearchService {
    private final SearchService search;
    private final CoinRepository coins;

    public RoomSearchService(SearchService search, CoinRepository coins) {
        this.search = search;
        this.coins = coins;
    }

    @Transactional(readOnly = true)
    public PageResponse<SearchService.SearchItem> search(String symbol, String query, int page, int size) {
        String q = SearchService.validate(query, page, size);
        var coin = coins.findBySymbolIgnoreCaseAndActiveTrue(symbol)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "코인 커뮤니티를 찾을 수 없습니다."));
        return search.search(q, page, size, coin.getId());
    }
}
