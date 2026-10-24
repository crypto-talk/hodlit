--liquibase formatted sql
--changeset cryptalk:011-edit-drafts
-- Soft reference deliberately preserves recovery content after deletion of the original.
ALTER TABLE drafts ADD COLUMN source_post_id BIGINT NULL;
CREATE UNIQUE INDEX uk_drafts_member_source_post ON drafts(member_id, source_post_id);
