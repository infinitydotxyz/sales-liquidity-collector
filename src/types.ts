export interface FlattenedPostgresNFTSale {
  txhash: string;
  log_index: number;
  bundle_index: number;
  block_number: number;
  marketplace: string;
  marketplace_address: string;
  seller: string;
  buyer: string;
  quantity: string;
  collection_address: string;
  collection_name: string;
  token_id: string;
  token_image: string;
  sale_timestamp: number;
  sale_price: string;
  sale_price_eth: number;
  sale_currency_address: string;
  sale_currency_decimals: number;
  sale_currency_symbol: string;
}

export interface AlchemyNftSaleResponse {
  marketplace: string;
  marketplaceAddress: string;
  contractAddress: string;
  tokenId: string;
  quantity: string;
  buyerAddress: string;
  sellerAddress: string;
  sellerFee: {
    amount: string;
    tokenAddress: string;
    symbol: string;
    decimals: number;
  };
  blockNumber: number;
  logIndex: number;
  bundleIndex: number;
  transactionHash: string;
}

export interface AlchemyNftSalesQueryParams {
  pageKey?: string;
  limit?: string;
  fromBlock?: string;
  toBlock?: string;
  order?: string;
  contractAddress?: string;
}
