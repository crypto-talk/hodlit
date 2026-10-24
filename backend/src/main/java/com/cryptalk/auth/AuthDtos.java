package com.cryptalk.auth;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.UUID;

public final class AuthDtos {
    private AuthDtos() {}
    public record NonceRequest(@NotBlank @Pattern(regexp = "^0x[0-9a-fA-F]{40}$") String walletAddress) {}
    public record NonceResponse(UUID nonceId, String message, long expiresInSeconds) {}
    public record WalletLoginRequest(
        @NotBlank @Pattern(regexp = "^0x[0-9a-fA-F]{40}$") String walletAddress,
        @NotNull UUID nonceId,
        @NotBlank String signature
    ) {}
    public record SignupRequest(
        @NotBlank
        @Size(min = 4, max = 40)
        @Pattern(regexp = "^[A-Za-z0-9._-]+$", message = "영문, 숫자, 마침표, 밑줄, 하이픈만 사용할 수 있습니다.")
        String loginId,
        @NotBlank @Size(min = 8, max = 72) String password,
        @NotBlank @Size(min = 2, max = 40) String nickname
    ) {}
    public record LoginRequest(
        @NotBlank @Size(max = 254) String loginId,
        @NotBlank @Size(max = 72) String password
    ) {}
    public record AuthResponse(String accessToken, String tokenType, MemberResponse member) {}
    public record MemberResponse(Long id, String nickname, String avatarColor, String walletAddress, String assetVisibility) {}
}
