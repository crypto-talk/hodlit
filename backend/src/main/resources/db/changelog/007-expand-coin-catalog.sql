--liquibase formatted sql

--changeset cryptalk:007
INSERT INTO coins (symbol, name, chain_type, contract_address, accent_color, display_order, market_price_id, active) VALUES
('ADA', 'Cardano', 'CARDANO', NULL, '#0033ad', 6, 'cardano', TRUE),
('BNB', 'BNB', 'BSC_NATIVE', NULL, '#f3ba2f', 7, 'binancecoin', TRUE),
('AVAX', 'Avalanche', 'AVALANCHE', NULL, '#e84142', 8, 'avalanche-2', TRUE),
('DOT', 'Polkadot', 'POLKADOT', NULL, '#e6007a', 9, 'polkadot', TRUE),
('LINK', 'Chainlink', 'EVM_TOKEN', NULL, '#2a5ada', 10, 'chainlink', TRUE),
('POL', 'Polygon', 'POLYGON_NATIVE', NULL, '#8247e5', 11, 'polygon-ecosystem-token', TRUE),
('TON', 'Toncoin', 'TON', NULL, '#0098ea', 12, 'the-open-network', TRUE),
('TRX', 'TRON', 'TRON', NULL, '#ff0013', 13, 'tron', TRUE),
('LTC', 'Litecoin', 'LITECOIN', NULL, '#345d9d', 14, 'litecoin', TRUE),
('BCH', 'Bitcoin Cash', 'BITCOIN_CASH', NULL, '#0ac18e', 15, 'bitcoin-cash', TRUE),
('UNI', 'Uniswap', 'EVM_TOKEN', NULL, '#ff007a', 16, 'uniswap', TRUE),
('AAVE', 'Aave', 'EVM_TOKEN', NULL, '#7b61ff', 17, 'aave', TRUE),
('ATOM', 'Cosmos', 'COSMOS', NULL, '#2e3148', 18, 'cosmos', TRUE),
('NEAR', 'NEAR Protocol', 'NEAR', NULL, '#000000', 19, 'near', TRUE),
('SUI', 'Sui', 'SUI', NULL, '#6fbcf0', 20, 'sui', TRUE);
