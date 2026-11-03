--liquibase formatted sql
--changeset cryptalk:020-moderation
ALTER TABLE posts ADD COLUMN hidden BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE members ADD COLUMN suspended BOOLEAN NOT NULL DEFAULT FALSE;
CREATE TABLE moderation_logs (
 id BIGINT AUTO_INCREMENT PRIMARY KEY,
 actor_id BIGINT NOT NULL,
 target_type VARCHAR(20) NOT NULL,
 target_id BIGINT NOT NULL,
 before_state VARCHAR(20) NOT NULL,
 after_state VARCHAR(20) NOT NULL,
 reason VARCHAR(500) NOT NULL,
 created_at TIMESTAMP(6) NOT NULL,
 CONSTRAINT fk_moderation_actor FOREIGN KEY (actor_id) REFERENCES members(id)
);
CREATE INDEX idx_moderation_target ON moderation_logs(target_type,target_id,id);
