package com.cryptalk.news;

import com.cryptalk.coin.RoomAccess;
import com.cryptalk.admin.AdminAccess;
import com.cryptalk.coin.CoinRepository;
import com.cryptalk.common.ApiException;
import java.net.URI;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class NewsService {
    private final RoomAccess rooms;
    private final NewsRepository news;
    private final CoinRepository coins;
    private final AdminAccess admins;
    public NewsService(NewsRepository news, CoinRepository coins, AdminAccess admins, RoomAccess rooms) {
        this.rooms = rooms;
        this.news = news;
        this.coins = coins;
        this.admins = admins;
    }

    @Transactional(readOnly=true)
    public com.cryptalk.common.PageResponse<NewsDtos.NewsResponse> list(String symbol, int page, int size) {
        var request = com.cryptalk.common.PageResponse.request(page, size, Sort.by(Sort.Direction.DESC,"createdAt","id"));
        var coin = coins.findBySymbolIgnoreCaseAndActiveTrue(symbol)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "코인 방을 찾을 수 없습니다."));
        rooms.requireOpen(coin);
        var rows = news.findByCoinId(coin.getId(), request);
        return com.cryptalk.common.PageResponse.of(rows.map(this::response));
    }

    @Transactional
    public NewsDtos.NewsResponse create(Long memberId, String symbol, NewsDtos.SaveNewsRequest request) {
        admins.requireAdmin(memberId);
        validateUrl(request.sourceUrl());
        var coin = coins.findBySymbolIgnoreCaseAndActiveTrue(symbol)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "코인 방을 찾을 수 없습니다."));
        return response(news.save(new CommunityNews(coin, request)));
    }

    @Transactional
    public NewsDtos.NewsResponse update(Long memberId, Long id, NewsDtos.SaveNewsRequest request) {
        admins.requireAdmin(memberId);
        validateUrl(request.sourceUrl());
        var item = item(id);
        item.update(request);
        return response(item);
    }

    @Transactional
    public void delete(Long memberId, Long id) {
        admins.requireAdmin(memberId);
        news.delete(item(id));
    }

    private CommunityNews item(Long id) {
        return news.findById(id).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "뉴스를 찾을 수 없습니다."));
    }
    private void validateUrl(String url) {
        try {
            URI uri = URI.create(url.strip());
            if (!("https".equalsIgnoreCase(uri.getScheme()) || "http".equalsIgnoreCase(uri.getScheme()))
                    || uri.getHost() == null || uri.getUserInfo() != null) throw new IllegalArgumentException();
        } catch (IllegalArgumentException error) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "원문 링크는 사용자 정보 없는 HTTP(S) URL이어야 합니다.");
        }
    }
    private NewsDtos.NewsResponse response(CommunityNews item) {
        return new NewsDtos.NewsResponse(item.getId(), item.getCoin().getSymbol(), item.getTitle(), item.getSummary(),
            item.getSourceName(), item.getSourceUrl(), item.getCreatedAt(), item.getUpdatedAt());
    }
}
