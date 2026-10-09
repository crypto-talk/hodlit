package com.cryptalk.wallet;

import com.cryptalk.common.ApiException;
import com.cryptalk.asset.AssetSnapshotRepository;
import java.time.Instant;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class WalletService {
    private final WalletRepository wallets;
    private final WalletConnectionEventRepository events;

    private final AssetSnapshotRepository snapshots;

    public WalletService(WalletRepository wallets, WalletConnectionEventRepository events, AssetSnapshotRepository snapshots) {
        this.wallets = wallets;
        this.events = events;
        this.snapshots = snapshots;
    }

    @Transactional(readOnly = true)
    public List<WalletResponse> list(Long memberId) {
        return wallets.findByMemberIdOrderByCreatedAtAsc(memberId).stream().map(this::response).toList();
    }

    @Transactional
    public void disconnect(Long memberId, Long walletId) {
        Wallet wallet = wallets.findById(walletId)
            .filter(value -> value.getMember().getId().equals(memberId))
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "지갑을 찾을 수 없습니다."));
        events.save(new WalletConnectionEvent(wallet.getMember(), wallet, WalletConnectionEvent.EventType.DISCONNECTED));
        wallets.delete(wallet);
        // Even with other wallets connected, the cached aggregate still contains the removed wallet.
        // Publication snapshots are independent immutable records and are deliberately untouched.
        snapshots.deleteByMemberId(memberId);
    }

    private WalletResponse response(Wallet wallet) {
        return new WalletResponse(wallet.getId(), wallet.getChainType(), wallet.getAddress(), wallet.getCreatedAt());
    }

    public record WalletResponse(Long id, String chainType, String address, Instant connectedAt) {}
}
