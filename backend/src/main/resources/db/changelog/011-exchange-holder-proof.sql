--liquibase formatted sql
--changeset cryptalk:011-exchange-holder-proof
ALTER TABLE asset_snapshots ADD COLUMN verification_level VARCHAR(20) NOT NULL DEFAULT 'UNVERIFIED';
ALTER TABLE asset_snapshots ADD COLUMN exchange_count INT NOT NULL DEFAULT 0;
UPDATE asset_snapshots SET verification_level='WALLET' WHERE verified=TRUE;
ALTER TABLE exchange_connections ADD COLUMN credential_fingerprint VARCHAR(64) NULL;
ALTER TABLE exchange_connections ADD COLUMN version BIGINT NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX uk_exchange_credential_fingerprint ON exchange_connections(credential_fingerprint);
-- The account-balance adapters support BTC as well as ETH. Other room support is enabled on observed currency records.
UPDATE coins SET verification_availability='SUPPORTED' WHERE symbol IN ('BTC','ETH');
