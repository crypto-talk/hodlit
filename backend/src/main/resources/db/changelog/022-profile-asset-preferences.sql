--liquibase formatted sql
--changeset cryptalk:022-profile-asset-preferences
CREATE TABLE asset_publication_preferences (
 id BIGINT AUTO_INCREMENT PRIMARY KEY,
 member_id BIGINT NOT NULL,
 coin_id BIGINT NOT NULL,
 visible BOOLEAN NOT NULL,
 CONSTRAINT uk_asset_publication UNIQUE(member_id,coin_id),
 CONSTRAINT fk_asset_publication_member FOREIGN KEY(member_id) REFERENCES members(id),
 CONSTRAINT fk_asset_publication_coin FOREIGN KEY(coin_id) REFERENCES coins(id)
);
