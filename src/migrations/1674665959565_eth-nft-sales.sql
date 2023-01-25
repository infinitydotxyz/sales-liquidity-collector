-- Up Migration

CREATE TABLE "eth_nft_sales" (
    "marketplace" TEXT COLLATE pg_catalog."default",
    "collection_address" TEXT COLLATE pg_catalog."default",
    "token_id" TEXT COLLATE pg_catalog."default",
    "quantity" TEXT COLLATE pg_catalog."default",
    "buyer" TEXT COLLATE pg_catalog."default",
    "seller" TEXT COLLATE pg_catalog."default",
    "block_number" NUMERIC,
    "txhash" TEXT COLLATE pg_catalog."default" NOT NULL,
    "token_image" TEXT COLLATE pg_catalog."default",
    "collection_name" TEXT COLLATE pg_catalog."default",
    "sale_timestamp" NUMERIC NOT NULL,
    "marketplace_address" TEXT COLLATE pg_catalog."default",
    "sale_price" TEXT COLLATE pg_catalog."default",
    "sale_currency_address" TEXT COLLATE pg_catalog."default",
    "sale_currency_decimals" NUMERIC,
    "sale_currency_symbol" TEXT COLLATE pg_catalog."default",
    "sale_price_eth" NUMERIC
);

ALTER TABLE "eth_nft_sales"
  ADD CONSTRAINT "eth_nft_sales_pkey"
  PRIMARY KEY ("txhash");

-- Down Migration

DROP TABLE "eth-nft-sales";
