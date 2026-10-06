package com.cryptalk.draft;

import com.cryptalk.common.ApiException;
import com.cryptalk.draft.DraftDtos.*;
import com.cryptalk.media.MediaService;
import com.cryptalk.member.Member;
import com.cryptalk.member.MemberRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class DraftService {
    private final DraftRepository drafts;
    private final MemberRepository members;
    private final MediaService media;
    private final ObjectMapper json;

    public DraftService(DraftRepository drafts, MemberRepository members, MediaService media, ObjectMapper json) {
        this.drafts = drafts;
        this.members = members;
        this.media = media;
        this.json = json;
    }

    @Transactional(readOnly = true)
    public List<DraftResponse> list(Long memberId) {
        return drafts.findByMemberIdOrderByUpdatedAtDescIdDesc(memberId).stream().map(this::response).toList();
    }

    @Transactional(readOnly = true)
    public DraftResponse get(Long memberId, Long id) { return response(owned(memberId, id)); }

    @Transactional
    public DraftResponse create(Long memberId, SaveDraftRequest request) {
        Member member = lockMember(memberId);
        if (drafts.countByMemberId(memberId) >= 10)
            throw new ApiException(HttpStatus.CONFLICT, "임시저장은 회원당 10개까지 가능합니다.");
        Draft draft = drafts.save(new Draft(member, encode(request)));
        media.replaceDraftMedia(memberId, draft.getId(), mediaUrls(request));
        return response(draft);
    }

    @Transactional
    public DraftResponse update(Long memberId, Long id, SaveDraftRequest request) {
        lockMember(memberId);
        Draft draft = owned(memberId, id);
        media.replaceDraftMedia(memberId, id, mediaUrls(request));
        draft.update(encode(request));
        return response(draft);
    }

    @Transactional
    public void delete(Long memberId, Long id) {
        lockMember(memberId);
        Draft draft = owned(memberId, id);
        media.replaceDraftMedia(memberId, id, List.of());
        drafts.delete(draft);
    }

    private Member lockMember(Long id) {
        return members.lockById(id).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "회원을 찾을 수 없습니다."));
    }

    private Draft owned(Long memberId, Long id) {
        Draft draft = drafts.findById(id).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "임시저장을 찾을 수 없습니다."));
        if (!draft.getMember().getId().equals(memberId))
            throw new ApiException(HttpStatus.FORBIDDEN, "본인의 임시저장만 접근할 수 있습니다.");
        return draft;
    }

    private List<String> mediaUrls(SaveDraftRequest request) {
        List<String> urls = new ArrayList<>();
        Set<String> primary = new HashSet<>();
        if (request.media() != null) for (var item : request.media()) {
            if (item.type() == null || !primary.add(item.url()))
                throw new ApiException(HttpStatus.BAD_REQUEST, "미디어 형식이 필요하며 중복 미디어는 허용하지 않습니다.");
            urls.add(item.url());
            if (item.thumbnailUrl() != null) urls.add(item.thumbnailUrl());
        }
        return urls;
    }

    private String encode(SaveDraftRequest request) {
        try { return json.writeValueAsString(request); }
        catch (JsonProcessingException exception) { throw new IllegalStateException("Cannot encode draft", exception); }
    }

    private DraftResponse response(Draft draft) {
        try {
            SaveDraftRequest data = json.readValue(draft.getPayload(), SaveDraftRequest.class);
            return new DraftResponse(draft.getId(), draft.getUpdatedAt(), data.coinSymbol(), data.title(), data.content(),
                data.media(), data.tradingViewSymbol(), data.tradingViewInterval(), data.tradingViewAnalysis(),
                data.assetPrice(), data.assetPriceCurrency(), data.youtubeUrl());
        } catch (JsonProcessingException exception) { throw new IllegalStateException("Cannot decode draft", exception); }
    }
}
