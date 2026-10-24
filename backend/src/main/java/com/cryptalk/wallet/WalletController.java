package com.cryptalk.wallet;

import com.cryptalk.auth.AuthDtos.MemberResponse;
import com.cryptalk.auth.AuthDtos.NonceRequest;
import com.cryptalk.auth.AuthDtos.NonceResponse;
import com.cryptalk.auth.AuthDtos.WalletLoginRequest;
import com.cryptalk.auth.AuthService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/me")
@Tag(name = "지갑 연결", description = "로그인 계정의 EVM 지갑 소유권 인증 및 연결 API")
public class WalletController {
    private final AuthService authService;
    private final WalletService wallets;

    public WalletController(AuthService authService, WalletService wallets) {
        this.authService = authService; this.wallets = wallets;
    }

    @Operation(summary = "지갑 연결 nonce 발급", description = "지갑 서명에 사용할 일회성 메시지와 nonce 식별자를 발급합니다.")
    @PostMapping("/wallet/nonce")
    NonceResponse nonce(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody NonceRequest request) {
        return authService.createLinkNonce(Long.valueOf(jwt.getSubject()), request.walletAddress());
    }

    @Operation(summary = "지갑 연결", description = "서명을 검증해 EVM 지갑 소유권을 확인하고 로그인 계정에 연결합니다.")
    @PostMapping("/wallet")
    MemberResponse connect(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody WalletLoginRequest request) {
        return authService.connectWallet(Long.valueOf(jwt.getSubject()), request);
    }

    @Operation(summary = "연결된 EVM 지갑 목록 조회")
    @GetMapping("/wallets")
    java.util.List<WalletService.WalletResponse> wallets(@AuthenticationPrincipal Jwt jwt) {
        return wallets.list(Long.valueOf(jwt.getSubject()));
    }

    @Operation(summary = "EVM 지갑 연결 해제", description = "과거 게시글과 댓글의 발행 스냅샷은 유지됩니다.")
    @DeleteMapping("/wallets/{walletId}")
    org.springframework.http.ResponseEntity<Void> disconnect(@AuthenticationPrincipal Jwt jwt, @PathVariable Long walletId) {
        wallets.disconnect(Long.valueOf(jwt.getSubject()), walletId);
        return org.springframework.http.ResponseEntity.noContent().build();
    }
}
