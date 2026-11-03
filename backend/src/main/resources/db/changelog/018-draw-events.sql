--liquibase formatted sql
--changeset cryptalk:018-draw-events
CREATE TABLE draw_events (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(100) NOT NULL,
    description VARCHAR(2000) NOT NULL,
    starts_at TIMESTAMP(6) NOT NULL,
    ends_at TIMESTAMP(6) NOT NULL,
    status VARCHAR(20) NOT NULL,
    published BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT chk_draw_dates CHECK (starts_at < ends_at),
    CONSTRAINT chk_draw_status CHECK (status IN ('DRAFT','ACTIVE','PAUSED'))
);
CREATE TABLE draw_prizes (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    event_id BIGINT NOT NULL,
    name VARCHAR(100) NOT NULL,
    image_url VARCHAR(1000) NOT NULL,
    description VARCHAR(1000) NOT NULL,
    weight BIGINT NOT NULL,
    display_order INT NOT NULL,
    CONSTRAINT fk_draw_prize_event FOREIGN KEY (event_id) REFERENCES draw_events(id),
    CONSTRAINT chk_draw_weight CHECK (weight > 0)
);
CREATE INDEX idx_draw_prize_order ON draw_prizes(event_id, display_order, id);
CREATE TABLE draw_results (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    event_id BIGINT NOT NULL,
    member_id BIGINT NOT NULL,
    prize_id BIGINT NOT NULL,
    prize_name VARCHAR(100) NOT NULL,
    image_url VARCHAR(1000) NOT NULL,
    captured_at TIMESTAMP(6) NOT NULL,
    CONSTRAINT uk_draw_member UNIQUE(event_id, member_id),
    CONSTRAINT fk_draw_result_event FOREIGN KEY (event_id) REFERENCES draw_events(id),
    CONSTRAINT fk_draw_result_member FOREIGN KEY (member_id) REFERENCES members(id),
    CONSTRAINT fk_draw_result_prize FOREIGN KEY (prize_id) REFERENCES draw_prizes(id)
);
