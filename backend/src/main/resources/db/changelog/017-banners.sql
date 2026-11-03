--liquibase formatted sql
--changeset cryptalk:017-banners
CREATE TABLE banners (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(100) NOT NULL,
    image_url VARCHAR(1000) NOT NULL,
    alt_text VARCHAR(200) NOT NULL,
    link_url VARCHAR(1000),
    visible BOOLEAN NOT NULL,
    display_order INT NOT NULL,
    created_at TIMESTAMP(6) NOT NULL,
    updated_at TIMESTAMP(6) NOT NULL
);
CREATE INDEX idx_banners_visibility_order ON banners(visible, display_order, id);
