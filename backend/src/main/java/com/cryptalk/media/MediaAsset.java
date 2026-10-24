package com.cryptalk.media;

import com.cryptalk.member.Member;
import com.cryptalk.post.Post;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "media_assets")
public class MediaAsset {
    @Id @Column(name = "file_name", length = 60) private String fileName;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "member_id") private Member member;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "post_id") private Post post;
    @Column(name = "draft_id") private Long draftId;
    @Column(name = "media_type", nullable = false, length = 20) private String mediaType;
    @Column(name = "content_type", nullable = false, length = 100) private String contentType;
    @Column(name = "size_bytes", nullable = false) private long sizeBytes;
    @Column(name = "created_at", nullable = false) private Instant createdAt;

    protected MediaAsset() {}
    public MediaAsset(String fileName, Member member, String mediaType, String contentType, long sizeBytes) {
        this.fileName = fileName; this.member = member; this.mediaType = mediaType;
        this.contentType = contentType; this.sizeBytes = sizeBytes; this.createdAt = Instant.now();
    }
    public String getFileName() { return fileName; }
    public Member getMember() { return member; }
    public Post getPost() { return post; }
    public Long getDraftId() { return draftId; }
    public void attachDraft(Long draftId) { this.draftId = draftId; }
    public void attach(Post post) { this.post = post; this.draftId = null; }
}
