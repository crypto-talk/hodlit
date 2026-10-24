package com.cryptalk.auth;

import com.cryptalk.auth.AuthDtos.*;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/auth")
@Tag(name = "인증", description = "회원가입, 로그인, 토큰 갱신 및 로그아웃 API")
public class AuthController {
    private static final String COOKIE = "cryptalk_refresh";
    private final AuthService authService;
    private final boolean secureCookie;

    public AuthController(AuthService authService, @Value("${cryptalk.auth.cookie-secure}") boolean secureCookie) {
        this.authService = authService; this.secureCookie = secureCookie;
    }

    @Operation(summary = "회원가입", description = "로그인 아이디로 회원을 생성하고 access token과 refresh cookie를 발급합니다.")
    @PostMapping("/signup")
    AuthResponse signup(@Valid @RequestBody SignupRequest request, HttpServletResponse response) {
        AuthService.LoginResult result = authService.signup(request);
        addCookie(response, result.refreshToken(), 14 * 86400);
        return result.response();
    }

    @Operation(summary = "로그인", description = "로그인 아이디와 비밀번호를 검증하고 새로운 인증 토큰을 발급합니다.")
    @PostMapping("/login")
    AuthResponse login(@Valid @RequestBody LoginRequest request, HttpServletResponse response) {
        AuthService.LoginResult result = authService.login(request);
        addCookie(response, result.refreshToken(), 14 * 86400);
        return result.response();
    }

    @Operation(summary = "인증 토큰 갱신", description = "refresh cookie를 검증하고 access token과 refresh cookie를 재발급합니다.")
    @PostMapping("/refresh")
    AuthResponse refresh(HttpServletRequest request, HttpServletResponse response) {
        AuthService.LoginResult result = authService.refresh(readCookie(request));
        addCookie(response, result.refreshToken(), 14 * 86400);
        return result.response();
    }

    @Operation(summary = "로그아웃", description = "refresh token을 폐기하고 refresh cookie를 만료시킵니다.")
    @PostMapping("/logout")
    ResponseEntity<Void> logout(HttpServletRequest request, HttpServletResponse response) {
        authService.logout(readCookie(request)); addCookie(response, "", 0); return ResponseEntity.noContent().build();
    }

    private String readCookie(HttpServletRequest request) {
        if (request.getCookies() == null) return null;
        for (Cookie cookie : request.getCookies()) if (COOKIE.equals(cookie.getName())) return cookie.getValue();
        return null;
    }

    private void addCookie(HttpServletResponse response, String value, int maxAge) {
        String sameSite = secureCookie ? "None" : "Lax";
        String cookie = COOKIE + "=" + value + "; Path=/api/v1/auth; HttpOnly; SameSite=" + sameSite + "; Max-Age=" + maxAge + (secureCookie ? "; Secure" : "");
        response.addHeader("Set-Cookie", cookie);
    }
}
