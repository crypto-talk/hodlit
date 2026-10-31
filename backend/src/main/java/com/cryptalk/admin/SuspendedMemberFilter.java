package com.cryptalk.admin;

import com.cryptalk.member.MemberRepository;
import jakarta.servlet.*;
import jakarta.servlet.http.*;
import java.io.IOException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.filter.OncePerRequestFilter;

public class SuspendedMemberFilter extends OncePerRequestFilter {
    private final MemberRepository members;
    public SuspendedMemberFilter(MemberRepository members) { this.members = members; }
    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        var authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication instanceof JwtAuthenticationToken token && !request.getRequestURI().equals("/api/v1/auth/logout")) {
            try {
                if (members.findById(Long.valueOf(token.getToken().getSubject())).map(m -> m.isSuspended()).orElse(false)) {
                    response.setStatus(403);
                    response.setContentType("application/json;charset=UTF-8");
                    response.getWriter().write("{\"code\":\"ACCOUNT_SUSPENDED\",\"message\":\"이용이 정지된 계정입니다.\",\"timestamp\":\"" + java.time.Instant.now() + "\"}");
                    return;
                }
            } catch (NumberFormatException ignored) { }
        }
        chain.doFilter(request, response);
    }
}
