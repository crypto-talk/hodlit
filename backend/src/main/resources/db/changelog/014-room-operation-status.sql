--liquibase formatted sql
--changeset cryptalk:014-room-operation-status
ALTER TABLE coins ADD COLUMN operation_status VARCHAR(10) DEFAULT 'CLOSE' NOT NULL;
UPDATE coins SET operation_status = CASE WHEN UPPER(symbol) = 'ETH' THEN 'OPEN' ELSE 'CLOSE' END;
ALTER TABLE coins ADD CONSTRAINT chk_coins_operation_status CHECK (operation_status IN ('OPEN', 'CLOSE'));
