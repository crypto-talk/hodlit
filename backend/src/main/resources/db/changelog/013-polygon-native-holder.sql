--liquibase formatted sql

--changeset cryptalk:013-polygon-native-holder
UPDATE coins
SET verification_availability = 'SUPPORTED', chain_id = 137, asset_type = 'NATIVE', token_decimals = 18
WHERE symbol = 'POL' AND chain_type = 'POLYGON_NATIVE';
