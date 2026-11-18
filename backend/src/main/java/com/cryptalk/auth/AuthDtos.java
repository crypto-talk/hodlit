package com.cryptalk.auth;

import com.cryptalk.member.Nickname;
import com.cryptalk.member.MemberRole;
import com.cryptalk.wallet.WalletChain;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.UUID;

public final class AuthDtos {
    private AuthDtos() {}
    public record NonceRequest(
        @NotBlank @Size(max = 44) String walletAddress,
        @Schema(defaultValue = "EVM") WalletChain chainType
    ) {
        public NonceRequest {
            if (chainType == null) chainType = WalletChain.EVM;
        }
    }
    public record NonceResponse(UUID nonceId, String message, long expiresInSeconds) {}
    public record WalletLoginRequest(
        @NotBlank @Size(max = 44) String walletAddress,
        @NotNull UUID nonceId,
        @NotBlank @Size(max = 132)
        @Schema(description = "EVM personal_sign의 16진수 서명 또는 Solana Ed25519의 Base58 서명")
        String signature,
        @Schema(defaultValue = "EVM") WalletChain chainType
    ) {
        public WalletLoginRequest {
            if (chainType == null) chainType = WalletChain.EVM;
        }
    }
    public record SignupRequest(
        @NotBlank
        @Size(min = 4, max = 40)
        @Pattern(regexp = "^[A-Za-z0-9._-]+$", message = "영문, 숫자, 마침표, 밑줄, 하이픈만 사용할 수 있습니다.")
        String loginId,
        @NotBlank @Size(min = 8, max = 72) String password,
        @NotBlank @Size(min = 2, max = 40)
        @Pattern(regexp = Nickname.PATTERN, message = Nickname.INVALID_CHARACTERS)
        String nickname
    ) {
        public SignupRequest {
            nickname = Nickname.normalize(nickname);
        }
    }
    public record LoginRequest(
        @NotBlank @Size(max = 254) String loginId,
        @NotBlank @Size(max = 72) String password
    ) {}
    public record AuthResponse(String accessToken, String tokenType, MemberResponse member) {}
    public record MemberResponse(Long id, String nickname, String avatarColor, String walletAddress, String assetVisibility,
                                 @Schema(description = "본인 계정의 현재 역할. 화면 표시용이며 관리자 API 권한은 서버가 확인합니다.",
                                         accessMode = Schema.AccessMode.READ_ONLY)
                                 MemberRole role) {}
}
