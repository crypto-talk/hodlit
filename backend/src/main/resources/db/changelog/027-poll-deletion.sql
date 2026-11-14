--liquibase formatted sql

--changeset cryptalk:027-poll-deletion
ALTER TABLE community_polls ADD COLUMN deleted_at TIMESTAMP(6) NULL;
