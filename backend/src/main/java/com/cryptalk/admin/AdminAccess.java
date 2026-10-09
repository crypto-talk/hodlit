package com.cryptalk.admin;

import com.cryptalk.common.ApiException;
import com.cryptalk.member.MemberRepository;
import java.util.Arrays;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class AdminAccess {
    private final Set<Long> allowed;
    private final MemberRepository members;

    public AdminAccess(@Value("${cryptalk.admin.member-ids:}") String ids, MemberRepository members) {
        this.allowed = Arrays.stream(ids.split(",")).map(String::strip).filter(value -> !value.isEmpty())
            .map(Long::valueOf).collect(Collectors.toUnmodifiableSet());
        this.members = members;
        if (allowed.stream().anyMatch(id -> id <= 0)) throw new IllegalArgumentException("Admin member IDs must be positive");
    }

    public void requireAdmin(Long memberId) {
        if (memberId == null || !allowed.contains(memberId) || !members.existsById(memberId)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "관리자만 사용할 수 있습니다.");
        }
    }
}
