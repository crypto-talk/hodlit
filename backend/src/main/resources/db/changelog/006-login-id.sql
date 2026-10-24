--liquibase formatted sql

--changeset cryptalk:006
ALTER TABLE members ADD COLUMN login_id VARCHAR(254) NULL;
UPDATE members SET login_id = LOWER(email) WHERE email IS NOT NULL;
ALTER TABLE members ADD CONSTRAINT uk_members_login_id UNIQUE (login_id);
