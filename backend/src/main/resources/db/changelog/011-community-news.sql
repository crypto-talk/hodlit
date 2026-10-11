--liquibase formatted sql
--changeset cryptalk:011-community-news
CREATE TABLE community_news (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    coin_id BIGINT NOT NULL,
    title VARCHAR(200) NOT NULL,
    summary VARCHAR(1000) NOT NULL,
    source_name VARCHAR(100) NOT NULL,
    source_url VARCHAR(1000) NOT NULL,
    created_at TIMESTAMP(6) NOT NULL,
    updated_at TIMESTAMP(6) NOT NULL,
    CONSTRAINT fk_news_coin FOREIGN KEY (coin_id) REFERENCES coins(id) ON DELETE CASCADE
);
CREATE INDEX idx_news_coin_created ON community_news(coin_id, created_at, id);
