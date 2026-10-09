package com.cryptalk.post;

import com.cryptalk.common.ApiException;
import com.cryptalk.common.PageResponse;
import com.cryptalk.member.MemberRepository;
import java.util.Map;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class NumberedFeedService {
    private final NamedParameterJdbcTemplate jdbc;
    private final PostService posts;
    private final MemberRepository members;

    public NumberedFeedService(NamedParameterJdbcTemplate jdbc, PostService posts, MemberRepository members) {
        this.jdbc = jdbc;
        this.posts = posts;
        this.members = members;
    }

    @Transactional(readOnly=true)
    public PageResponse<PostDtos.FeedItemResponse> page(Long viewerId, boolean following, int page, int size) {
        PageResponse.request(page,size,Sort.unsorted());
        if (following && (viewerId == null || !members.existsById(viewerId)))
            throw new ApiException(HttpStatus.NOT_FOUND,"회원을 찾을 수 없습니다.");
        String postScope = following ? " AND p.member_id IN (SELECT following_id FROM member_follows WHERE follower_id=:viewer)" : "";
        String repostScope = following ? " AND r.member_id IN (SELECT following_id FROM member_follows WHERE follower_id=:viewer)" : "";
        // Cross-entity UNION is needed to offset/count the combined activity stream, not each half independently.
        String rows = """
            SELECT 'POST' AS event_type, 0 AS type_rank, p.id AS post_id, p.created_at AS occurred_at,
                   m.id AS actor_id, m.nickname AS actor_nickname, m.avatar_color AS actor_color
            FROM posts p JOIN members m ON m.id=p.member_id JOIN coins c ON c.id=p.coin_id
            WHERE c.active=TRUE
            """ + postScope + " UNION ALL " + """
            SELECT 'REPOST', 1, p.id, r.created_at, m.id, m.nickname, m.avatar_color
            FROM post_reposts r JOIN posts p ON p.id=r.post_id JOIN members m ON m.id=r.member_id
                 JOIN coins c ON c.id=p.coin_id WHERE c.active=TRUE
            """ + repostScope;
        Map<String,Object> parameters = Map.of("viewer",viewerId == null ? 0L : viewerId,"size",size,"offset",(long)page*size);
        long total = jdbc.queryForObject("SELECT COUNT(*) FROM ("+rows+") feed",parameters,Long.class);
        var items = jdbc.query("SELECT * FROM ("+rows+") feed ORDER BY occurred_at DESC,type_rank DESC,post_id DESC,actor_id DESC LIMIT :size OFFSET :offset",
            parameters,(rs,index) -> new PostDtos.FeedItemResponse(rs.getString("event_type"),rs.getTimestamp("occurred_at").toInstant(),
                new PostDtos.AuthorResponse(rs.getLong("actor_id"),rs.getString("actor_nickname"),rs.getString("actor_color")),
                posts.pageItem(rs.getLong("post_id"),viewerId)));
        return new PageResponse<>(items,page,size,total,(int)((total+size-1)/size),((long)page+1)*size<total,page>0);
    }
}
