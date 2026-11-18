--liquibase formatted sql

--changeset cryptalk:025-other-room
INSERT INTO coins (symbol, name, chain_type, accent_color, display_order, active,
                   verification_availability, operation_status)
SELECT 'OTHER', '기타', 'OTHER', '#64748b', 2147483647, TRUE, 'NOT_SUPPORTED', 'OPEN'
FROM (SELECT 1 AS seed_id) seed
LEFT JOIN coins existing_room ON UPPER(existing_room.symbol) = 'OTHER'
WHERE existing_room.id IS NULL;

UPDATE coins
SET symbol = 'OTHER', name = '기타', chain_type = 'OTHER', display_order = 2147483647,
    active = TRUE, operation_status = 'OPEN', verification_availability = 'NOT_SUPPORTED',
    market_price_id = NULL, chain_id = NULL, contract_address = NULL,
    asset_type = NULL, token_decimals = NULL
WHERE UPPER(symbol) = 'OTHER';
