package com.cryptalk.member;

import com.cryptalk.auth.AuthDtos.MemberResponse;
import com.cryptalk.common.ApiException;
import com.cryptalk.wallet.WalletRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class MemberService {
    private final MemberRepository members;
    private final WalletRepository wallets;
    public MemberService(MemberRepository members, WalletRepository wallets) { this.members = members; this.wallets = wallets; }

    @Transactional(readOnly = true)
    public MemberResponse get(Long id) {
        Member member = find(id);
        String address = wallets.findFirstByMemberId(id).map(wallet -> wallet.getAddress()).orElse(null);
        return new MemberResponse(id, member.getNickname(), member.getAvatarColor(), address,
            member.getAssetVisibility().name(), member.getRole());
    }

    @Transactional
    public MemberResponse update(Long id, String nickname, String avatarColor) {
        Member member = find(id);
        if (nickname != null && !nickname.equals(member.getNickname()) && members.findByNickname(nickname).isPresent())
            throw new ApiException(HttpStatus.CONFLICT, "이미 사용 중인 닉네임입니다.");
        member.update(nickname == null ? member.getNickname() : nickname, avatarColor == null ? member.getAvatarColor() : avatarColor);
        return get(id);
    }

    @Transactional
    public MemberResponse visibility(Long id, AssetVisibility visibility) { find(id).changeAssetVisibility(visibility); return get(id); }
    private Member find(Long id) { return members.findById(id).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "회원을 찾을 수 없습니다.")); }
}
