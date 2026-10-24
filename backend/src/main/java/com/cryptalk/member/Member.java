package com.cryptalk.member;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "members")
public class Member {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Enumerated(EnumType.STRING)
    @Column(name = "role", nullable = false, length = 20)
    private MemberRole role = MemberRole.USER;
    @Column(name = "login_id", unique = true, length = 254)
    private String loginId;
    @Column(name = "password_hash", length = 100)
    private String passwordHash;
    @Column(nullable = false, unique = true, length = 40)
    private String nickname;
    @Column(name = "avatar_color", nullable = false, length = 20)
    private String avatarColor;
    @Enumerated(EnumType.STRING)
    @Column(name = "asset_visibility", nullable = false, length = 20)
    private AssetVisibility assetVisibility;
    @Column(name = "created_at", nullable = false)
    private Instant createdAt;
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected Member() {}

    public Member(String nickname, String avatarColor) {
        this.nickname = nickname;
        this.avatarColor = avatarColor;
        this.assetVisibility = AssetVisibility.EXACT;
        this.createdAt = Instant.now();
        this.updatedAt = createdAt;
    }

    public Member(String loginId, String passwordHash, String nickname, String avatarColor) {
        this(nickname, avatarColor);
        this.loginId = loginId.toLowerCase();
        this.passwordHash = passwordHash;
    }

    public Long getId() { return id; }
    public Instant getCreatedAt() { return createdAt; }
    public String getNickname() { return nickname; }
    public String getLoginId() { return loginId; }
    public String getPasswordHash() { return passwordHash; }
    public String getAvatarColor() { return avatarColor; }
    public AssetVisibility getAssetVisibility() { return assetVisibility; }
    public void update(String nickname, String avatarColor) { this.nickname = nickname; this.avatarColor = avatarColor; this.updatedAt = Instant.now(); }
    public void changeAssetVisibility(AssetVisibility visibility) { this.assetVisibility = visibility; this.updatedAt = Instant.now(); }
}
