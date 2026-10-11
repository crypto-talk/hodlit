package com.cryptalk.exchange;

import com.cryptalk.common.ApiException;
import com.cryptalk.asset.AssetSnapshotRepository;
import org.springframework.dao.DataIntegrityViolationException;
import com.cryptalk.member.Member;
import com.cryptalk.member.MemberRepository;
import java.time.Instant;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ExchangeConnectionService {
    private final ExchangeConnectionRepository connections;
    private final MemberRepository members;
    private final ExchangeCredentialCipher cipher;
    private final ExchangeBalanceClient balances;
    private final AssetSnapshotRepository snapshots;
    private final ExchangeAccountClient accounts;

    public ExchangeConnectionService(ExchangeConnectionRepository connections, MemberRepository members,
                                     ExchangeCredentialCipher cipher, ExchangeBalanceClient balances,
                                     AssetSnapshotRepository snapshots, ExchangeAccountClient accounts) {
        this.connections = connections;
        this.members = members;
        this.cipher = cipher;
        this.balances = balances;
        this.snapshots = snapshots;
        this.accounts = accounts;
    }

    @Transactional(readOnly = true)
    public List<ConnectionResponse> list(Long memberId) {
        return connections.findByMemberIdOrderByExchangeAsc(memberId).stream().map(this::response).toList();
    }

    @Transactional
    public ConnectionResponse connect(Long memberId, Exchange exchange, String accessKey, String secretKey) {
        cipher.requireConfigured();
        Member member = members.lockById(memberId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "회원을 찾을 수 없습니다."));
        try {
            String accountFingerprint = identify(exchange, accessKey, secretKey);
            fetchBalances(exchange, accessKey, secretKey);
            if (exchange != Exchange.COINONE) {
                // Legacy rows must also prove identity before a new key can be linked safely.
                // Skip the actor's row: replacement must allow recovery from an expired old key.
                for (var legacy : connections.findByExchangeAndAccountFingerprintIsNull(exchange)) {
                    if (legacy.getMember().getId().equals(memberId)) continue;
                    try {
                        legacy.identifyAccount(identify(exchange, cipher.decrypt(legacy.getEncryptedAccessKey()),
                            cipher.decrypt(legacy.getEncryptedSecretKey())));
                    } catch (ApiException unverifiable) {
                        throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE,
                            "기존 거래소 연결의 계정 확인이 필요합니다. 기존 연결을 재연결하거나 해제한 뒤 다시 시도해 주세요.");
                    }
                    connections.saveAndFlush(legacy);
                }
                var linkedAccount = connections.findByAccountFingerprint(accountFingerprint).orElse(null);
                if (linkedAccount != null && !linkedAccount.getMember().getId().equals(memberId)) {
                    throw new ApiException(HttpStatus.CONFLICT, "이미 다른 회원에 연결된 거래소 계정입니다.");
                }
            }
            // Backfill legacy encrypted keys before enforcing the new uniqueness boundary.
            for (var legacy : connections.findByExchangeAndCredentialFingerprintIsNull(exchange)) {
                if (legacy.getMember().getId().equals(memberId)) continue;
                legacy.fingerprint(ExchangeCredentialFingerprint.of(exchange,cipher.decrypt(legacy.getEncryptedAccessKey())));
                connections.saveAndFlush(legacy);
            }
            String fingerprint = ExchangeCredentialFingerprint.of(exchange,accessKey);
            var linked = connections.findByCredentialFingerprint(fingerprint).orElse(null);
            if (linked != null && !linked.getMember().getId().equals(memberId))
                throw new ApiException(HttpStatus.CONFLICT,"이미 다른 회원에 연결된 거래소 API 키입니다.");
            ExchangeConnection connection = connections.findByMemberIdAndExchange(memberId,exchange)
                .orElseGet(() -> new ExchangeConnection(member,exchange,"",""));
            connection.replace(cipher.encrypt(accessKey),cipher.encrypt(secretKey));
            connection.fingerprint(fingerprint);
            connection.identifyAccount(accountFingerprint);
            var saved = connections.saveAndFlush(connection);
            snapshots.deleteByMemberId(memberId);
            return response(saved);
        } catch (DataIntegrityViolationException duplicate) {
            throw new ApiException(HttpStatus.CONFLICT,"중복 거래소 연결을 정리한 뒤 다시 시도해 주세요.");
        } catch (org.springframework.dao.TransientDataAccessException retryable) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE,"거래소 연결 처리 중입니다. 잠시 후 다시 시도해 주세요.");
        }
    }

    @Transactional(readOnly = true)
    public AssetResponse assets(Long memberId, Exchange exchange) {
        ExchangeConnection connection = owned(memberId, exchange);
        if (exchange != Exchange.COINONE && connection.getAccountFingerprint() == null) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "거래소 계정 확인을 위해 재연결해 주세요.");
        }
        return new AssetResponse(exchange,
            fetchBalances(exchange, cipher.decrypt(connection.getEncryptedAccessKey()),
                cipher.decrypt(connection.getEncryptedSecretKey())), Instant.now());
    }

    private String identify(Exchange exchange, String accessKey, String secretKey) {
        // TODO(HODL-50): Coinone remains credential-unique only until a stable account identity API is confirmed.
        if (exchange == Exchange.COINONE) return null;
        String accountId = accounts.accountId(exchange, accessKey, secretKey);
        if (accountId == null || accountId.isBlank()) {
            throw new ApiException(HttpStatus.BAD_GATEWAY, "거래소 계정을 확인하지 못했습니다.");
        }
        return ExchangeAccountFingerprint.of(exchange, accountId);
    }

    private List<ExchangeBalanceClient.Balance> fetchBalances(Exchange exchange, String accessKey, String secretKey) {
        // Bithumb identity is API 1.0: use that same key/version for balances, never a separate account's key.
        return exchange == Exchange.BITHUMB ? accounts.bithumbBalances(accessKey, secretKey)
            : balances.balances(exchange, accessKey, secretKey);
    }

    @Transactional
    public void disconnect(Long memberId, Exchange exchange) {
        members.lockById(memberId).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND,"회원을 찾을 수 없습니다."));
        connections.delete(owned(memberId, exchange));
        snapshots.deleteByMemberId(memberId);
    }

    private ExchangeConnection owned(Long memberId, Exchange exchange) {
        return connections.findByMemberIdAndExchange(memberId, exchange)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "연결된 거래소를 찾을 수 없습니다."));
    }

    private ConnectionResponse response(ExchangeConnection connection) {
        return new ConnectionResponse(connection.getExchange(), connection.getConnectedAt());
    }

    public record ConnectionResponse(Exchange exchange, Instant connectedAt) {}
    public record AssetResponse(Exchange exchange, List<ExchangeBalanceClient.Balance> balances, Instant fetchedAt) {}
}
