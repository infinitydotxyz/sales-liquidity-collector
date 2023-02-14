-- Up Migration

CREATE TABLE "eth_nft_orders" (
    "id" TEXT COLLATE pg_catalog."default",
    "is_sell_order" BOOLEAN,
    "price_eth" NUMERIC,
    "gas_usage" TEXT COLLATE pg_catalog."default",
    "collection_address" TEXT COLLATE pg_catalog."default",
    "token_id" TEXT COLLATE pg_catalog."default",
    "collection_name" TEXT COLLATE pg_catalog."default",
    "collection_image" TEXT COLLATE pg_catalog."default",
    "token_image" TEXT COLLATE pg_catalog."default",
    "start_time_millis" NUMERIC,
    "end_time_millis" NUMERIC,
    "maker" TEXT COLLATE pg_catalog."default",
    "marketplace" TEXT COLLATE pg_catalog."default",
    "marketplace_address" TEXT COLLATE pg_catalog."default",
    "is_private" BOOLEAN,
    "is_complex" BOOLEAN,
    "status" TEXT COLLATE pg_catalog."default"
);

ALTER TABLE "eth_nft_orders"
  ADD CONSTRAINT "eth_nft_orders_pkey"
  PRIMARY KEY ("id");
  
-- Down Migration

DROP TABLE "eth-nft-orders";
