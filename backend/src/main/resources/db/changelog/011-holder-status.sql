--liquibase formatted sql

--changeset cryptalk:011-holder-status
ALTER TABLE post_holder_snapshots ADD COLUMN holder_status VARCHAR(20) NOT NULL DEFAULT 'UNKNOWN';
ALTER TABLE comment_holder_snapshots ADD COLUMN holder_status VARCHAR(20) NOT NULL DEFAULT 'UNKNOWN';

-- Historical NO_DATA does not prove that no wallet was connected. Backfill conservatively.
UPDATE post_holder_snapshots SET holder_status = CASE
    WHEN verified_holder = TRUE THEN 'HOLDER'
    WHEN wallet_count > 0 AND quantity_exact = 0 AND sync_status = 'READY' THEN 'EMPTY'
    ELSE 'UNKNOWN' END;
UPDATE comment_holder_snapshots SET holder_status = CASE
    WHEN verified_holder = TRUE THEN 'HOLDER'
    WHEN wallet_count > 0 AND quantity_exact = 0 AND sync_status = 'READY' THEN 'EMPTY'
    ELSE 'UNKNOWN' END;
