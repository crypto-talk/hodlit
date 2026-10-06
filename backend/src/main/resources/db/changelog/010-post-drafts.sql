--liquibase formatted sql

--changeset cryptalk:010
CREATE TABLE drafts (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    member_id BIGINT NOT NULL,
    payload MEDIUMTEXT NOT NULL,
    updated_at TIMESTAMP(6) NOT NULL,
    CONSTRAINT fk_drafts_member FOREIGN KEY (member_id) REFERENCES members (id) ON DELETE CASCADE
);
CREATE INDEX idx_drafts_member_updated ON drafts (member_id, updated_at DESC, id DESC);
ALTER TABLE media_assets ADD COLUMN draft_id BIGINT NULL;
ALTER TABLE media_assets ADD CONSTRAINT fk_media_assets_draft FOREIGN KEY (draft_id) REFERENCES drafts (id) ON DELETE SET NULL;
CREATE INDEX idx_media_assets_draft ON media_assets (draft_id);
