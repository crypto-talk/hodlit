--liquibase formatted sql

--changeset cryptalk:011-community-activity
CREATE TABLE post_view_events (
    id BIGINT NOT NULL AUTO_INCREMENT,
    post_id BIGINT NOT NULL,
    member_id BIGINT NULL,
    created_at TIMESTAMP(6) NOT NULL,
    CONSTRAINT pk_post_view_events PRIMARY KEY (id),
    CONSTRAINT fk_post_view_post FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    CONSTRAINT fk_post_view_member FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE SET NULL
);
CREATE INDEX idx_post_views_created_post ON post_view_events(created_at, post_id);
CREATE INDEX idx_likes_created_post ON post_likes(created_at, post_id);
CREATE INDEX idx_comments_created_post ON comments(created_at, post_id);
CREATE INDEX idx_posts_created_coin ON posts(created_at, coin_id);
