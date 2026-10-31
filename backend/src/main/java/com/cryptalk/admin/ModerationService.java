package com.cryptalk.admin;

import com.cryptalk.common.ApiException;
import com.cryptalk.common.PageResponse;
import jakarta.validation.constraints.*;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ModerationService {
    private final NamedParameterJdbcTemplate jdbc;
    @jakarta.persistence.PersistenceContext private jakarta.persistence.EntityManager entityManager;
    private final AdminAccess admins;
    public ModerationService(NamedParameterJdbcTemplate jdbc, AdminAccess admins) { this.jdbc = jdbc; this.admins = admins; }

    @Transactional(readOnly = true)
    public PageResponse<Map<String, Object>> list(Long actor, String type, String q, Boolean state, int page, int size) {
        admins.requireAdmin(actor);
        PageResponse.request(page, size, org.springframework.data.domain.Sort.unsorted());
        if (q.length() > 100) throw bad("검색어는 100자 이하여야 합니다.");
        boolean posts = type.equals("posts");
        String from = posts ? "posts p JOIN members m ON m.id=p.member_id JOIN coins c ON c.id=p.coin_id" : "members m";
        String condition = posts ? "(LOWER(p.title) LIKE :q ESCAPE '!' OR LOWER(m.nickname) LIKE :q ESCAPE '!') AND (:state IS NULL OR p.hidden=:state)"
            : "LOWER(m.nickname) LIKE :q ESCAPE '!' AND (:state IS NULL OR m.suspended=:state)";
        String fields = posts ? "p.id,p.title,p.content,p.hidden,p.created_at,m.nickname,c.symbol"
            : "m.id,m.nickname,m.role,m.suspended,m.created_at";
        var params = new HashMap<String, Object>();
        params.put("q", "%" + q.strip().toLowerCase(Locale.ROOT).replace("!", "!!").replace("%", "!%").replace("_", "!_") + "%");
        params.put("state", state);
        params.put("size", size);
        params.put("offset", (long) page * size);
        long count = jdbc.queryForObject("SELECT COUNT(*) FROM " + from + " WHERE " + condition, params, Long.class);
        var rows = jdbc.queryForList("SELECT " + fields + " FROM " + from + " WHERE " + condition + " ORDER BY "
            + (posts ? "p.id" : "m.id") + " DESC LIMIT :size OFFSET :offset", params);
        return new PageResponse<>(normalize(rows), page, size, count, (int) ((count + size - 1) / size), ((long) page + 1) * size < count, page > 0);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> detail(Long actor, String type, Long id) {
        admins.requireAdmin(actor);
        String sql = type.equals("posts")
            ? "SELECT p.id,p.title,p.content,p.hidden,p.created_at,m.nickname,c.symbol FROM posts p JOIN members m ON m.id=p.member_id JOIN coins c ON c.id=p.coin_id WHERE p.id=:id"
            : "SELECT id,nickname,role,suspended,created_at FROM members WHERE id=:id";
        var rows = jdbc.queryForList(sql, Map.of("id", id));
        if (rows.isEmpty()) throw new ApiException(HttpStatus.NOT_FOUND, "관리 대상을 찾을 수 없습니다.");
        return normalize(rows).getFirst();
    }

    @Transactional
    public Map<String, Object> change(Long actor, String type, Long id, StateRequest request) {
        admins.requireAdmin(actor);
        boolean posts = type.equals("posts");
        String table = posts ? "posts" : "members";
        String field = posts ? "hidden" : "suspended";
        var params = new HashMap<String, Object>();
        params.put("id", id);
        params.put("state", request.enabled());
        var rows = jdbc.queryForList("SELECT " + field + (posts ? "" : ",role") + " FROM " + table + " WHERE id=:id FOR UPDATE", params);
        if (rows.isEmpty()) throw new ApiException(HttpStatus.NOT_FOUND, "관리 대상을 찾을 수 없습니다.");
        if (!posts && request.enabled() && (actor.equals(id) || "ADMIN".equals(rows.getFirst().get("role"))))
            throw new ApiException(HttpStatus.CONFLICT, "관리자 계정은 정지할 수 없습니다.");
        Object before = rows.getFirst().get(field);
        jdbc.update("UPDATE " + table + " SET " + field + "=:state WHERE id=:id", params);
        params.put("actor", actor);
        params.put("kind", type);
        params.put("before", String.valueOf(before));
        params.put("after", request.enabled().toString());
        params.put("reason", request.reason().strip());
        params.put("at", Timestamp.from(Instant.now()));
        jdbc.update("INSERT INTO moderation_logs(actor_id,target_type,target_id,before_state,after_state,reason,created_at) VALUES(:actor,:kind,:id,:before,:after,:reason,:at)", params);
        entityManager.clear();
        return detail(actor, type, id);
    }

    @Transactional(readOnly = true)
    public PageResponse<Map<String, Object>> logs(Long actor, int page, int size) {
        admins.requireAdmin(actor);
        PageResponse.request(page, size, org.springframework.data.domain.Sort.unsorted());
        var params = Map.of("size", size, "offset", (long) page * size);
        long count = jdbc.queryForObject("SELECT COUNT(*) FROM moderation_logs", Map.of(), Long.class);
        var rows = jdbc.queryForList("SELECT id,actor_id,target_type,target_id,before_state,after_state,reason,created_at FROM moderation_logs ORDER BY id DESC LIMIT :size OFFSET :offset", params);
        return new PageResponse<>(normalize(rows), page, size, count, (int) ((count + size - 1) / size), ((long) page + 1) * size < count, page > 0);
    }
    private List<Map<String, Object>> normalize(List<Map<String, Object>> rows) {
        return rows.stream().map(row -> {
            Map<String, Object> normalized = new LinkedHashMap<>();
            row.forEach((key, value) -> normalized.put(key.toLowerCase(Locale.ROOT), value));
            return normalized;
        }).toList();
    }
    private ApiException bad(String message) { return new ApiException(HttpStatus.BAD_REQUEST, message); }
    public record StateRequest(@NotNull Boolean enabled, @NotBlank @Size(max = 500) String reason) {}
}
