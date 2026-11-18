package com.cryptalk.coin;

import com.cryptalk.admin.AdminAccess;
import com.cryptalk.common.ApiException;
import com.cryptalk.common.PageResponse;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class RoomAdminService {
    private final CoinRepository coins;
    private final AdminAccess admins;
    private final org.springframework.jdbc.core.JdbcTemplate jdbc;

    public RoomAdminService(CoinRepository coins, AdminAccess admins, org.springframework.jdbc.core.JdbcTemplate jdbc) {
        this.coins = coins;
        this.admins = admins;
        this.jdbc = jdbc;
    }

    @Transactional(readOnly = true)
    public PageResponse<RoomResponse> list(Long memberId, String query, String status, int page, int size) {
        admins.requireAdmin(memberId);
        String q = query == null ? "" : query.strip().toLowerCase(java.util.Locale.ROOT);
        if (q.length() > 100) throw new ApiException(HttpStatus.BAD_REQUEST, "검색어는 100자 이하여야 합니다.");
        RoomOperationStatus filter = status == null ? null : parseStatus(status);
        String pattern = "%" + q.replace("!", "!!").replace("%", "!%").replace("_", "!_") + "%";
        var pageable = PageResponse.request(page, size, Sort.by("displayOrder", "id"));
        return PageResponse.of(coins.adminRooms(pattern, filter, pageable).map(this::response));
    }

    @Transactional
    public RoomResponse changeStatus(Long memberId, String symbol, String status) {
        admins.requireAdmin(memberId);
        RoomOperationStatus target = parseStatus(status);
        Coin coin = coins.lockBySymbol(symbol)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "코인 커뮤니티를 찾을 수 없습니다."));
        String previous = coin.getOperationStatus().name();
        coin.changeOperationStatus(target);
        jdbc.update("INSERT INTO moderation_logs(actor_id,target_type,target_id,before_state,after_state,reason,created_at) VALUES(?,?,?,?,?,?,?)",
            memberId, "rooms", coin.getId(), previous, target.name(), "방 운영 상태 변경", java.sql.Timestamp.from(java.time.Instant.now()));
        coins.flush();
        return response(coin);
    }

    private RoomOperationStatus parseStatus(String value) {
        try { return RoomOperationStatus.valueOf(value); }
        catch (IllegalArgumentException | NullPointerException exception) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "operationStatus는 OPEN 또는 CLOSE여야 합니다.");
        }
    }

    private RoomResponse response(Coin coin) {
        return new RoomResponse(coin.getId(), coin.getSymbol(), coin.getName(), coin.isActive(), coin.getOperationStatus(), coin.getDisplayOrder(), coin.getCategoryId());
    }

    public record RoomResponse(Long id, String symbol, String name, boolean active, RoomOperationStatus operationStatus, int displayOrder, Long categoryId) {}
}
