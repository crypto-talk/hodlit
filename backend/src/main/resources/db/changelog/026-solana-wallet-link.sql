--liquibase formatted sql

--changeset cryptalk:026-wallet-nonce-chain
ALTER TABLE auth_nonces ADD COLUMN chain_type VARCHAR(20) NOT NULL DEFAULT 'EVM';

--changeset cryptalk:026-wallet-address-case-sensitive dbms:mysql
ALTER TABLE wallets MODIFY COLUMN address VARCHAR(80) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL;
