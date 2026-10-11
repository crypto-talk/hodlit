package com.cryptalk.coin;

import com.cryptalk.common.ApiException;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CommunityStatisticsService {
    private final NamedParameterJdbcTemplate jdbc;
    private final Clock clock;

    public CommunityStatisticsService(NamedParameterJdbcTemplate jdbc,
                                      @Qualifier("communityStatisticsClock") Clock clock) {
        this.jdbc = jdbc;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public StatisticsResponse statistics(String window, String symbol) {
        String normalized = window == null ? "24h" : window.trim().toLowerCase(Locale.ROOT);
        if (!List.of("24h", "all").contains(normalized)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "집계 기간은 24h 또는 all이어야 합니다.");
        }
        Instant until = clock.instant();
        Instant from = normalized.equals("all") ? Instant.EPOCH : until.minus(Duration.ofHours(24));
        var parameters = new HashMap<String, Object>();
        parameters.put("from", Timestamp.from(from));
        parameters.put("until", Timestamp.from(until));
        parameters.put("freshAfter", Timestamp.from(until.minus(Duration.ofHours(1))));
        parameters.put("sixHoursAgo", Timestamp.from(until.minus(Duration.ofHours(6))));
        parameters.put("hotFrom", Timestamp.from(until.minus(Duration.ofHours(24))));
        parameters.put("hotOnly", symbol == null && normalized.equals("24h"));
        parameters.put("symbol", symbol == null ? null : symbol.trim().toUpperCase(Locale.ROOT));
        // UNION is required for a distinct participant across different activity types; JPQL cannot express it.
        List<RoomStatistics> rooms = jdbc.query(SQL, parameters, (row, index) -> {
            long participants = row.getLong("participants");
            long verified = row.getLong("verified_participants");
            double rate = participants == 0 ? 0 : 100.0 * verified / participants;
            Timestamp lastActivity = row.getTimestamp("last_activity");
            return new RoomStatistics(row.getString("symbol"), row.getLong("posts"), row.getLong("comments"),
                row.getLong("views"), row.getLong("likes"), participants, verified, rate,
                row.getLong("hot_score"), row.getLong("active_participants"),
                lastActivity == null ? null : lastActivity.toInstant());
        });
        if (symbol != null && rooms.isEmpty()) {
            throw new ApiException(HttpStatus.NOT_FOUND, "코인 커뮤니티를 찾을 수 없습니다.");
        }
        return new StatisticsResponse(normalized, from, until, rooms);
    }

    public record StatisticsResponse(String window, Instant from, Instant until, List<RoomStatistics> rooms) {}
    public record RoomStatistics(String symbol, long postCount, long commentCount, long viewCount, long likeCount,
                                 long participantCount, long verifiedParticipantCount, double verifiedParticipantRate,
                                 long hotScore, long activeParticipantCount, Instant lastActivityAt) {}

    private static final String SQL = """
        WITH activity AS (
            SELECT p.coin_id, p.member_id, 'POST' AS kind, p.created_at AS occurred_at FROM posts p
            WHERE p.created_at >= :from AND p.created_at < :until
            UNION ALL
            SELECT p.coin_id, c.member_id, 'COMMENT' AS kind, c.created_at AS occurred_at FROM comments c
            JOIN posts p ON p.id = c.post_id WHERE c.created_at >= :from AND c.created_at < :until
            UNION ALL
            SELECT p.coin_id, l.member_id, 'LIKE' AS kind, l.created_at AS occurred_at FROM post_likes l
            JOIN posts p ON p.id = l.post_id WHERE l.created_at >= :from AND l.created_at < :until
            UNION ALL
            SELECT p.coin_id, v.member_id, 'VIEW' AS kind, v.created_at AS occurred_at FROM post_view_events v
            JOIN posts p ON p.id = v.post_id WHERE v.created_at >= :from AND v.created_at < :until
        ), active_members AS (
            SELECT coin_id, member_id, MAX(occurred_at) AS last_activity
            FROM activity
            WHERE kind <> 'VIEW' AND member_id IS NOT NULL AND occurred_at >= :hotFrom
            GROUP BY coin_id, member_id
        ), hot_rooms AS (
            SELECT coin_id,
                SUM(CASE WHEN last_activity >= :freshAfter THEN 3
                         WHEN last_activity >= :sixHoursAgo THEN 2 ELSE 1 END) AS hot_score,
                COUNT(*) AS active_participants, MAX(last_activity) AS last_activity
            FROM active_members GROUP BY coin_id
        ), totals AS (
        SELECT c.id, c.symbol, c.display_order,
            SUM(CASE WHEN a.kind = 'POST' THEN 1 ELSE 0 END) AS posts,
            SUM(CASE WHEN a.kind = 'COMMENT' THEN 1 ELSE 0 END) AS comments,
            SUM(CASE WHEN a.kind = 'VIEW' THEN 1 ELSE 0 END) AS views,
            SUM(CASE WHEN a.kind = 'LIKE' THEN 1 ELSE 0 END) AS likes,
            COUNT(DISTINCT a.member_id) AS participants,
            COUNT(DISTINCT CASE WHEN s.verified = TRUE AND s.verification_status = 'VERIFIED'
                AND s.wallet_count > 0 AND s.captured_at >= :freshAfter AND s.captured_at < :until
                AND EXISTS (SELECT 1 FROM wallets w WHERE w.member_id = a.member_id)
                THEN a.member_id ELSE NULL END) AS verified_participants
        FROM coins c LEFT JOIN activity a ON a.coin_id = c.id
        LEFT JOIN asset_snapshots s ON s.coin_id = c.id AND s.member_id = a.member_id
        WHERE c.active = TRUE AND (:symbol IS NULL OR c.symbol = :symbol)
        GROUP BY c.id, c.symbol, c.display_order
        )
        SELECT t.*, COALESCE(h.hot_score, 0) AS hot_score,
            COALESCE(h.active_participants, 0) AS active_participants, h.last_activity
        FROM totals t LEFT JOIN hot_rooms h ON h.coin_id = t.id
        WHERE :hotOnly = FALSE OR COALESCE(h.hot_score, 0) > 0
        ORDER BY CASE WHEN :hotOnly = TRUE THEN h.hot_score END DESC,
                 CASE WHEN :hotOnly = TRUE THEN h.active_participants END DESC,
                 CASE WHEN :hotOnly = TRUE THEN h.last_activity END DESC,
                 t.display_order, t.id
        """;
}
