--liquibase formatted sql

--changeset cryptalk:024-post-coin-snapshots
CREATE TABLE post_coin_snapshots (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    post_id BIGINT NOT NULL,
    coin_id BIGINT NOT NULL,
    display_order INT NOT NULL,
    verification_availability VARCHAR(20) NOT NULL,
    verification_level VARCHAR(20),
    verified_holder BOOLEAN NOT NULL,
    quantity_band VARCHAR(120),
    holding_months INT,
    wallet_count INT NOT NULL,
    captured_at TIMESTAMP(6) NOT NULL,
    block_number BIGINT,
    sync_status VARCHAR(20) NOT NULL,
    holder_status VARCHAR(20) NOT NULL,
    badge_version BIGINT,
    badge_name VARCHAR(40),
    badge_band VARCHAR(120),
    badge_icon VARCHAR(20),
    badge_color VARCHAR(20),
    badge_effect VARCHAR(20),
    CONSTRAINT uq_post_coin_snapshot UNIQUE (post_id, coin_id),
    CONSTRAINT fk_post_coin_snapshot_post FOREIGN KEY (post_id) REFERENCES posts (id) ON DELETE CASCADE,
    CONSTRAINT fk_post_coin_snapshot_coin FOREIGN KEY (coin_id) REFERENCES coins (id)
);
