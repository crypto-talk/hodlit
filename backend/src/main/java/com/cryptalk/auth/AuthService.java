package com.cryptalk.auth;

import com.cryptalk.auth.AuthDtos.*;
import com.cryptalk.common.ApiException;
import com.cryptalk.member.Member;
import com.cryptalk.member.MemberRepository;
import com.cryptalk.wallet.Wallet;
import com.cryptalk.wallet.WalletChain;
import com.cryptalk.wallet.WalletRepository;
import com.cryptalk.wallet.WalletConnectionEvent;
import com.cryptalk.wallet.WalletConnectionEventRepository;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Locale;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {
    private final AuthNonceRepository nonces;
    private final RefreshTokenRepository refreshTokens;
    private final MemberRepository members;
    private final WalletRepository wallets;
    private final WalletSignatureVerifier verifier;
    private final WalletConnectionEventRepository walletEvents;
    private final JwtService jwtService;
    private final PasswordEncoder passwordEncoder;
    private final long refreshTokenDays;
    private final SecureRandom random = new SecureRandom();

    public AuthService(AuthNonceRepository nonces, RefreshTokenRepository refreshTokens, MemberRepository members,
                       WalletRepository wallets, WalletSignatureVerifier verifier, JwtService jwtService,
                       WalletConnectionEventRepository walletEvents, PasswordEncoder passwordEncoder,
                       @Value("${cryptalk.jwt.refresh-token-days}") long refreshTokenDays) {
        this.nonces = nonces; this.refreshTokens = refreshTokens; this.members = members; this.wallets = wallets;
        this.verifier = verifier; this.jwtService = jwtService; this.walletEvents = walletEvents;
        this.passwordEncoder = passwordEncoder; this.refreshTokenDays = refreshTokenDays;
    }

    @Transactional
    public LoginResult signup(SignupRequest request) {
        String loginId = request.loginId().toLowerCase();
        String nickname = request.nickname();
        if (members.findByLoginIdIgnoreCase(loginId).isPresent())
            throw new ApiException(HttpStatus.CONFLICT, "이미 사용 중인 아이디입니다.");
        if (members.findByNickname(nickname).isPresent())
            throw new ApiException(HttpStatus.CONFLICT, "이미 사용 중인 닉네임입니다.");
        Member member = members.save(new Member(loginId, passwordEncoder.encode(request.password()), nickname, colorFor(loginId)));
        return issueTokens(member, null);
    }

    @Transactional
    public LoginResult login(LoginRequest request) {
        Member member = members.findByLoginIdIgnoreCase(request.loginId().trim())
            .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "아이디 또는 비밀번호가 올바르지 않습니다."));
        if (member.getPasswordHash() == null || !passwordEncoder.matches(request.password(), member.getPasswordHash()))
            throw new ApiException(HttpStatus.UNAUTHORIZED, "아이디 또는 비밀번호가 올바르지 않습니다.");
        String address = wallets.findFirstByMemberId(member.getId()).map(Wallet::getAddress).orElse(null);
        return issueTokens(member, address);
    }

    @Transactional
    public NonceResponse createLinkNonce(Long memberId, NonceRequest request) {
        members.findById(memberId).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "회원을 찾을 수 없습니다."));
        WalletChain chain = request.chainType();
        String address = walletAddress(chain, request.walletAddress());
        String nonce = UUID.randomUUID().toString();
        String chainLine = chain == WalletChain.SOLANA ? "\n체인: Solana" : "";
        String message = "CrypTalk 지갑 연결\n\n지갑 주소: " + address + chainLine
            + "\n일회용 코드: " + nonce + "\n유효 시간: 5분";
        AuthNonce saved = nonces.save(new AuthNonce(address, chain, "LINK", memberId, nonce, message));
        return new NonceResponse(saved.getId(), message, 300);
    }

    @Transactional
    public MemberResponse connectWallet(Long memberId, WalletLoginRequest request) {
        WalletChain chain = request.chainType();
        String address = walletAddress(chain, request.walletAddress());
        verifyLinkNonce(request, address, memberId);
        Wallet wallet = wallets.findByChainTypeAndAddress(chain.name(), address).orElse(null);
        if (wallet != null && !wallet.getMember().getId().equals(memberId))
            throw new ApiException(HttpStatus.CONFLICT, "다른 계정에 연결된 지갑입니다.");
        Member member = members.findById(memberId).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "회원을 찾을 수 없습니다."));
        if (wallet == null) {
            wallet = wallets.save(new Wallet(member, chain, address));
            walletEvents.save(new WalletConnectionEvent(member, wallet, WalletConnectionEvent.EventType.CONNECTED));
        }
        return profile(member, address);
    }

    @Transactional
    public LoginResult refresh(String rawToken) {
        if (rawToken == null || rawToken.isBlank()) throw new ApiException(HttpStatus.UNAUTHORIZED, "로그인이 만료되었습니다.");
        RefreshToken token = refreshTokens.findByTokenHash(hash(rawToken))
            .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "로그인이 만료되었습니다."));
        if (!token.isUsable()) throw new ApiException(HttpStatus.UNAUTHORIZED, "로그인이 만료되었습니다.");
        token.revoke();
        String address = wallets.findFirstByMemberId(token.getMember().getId()).map(Wallet::getAddress).orElse(null);
        return issueTokens(token.getMember(), address);
    }

    @Transactional
    public void logout(String rawToken) {
        if (rawToken == null) return;
        refreshTokens.findByTokenHash(hash(rawToken)).ifPresent(RefreshToken::revoke);
    }

    private String walletAddress(WalletChain chain, String address) {
        boolean valid = switch (chain) {
            case EVM -> address.matches("0x[0-9a-fA-F]{40}");
            case SOLANA -> verifier.isSolanaAddress(address);
        };
        if (!valid) throw new ApiException(HttpStatus.BAD_REQUEST, "지갑 주소 형식을 확인해 주세요.");
        return chain == WalletChain.EVM ? address.toLowerCase(Locale.ROOT) : address;
    }

    private void verifyLinkNonce(WalletLoginRequest request, String address, Long memberId) {
        AuthNonce nonce = nonces.lockById(request.nonceId())
            .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "지갑 인증 요청을 찾을 수 없습니다."));
        WalletChain chain = request.chainType();
        if (!nonce.isUsable() || !"LINK".equals(nonce.getPurpose()) || !memberId.equals(nonce.getMemberId())
            || nonce.getChainType() != chain || !nonce.getWalletAddress().equals(address)
            || !verifier.verify(chain, address, nonce.getMessage(), request.signature())) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "지갑 서명이 올바르지 않거나 만료되었습니다.");
        }
        nonce.use();
    }

    private LoginResult issueTokens(Member member, String address) {
        if (member.isSuspended()) throw new ApiException(HttpStatus.FORBIDDEN, "이용이 정지된 계정입니다.");
        byte[] bytes = new byte[32]; random.nextBytes(bytes);
        String rawRefresh = HexFormat.of().formatHex(bytes);
        refreshTokens.save(new RefreshToken(member, hash(rawRefresh), Instant.now().plusSeconds(refreshTokenDays * 86400)));
        return new LoginResult(new AuthResponse(jwtService.issue(member), "Bearer", profile(member, address)), rawRefresh);
    }

    private MemberResponse profile(Member member, String address) {
        return new MemberResponse(member.getId(), member.getNickname(), member.getAvatarColor(), address,
            member.getAssetVisibility().name(), member.getRole());
    }

    private String colorFor(String value) {
        String[] colors = {"#7c3aed", "#2563eb", "#059669", "#db2777", "#ea580c"};
        return colors[Math.floorMod(value.hashCode(), colors.length)];
    }

    private String hash(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception exception) { throw new IllegalStateException(exception); }
    }

    public record LoginResult(AuthResponse response, String refreshToken) {}
}
