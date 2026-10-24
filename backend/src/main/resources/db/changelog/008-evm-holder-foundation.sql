--liquibase formatted sql

--changeset cryptalk:008
ALTER TABLE coins ADD COLUMN verification_availability VARCHAR(20) NOT NULL DEFAULT 'NOT_SUPPORTED';
ALTER TABLE coins ADD COLUMN chain_id BIGINT NULL;
ALTER TABLE coins ADD COLUMN asset_type VARCHAR(20) NULL;
ALTER TABLE coins ADD COLUMN token_decimals INT NULL;

UPDATE coins
SET verification_availability = 'SUPPORTED', chain_id = 1, asset_type = 'NATIVE', token_decimals = 18
WHERE symbol = 'ETH';

UPDATE coins
SET verification_availability = 'NOT_CONFIGURED', asset_type = 'ERC20'
WHERE chain_type = 'EVM_TOKEN';

ALTER TABLE asset_snapshots ADD COLUMN wallet_count INT NOT NULL DEFAULT 0;
ALTER TABLE asset_snapshots ADD COLUMN holding_since TIMESTAMP(6) NULL;
ALTER TABLE asset_snapshots ADD COLUMN block_number BIGINT NULL;
ALTER TABLE asset_snapshots ADD COLUMN sync_status VARCHAR(20) NOT NULL DEFAULT 'READY';

CREATE TABLE wallet_connection_events (
    id BIGINT NOT NULL AUTO_INCREMENT,
    member_id BIGINT NOT NULL,
    wallet_id BIGINT NULL,
    event_type VARCHAR(20) NOT NULL,
    created_at TIMESTAMP(6) NOT NULL,
    CONSTRAINT pk_wallet_connection_events PRIMARY KEY (id),
    CONSTRAINT fk_wallet_events_member FOREIGN KEY (member_id) REFERENCES members (id) ON DELETE CASCADE,
    CONSTRAINT fk_wallet_events_wallet FOREIGN KEY (wallet_id) REFERENCES wallets (id) ON DELETE SET NULL
);
CREATE INDEX idx_wallet_events_member_created ON wallet_connection_events (member_id, created_at DESC);

CREATE TABLE post_holder_snapshots (
    post_id BIGINT NOT NULL,
    coin_id BIGINT NOT NULL,
    verification_availability VARCHAR(20) NOT NULL,
    verification_level VARCHAR(20) NULL,
    verified_holder BOOLEAN NOT NULL,
    quantity_exact DECIMAL(36, 18) NULL,
    quantity_band VARCHAR(40) NULL,
    holding_since TIMESTAMP(6) NULL,
    holding_months INT NULL,
    wallet_count INT NOT NULL,
    captured_at TIMESTAMP(6) NOT NULL,
    block_number BIGINT NULL,
    sync_status VARCHAR(20) NOT NULL,
    CONSTRAINT pk_post_holder_snapshots PRIMARY KEY (post_id),
    CONSTRAINT fk_post_holder_snapshot_post FOREIGN KEY (post_id) REFERENCES posts (id) ON DELETE CASCADE,
    CONSTRAINT fk_post_holder_snapshot_coin FOREIGN KEY (coin_id) REFERENCES coins (id)
);

CREATE TABLE comment_holder_snapshots (
    comment_id BIGINT NOT NULL,
    coin_id BIGINT NOT NULL,
    verification_availability VARCHAR(20) NOT NULL,
    verification_level VARCHAR(20) NULL,
    verified_holder BOOLEAN NOT NULL,
    quantity_exact DECIMAL(36, 18) NULL,
    quantity_band VARCHAR(40) NULL,
    holding_since TIMESTAMP(6) NULL,
    holding_months INT NULL,
    wallet_count INT NOT NULL,
    captured_at TIMESTAMP(6) NOT NULL,
    block_number BIGINT NULL,
    sync_status VARCHAR(20) NOT NULL,
    CONSTRAINT pk_comment_holder_snapshots PRIMARY KEY (comment_id),
    CONSTRAINT fk_comment_holder_snapshot_comment FOREIGN KEY (comment_id) REFERENCES comments (id) ON DELETE CASCADE,
    CONSTRAINT fk_comment_holder_snapshot_coin FOREIGN KEY (coin_id) REFERENCES coins (id)
);
