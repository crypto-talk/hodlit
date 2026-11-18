package com.cryptalk;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.cryptalk.member.Member;
import com.cryptalk.member.MemberRepository;
import com.cryptalk.member.MemberRole;
import jakarta.persistence.EntityManager;
import jakarta.servlet.http.Cookie;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class MemberRoleApiTest {
    private static final String PASSWORD = "strong-password-123";
    @Autowired MockMvc mvc;
    @Autowired MemberRepository members;
    @Autowired JdbcTemplate jdbc;
    @Autowired EntityManager em;
    @Autowired PasswordEncoder passwords;

    @ParameterizedTest
    @EnumSource(MemberRole.class)
    void ownResponsesUseDatabaseRoleAndPublicProfilesDoNotExposeIt(MemberRole role) throws Exception {
        Member member = member(role);
        String subject = member.getId().toString();
        String forgedRole = opposite(role).name();

        mvc.perform(get("/api/v1/me").with(jwt().jwt(token -> token.subject(subject).claim("role", forgedRole))))
            .andExpect(status().isOk()).andExpect(jsonPath("$.role").value(role.name()));
        mvc.perform(patch("/api/v1/me").with(jwt().jwt(token -> token.subject(subject)))
                .contentType(MediaType.APPLICATION_JSON).content("{\"avatarColor\":\"#abcdef\"}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.role").value(role.name()));
        mvc.perform(patch("/api/v1/me/asset-visibility").with(jwt().jwt(token -> token.subject(subject)))
                .contentType(MediaType.APPLICATION_JSON).content("{\"visibility\":\"HIDDEN\"}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.role").value(role.name()));

        mvc.perform(get("/api/v1/members/{id}", member.getId()))
            .andExpect(status().isOk()).andExpect(jsonPath("$.role").doesNotExist());
        mvc.perform(get("/api/v1/members/by-nickname/{nickname}", member.getNickname()))
            .andExpect(status().isOk()).andExpect(jsonPath("$.role").doesNotExist());
        mvc.perform(get("/api/v1/members/by-nickname").param("nickname", member.getNickname()))
            .andExpect(status().isOk()).andExpect(jsonPath("$.role").doesNotExist());
    }

    @ParameterizedTest
    @EnumSource(MemberRole.class)
    void loginAndRefreshReturnCurrentDatabaseRole(MemberRole role) throws Exception {
        Member member = member(role);
        String cookieHeader = mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content("{\"loginId\":\"" + member.getLoginId() + "\",\"password\":\"" + PASSWORD + "\"}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.member.role").value(role.name()))
            .andReturn().getResponse().getHeader("Set-Cookie");
        assertThat(cookieHeader).isNotNull();
        String refreshToken = cookieHeader.split(";", 2)[0].split("=", 2)[1];

        MemberRole updatedRole = opposite(role);
        jdbc.update("UPDATE members SET role=? WHERE id=?", updatedRole.name(), member.getId());
        em.clear();
        mvc.perform(post("/api/v1/auth/refresh").cookie(new Cookie("cryptalk_refresh", refreshToken)))
            .andExpect(status().isOk()).andExpect(jsonPath("$.member.role").value(updatedRole.name()));
    }

    @Test
    void roleInputAndJwtClaimsCannotGrantAdminAccess() throws Exception {
        Member member = member(MemberRole.USER);
        String subject = member.getId().toString();
        mvc.perform(patch("/api/v1/me").with(jwt().jwt(token -> token.subject(subject).claim("role", "ADMIN")))
                .contentType(MediaType.APPLICATION_JSON).content("{\"role\":\"ADMIN\",\"avatarColor\":\"#abcdef\"}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.role").value("USER"));
        assertThat(jdbc.queryForObject("SELECT role FROM members WHERE id=?", String.class, member.getId()))
            .isEqualTo("USER");
        mvc.perform(get("/api/v1/admin/access")
                .with(jwt().jwt(token -> token.subject(subject).claim("role", "ADMIN"))))
            .andExpect(status().isForbidden());
    }

    @Test
    void signupReturnsDefaultUserRoleAndOwnProfileRequiresAuthentication() throws Exception {
        mvc.perform(post("/api/v1/auth/signup").contentType(MediaType.APPLICATION_JSON)
                .content("{\"loginId\":\"role-signup\",\"password\":\"" + PASSWORD
                    + "\",\"nickname\":\"역할회원\",\"role\":\"ADMIN\"}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.member.role").value("USER"));
        mvc.perform(get("/api/v1/me")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/me").with(jwt().jwt(token -> token.subject(Long.toString(Long.MAX_VALUE)))))
            .andExpect(status().isNotFound());
    }

    private Member member(MemberRole role) {
        String identifier = "role-" + UUID.randomUUID().toString().substring(0, 8);
        Member member = members.saveAndFlush(new Member(identifier, passwords.encode(PASSWORD), identifier, "#123456"));
        jdbc.update("UPDATE members SET role=? WHERE id=?", role.name(), member.getId());
        em.clear();
        return members.findById(member.getId()).orElseThrow();
    }

    private MemberRole opposite(MemberRole role) {
        return role == MemberRole.USER ? MemberRole.ADMIN : MemberRole.USER;
    }
}
