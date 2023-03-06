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

export interface ReservoirSale {
  id: string;
  saleId: string;
  token: {
    contract: string;
    tokenId: string;
    image: string;
    collection:{
      name: string;
      id: string;
    }
  };
  orderId: string;
  orderSource: string;
  orderSide: string;
  orderKind: string;
  from: string;
  to: string;
  amount: string;
  fillSource: string;
  block: number;
  txHash: string;
  logIndex: number;
  batchIndex: number;
  timestamp: number; // in seconds since Unix epoch
  price: {
    currency: {
      contract: string;
      name: string;
      symbol: string;
      decimals: number;
    };
    amount: {
      raw: string;
      decimal: number;
      usd: number | null;
      native: number;
    };
    netAmount: {
      raw: string;
      decimal: number;
      usd: number | null;
      native: number;
    };
  };
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
