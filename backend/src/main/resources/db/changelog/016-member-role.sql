--liquibase formatted sql
--changeset cryptalk:016-member-role
ALTER TABLE members ADD COLUMN role VARCHAR(20) DEFAULT 'USER' NOT NULL;
ALTER TABLE members ADD CONSTRAINT chk_members_role CHECK (role IN ('USER', 'ADMIN'));
