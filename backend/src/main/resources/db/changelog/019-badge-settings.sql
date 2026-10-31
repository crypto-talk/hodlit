--liquibase formatted sql
--changeset cryptalk:019-badge-settings
CREATE TABLE badge_tiers (
 id BIGINT AUTO_INCREMENT PRIMARY KEY,
 coin_id BIGINT NOT NULL,
 config_version BIGINT NOT NULL,
 tier_order INT NOT NULL,
 minimum_quantity DECIMAL(36,18) NOT NULL,
 name VARCHAR(40) NOT NULL,
 icon VARCHAR(20) NOT NULL,
 color VARCHAR(20) NOT NULL,
 effect VARCHAR(20) NOT NULL,
 CONSTRAINT fk_badge_coin FOREIGN KEY (coin_id) REFERENCES coins(id),
 CONSTRAINT uk_badge_order UNIQUE(coin_id,config_version,tier_order),
 CONSTRAINT uk_badge_minimum UNIQUE(coin_id,config_version,minimum_quantity)
);
ALTER TABLE post_holder_snapshots ADD COLUMN badge_version BIGINT;
ALTER TABLE post_holder_snapshots ADD COLUMN badge_name VARCHAR(40);
ALTER TABLE post_holder_snapshots ADD COLUMN badge_band VARCHAR(120);
ALTER TABLE post_holder_snapshots ADD COLUMN badge_icon VARCHAR(20);
ALTER TABLE post_holder_snapshots ADD COLUMN badge_color VARCHAR(20);
ALTER TABLE post_holder_snapshots ADD COLUMN badge_effect VARCHAR(20);
ALTER TABLE comment_holder_snapshots ADD COLUMN badge_version BIGINT;
ALTER TABLE comment_holder_snapshots ADD COLUMN badge_name VARCHAR(40);
ALTER TABLE comment_holder_snapshots ADD COLUMN badge_band VARCHAR(120);
ALTER TABLE comment_holder_snapshots ADD COLUMN badge_icon VARCHAR(20);
ALTER TABLE comment_holder_snapshots ADD COLUMN badge_color VARCHAR(20);
ALTER TABLE comment_holder_snapshots ADD COLUMN badge_effect VARCHAR(20);
INSERT INTO badge_tiers(coin_id,config_version,tier_order,minimum_quantity,name,icon,color,effect) SELECT id,1,0,0,'새우','shrimp','coral','soft' FROM coins WHERE UPPER(symbol)='ETH';
INSERT INTO badge_tiers(coin_id,config_version,tier_order,minimum_quantity,name,icon,color,effect) SELECT id,1,1,0.1,'물고기','fish','mint','border' FROM coins WHERE UPPER(symbol)='ETH';
INSERT INTO badge_tiers(coin_id,config_version,tier_order,minimum_quantity,name,icon,color,effect) SELECT id,1,2,1,'돌고래','dolphin','blue','shine' FROM coins WHERE UPPER(symbol)='ETH';
INSERT INTO badge_tiers(coin_id,config_version,tier_order,minimum_quantity,name,icon,color,effect) SELECT id,1,3,10,'상어','shark','purple','flow' FROM coins WHERE UPPER(symbol)='ETH';
INSERT INTO badge_tiers(coin_id,config_version,tier_order,minimum_quantity,name,icon,color,effect) SELECT id,1,4,100,'고래','whale','gold','aurora' FROM coins WHERE UPPER(symbol)='ETH';
ALTER TABLE post_holder_snapshots MODIFY COLUMN quantity_band VARCHAR(120);
ALTER TABLE comment_holder_snapshots MODIFY COLUMN quantity_band VARCHAR(120);
