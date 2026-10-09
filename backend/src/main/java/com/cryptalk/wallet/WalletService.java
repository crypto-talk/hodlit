package com.cryptalk.wallet;

import com.cryptalk.common.ApiException;
import java.time.Instant;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class WalletService {
    private final WalletRepository wallets;
    private final WalletConnectionEventRepository events;

    public WalletService(WalletRepository wallets, WalletConnectionEventRepository events) {
        this.wallets = wallets; this.events = events;
    }

    @Transactional(readOnly = true)
    public List<WalletResponse> list(Long memberId) {
        return wallets.findByMemberIdOrderByCreatedAtAsc(memberId).stream().map(this::response).toList();
    }

    @Transactional(readOnly = true)
    public com.cryptalk.common.PageResponse<WalletResponse> numberedPage(Long memberId, int page, int size) {
        var request = com.cryptalk.common.PageResponse.request(page, size,
            org.springframework.data.domain.Sort.by("createdAt", "id"));
        return com.cryptalk.common.PageResponse.of(wallets.findByMemberId(memberId, request).map(this::response));
    }

    @Transactional
    public void disconnect(Long memberId, Long walletId) {
        Wallet wallet = wallets.findById(walletId)
            .filter(value -> value.getMember().getId().equals(memberId))
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "지갑을 찾을 수 없습니다."));
        events.save(new WalletConnectionEvent(wallet.getMember(), wallet, WalletConnectionEvent.EventType.DISCONNECTED));
        wallets.delete(wallet);
    }

    private WalletResponse response(Wallet wallet) {
        return new WalletResponse(wallet.getId(), wallet.getChainType(), wallet.getAddress(), wallet.getCreatedAt());
    }

    public record WalletResponse(Long id, String chainType, String address, Instant connectedAt) {}
}
