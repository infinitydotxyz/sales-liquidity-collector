export interface FlattenedPostgresNFTSale {
  txnHash: string;
  blockNumber: number;
  marketplace: string;
  marketplaceAddress: string;
  seller: string;
  buyer: string;
  quantity: string;
  collectionAddress: string;
  collectionName: string;
  tokenId: string;
  tokenImage: string;
  timestamp: number;
  salePrice: string;
  salePriceEth: number;
  saleCurrencyAddress: string;
  saleCurrencyDecimals: number;
  saleCurrencySymbol: string;
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
