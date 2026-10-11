package com.cryptalk.search;

import com.cryptalk.coin.CoinRepository;
import com.cryptalk.common.ApiException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class RoomSearchService {
    private final NamedParameterJdbcTemplate jdbc;
    private final CoinRepository coins;
    public RoomSearchService(NamedParameterJdbcTemplate jdbc, CoinRepository coins) { this.jdbc = jdbc; this.coins = coins; }

    private static final String ROWS = """
        SELECT 'POST' AS item_type, p.id, p.title AS label, p.content AS excerpt,
               m.nickname AS author_nickname, c.symbol AS room_symbol, p.id AS post_id, p.created_at,
               (CASE WHEN LOWER(p.title) LIKE :pattern ESCAPE '!' THEN 3 ELSE 0 END
                + CASE WHEN LOWER(p.content) LIKE :pattern ESCAPE '!' THEN 1 ELSE 0 END
                + CASE WHEN LOWER(m.nickname) LIKE :pattern ESCAPE '!' THEN 2 ELSE 0 END) AS relevance
        FROM posts p JOIN members m ON m.id=p.member_id JOIN coins c ON c.id=p.coin_id
        WHERE c.active=TRUE AND c.id=:coinId AND (LOWER(p.title) LIKE :pattern ESCAPE '!'
              OR LOWER(p.content) LIKE :pattern ESCAPE '!' OR LOWER(m.nickname) LIKE :pattern ESCAPE '!')
        UNION ALL
        SELECT 'COMMENT', cm.id, p.title, cm.content, m.nickname, c.symbol, p.id, cm.created_at,
               (CASE WHEN LOWER(cm.content) LIKE :pattern ESCAPE '!' THEN 1 ELSE 0 END
                + CASE WHEN LOWER(m.nickname) LIKE :pattern ESCAPE '!' THEN 2 ELSE 0 END)
        FROM comments cm JOIN posts p ON p.id=cm.post_id JOIN members m ON m.id=cm.member_id
             JOIN coins c ON c.id=p.coin_id
        WHERE c.active=TRUE AND c.id=:coinId AND (LOWER(cm.content) LIKE :pattern ESCAPE '!'
              OR LOWER(m.nickname) LIKE :pattern ESCAPE '!')
        """;

    @Transactional(readOnly = true)
    public SearchPage search(String symbol, String query, int page, int size) {
        String q = query == null ? "" : query.strip();
        if (q.isEmpty() || q.length() > 100 || page < 0 || size < 1 || size > 100
                || (long) page * size > Integer.MAX_VALUE) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "검색어는 1~100자, page는 0 이상, size는 1~100이어야 합니다.");
        }
        var coin = coins.findBySymbolIgnoreCaseAndActiveTrue(symbol)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "코인 커뮤니티를 찾을 수 없습니다."));
        String escaped = q.toLowerCase(Locale.ROOT).replace("!", "!!").replace("%", "!%").replace("_", "!_");
        Map<String, Object> parameters = Map.of("coinId", coin.getId(), "pattern", "%" + escaped + "%", "size", size, "offset", (long) page * size);
        long total = jdbc.queryForObject("SELECT COUNT(*) FROM (" + ROWS + ") matched", parameters, Long.class);
        var items = jdbc.query("SELECT * FROM (" + ROWS + ") matched ORDER BY relevance DESC, created_at DESC, item_type ASC, id DESC LIMIT :size OFFSET :offset",
            parameters, (rs, row) -> {
                Timestamp createdAt = rs.getTimestamp("created_at");
                String text = rs.getString("excerpt");
                String snippet = text.codePointCount(0, text.length()) > 200 ? text.substring(0, text.offsetByCodePoints(0, 200)) : text;
                return new SearchItem(rs.getString("item_type"), rs.getLong("id"), rs.getString("label"), snippet,
                    rs.getString("author_nickname"), rs.getString("room_symbol"), rs.getLong("post_id"),
                    createdAt.toInstant(), rs.getInt("relevance"));
            });
        return new SearchPage(items, page, size, total, (int) ((total + size - 1) / size),
            ((long) page + 1) * size < total, page > 0);
    }

    public record SearchItem(String type, long id, String label, String excerpt, String authorNickname,
                             String roomSymbol, Long postId, Instant createdAt, int relevance) {}
    public record SearchPage(List<SearchItem> items, int page, int size, long totalElements, int totalPages,
                             boolean hasNext, boolean hasPrevious) {}
}
