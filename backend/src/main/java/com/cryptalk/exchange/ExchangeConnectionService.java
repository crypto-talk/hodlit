package com.cryptalk.exchange;

import com.cryptalk.common.ApiException;
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

    public ExchangeConnectionService(ExchangeConnectionRepository connections, MemberRepository members,
                                     ExchangeCredentialCipher cipher, ExchangeBalanceClient balances) {
        this.connections = connections;
        this.members = members;
        this.cipher = cipher;
        this.balances = balances;
    }

    @Transactional(readOnly = true)
    public List<ConnectionResponse> list(Long memberId) {
        return connections.findByMemberIdOrderByExchangeAsc(memberId).stream().map(this::response).toList();
    }

    @Transactional
    public ConnectionResponse connect(Long memberId, Exchange exchange, String accessKey, String secretKey) {
        cipher.requireConfigured();
        balances.balances(exchange, accessKey, secretKey);
        Member member = members.findById(memberId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "회원을 찾을 수 없습니다."));
        ExchangeConnection connection = connections.findByMemberIdAndExchange(memberId, exchange)
            .orElseGet(() -> new ExchangeConnection(member, exchange, "", ""));
        connection.replace(cipher.encrypt(accessKey), cipher.encrypt(secretKey));
        return response(connections.save(connection));
    }

    @Transactional(readOnly = true)
    public AssetResponse assets(Long memberId, Exchange exchange) {
        ExchangeConnection connection = owned(memberId, exchange);
        return new AssetResponse(exchange,
            balances.balances(exchange, cipher.decrypt(connection.getEncryptedAccessKey()),
                cipher.decrypt(connection.getEncryptedSecretKey())), Instant.now());
    }

    @Transactional
    public void disconnect(Long memberId, Exchange exchange) {
        connections.delete(owned(memberId, exchange));
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
