--liquibase formatted sql
--changeset cryptalk:011-community-polls
CREATE TABLE community_polls (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    coin_id BIGINT NOT NULL,
    question VARCHAR(200) NOT NULL,
    active BOOLEAN NOT NULL,
    created_at TIMESTAMP(6) NOT NULL,
    CONSTRAINT fk_poll_coin FOREIGN KEY(coin_id) REFERENCES coins(id) ON DELETE CASCADE
);
CREATE INDEX idx_poll_coin_active ON community_polls(coin_id,active,created_at,id);
CREATE TABLE poll_choices (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    poll_id BIGINT NOT NULL,
    label VARCHAR(100) NOT NULL,
    display_order INT NOT NULL,
    CONSTRAINT fk_choice_poll FOREIGN KEY(poll_id) REFERENCES community_polls(id) ON DELETE CASCADE,
    CONSTRAINT uk_choice_poll_order UNIQUE(poll_id,display_order),
    CONSTRAINT uk_choice_poll_id UNIQUE(poll_id,id)
);
CREATE TABLE poll_votes (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    poll_id BIGINT NOT NULL,
    member_id BIGINT NOT NULL,
    choice_id BIGINT NOT NULL,
    vote_date DATE NOT NULL,
    CONSTRAINT uk_vote_poll_member_day UNIQUE(poll_id,member_id,vote_date),
    CONSTRAINT fk_vote_poll FOREIGN KEY(poll_id) REFERENCES community_polls(id) ON DELETE CASCADE,
    CONSTRAINT fk_vote_member FOREIGN KEY(member_id) REFERENCES members(id) ON DELETE CASCADE,
    CONSTRAINT fk_vote_choice FOREIGN KEY(poll_id,choice_id) REFERENCES poll_choices(poll_id,id) ON DELETE CASCADE
);
CREATE INDEX idx_vote_poll_day_choice ON poll_votes(poll_id,vote_date,choice_id);
