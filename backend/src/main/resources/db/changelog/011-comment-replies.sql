--liquibase formatted sql

--changeset cryptalk:011-comment-replies
ALTER TABLE comments ADD COLUMN parent_comment_id BIGINT NULL;
ALTER TABLE comments ADD COLUMN reply_to_comment_id BIGINT NULL;
ALTER TABLE comments ADD COLUMN reply_to_nickname VARCHAR(40) NULL;
ALTER TABLE comments ADD CONSTRAINT fk_comment_root FOREIGN KEY (parent_comment_id) REFERENCES comments(id) ON DELETE CASCADE;
ALTER TABLE comments ADD CONSTRAINT fk_comment_reply_target FOREIGN KEY (reply_to_comment_id) REFERENCES comments(id) ON DELETE SET NULL;
CREATE INDEX idx_comment_root_created ON comments(parent_comment_id, created_at);
