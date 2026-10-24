--liquibase formatted sql

--changeset cryptalk:009
CREATE TABLE exchange_connections (
    id BIGINT NOT NULL AUTO_INCREMENT,
    member_id BIGINT NOT NULL,
    exchange VARCHAR(20) NOT NULL,
    encrypted_access_key VARCHAR(512) NOT NULL,
    encrypted_secret_key VARCHAR(512) NOT NULL,
    connected_at TIMESTAMP(6) NOT NULL,
    CONSTRAINT pk_exchange_connections PRIMARY KEY (id),
    CONSTRAINT uk_exchange_connection_member_exchange UNIQUE (member_id, exchange),
    CONSTRAINT fk_exchange_connection_member FOREIGN KEY (member_id) REFERENCES members (id) ON DELETE CASCADE
);
