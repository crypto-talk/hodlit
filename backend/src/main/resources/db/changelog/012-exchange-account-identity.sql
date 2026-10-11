--liquibase formatted sql
--changeset cryptalk:012-exchange-account-identity
ALTER TABLE exchange_connections ADD COLUMN account_fingerprint VARCHAR(64) NULL;
CREATE UNIQUE INDEX uk_exchange_account_fingerprint ON exchange_connections(account_fingerprint);
-- No account ID is invented from legacy API keys. Reconnect/backfill validates provider identity first.
