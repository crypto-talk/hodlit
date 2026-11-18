package com.cryptalk.admin;

import com.cryptalk.common.ApiException;
import com.cryptalk.member.MemberRepository;
import com.cryptalk.member.MemberRole;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class AdminAccess {
    private final MemberRepository members;

    public AdminAccess(MemberRepository members) {
        this.members = members;
    }

    @Transactional(readOnly = true)
    public void requireAdmin(Long memberId) {
        if (memberId == null || !members.existsByIdAndRole(memberId, MemberRole.ADMIN)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "관리자만 사용할 수 있습니다.");
        }
    }
}
