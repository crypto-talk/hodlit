--liquibase formatted sql
--changeset cryptalk:021-room-categories
CREATE TABLE room_categories (
 id BIGINT AUTO_INCREMENT PRIMARY KEY,
 name VARCHAR(80) NOT NULL UNIQUE,
 display_order INT NOT NULL
);
ALTER TABLE coins ADD COLUMN category_id BIGINT;
ALTER TABLE coins ADD CONSTRAINT fk_coin_category FOREIGN KEY(category_id) REFERENCES room_categories(id);
CREATE INDEX idx_coin_category ON coins(category_id);
