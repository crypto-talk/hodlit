--liquibase formatted sql
--changeset cryptalk:023-poll-vote-history
ALTER TABLE poll_votes ADD COLUMN voted_at TIMESTAMP(6) NULL;
ALTER TABLE poll_votes ADD COLUMN price DECIMAL(36,18) NULL;
ALTER TABLE poll_votes ADD COLUMN price_currency VARCHAR(10) NULL;
ALTER TABLE poll_votes ADD COLUMN price_source VARCHAR(30) NULL;
ALTER TABLE poll_votes ADD COLUMN price_captured_at TIMESTAMP(6) NULL;
ALTER TABLE poll_votes ADD COLUMN holder_status VARCHAR(20) NULL;
ALTER TABLE poll_votes ADD COLUMN quantity_band VARCHAR(40) NULL;
CREATE INDEX idx_poll_votes_member_history ON poll_votes(member_id, vote_date, id);
