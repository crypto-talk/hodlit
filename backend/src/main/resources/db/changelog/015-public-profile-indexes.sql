--liquibase formatted sql

--changeset cryptalk:015-public-profile-indexes
CREATE INDEX idx_posts_member_created_id ON posts (member_id, created_at DESC, id DESC);
CREATE INDEX idx_comments_member_created_id ON comments (member_id, created_at DESC, id DESC);
