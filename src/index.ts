import * as dotenv from 'dotenv';
dotenv.config();

import { Network, Alchemy } from 'alchemy-sdk';

const settings = {
  apiKey: process.env.ALCHEMY_API_KEY || '',
  network: Network.ETH_MAINNET
};

const alchemy = new Alchemy(settings);

export const fetchAllNFTSalesFromAlchemy = async (loop = false) => {
  try {
    const firstData = await alchemy.nft.getNftSales({
      fromBlock: 0,
      toBlock: 'latest',
      limit: 1,
    });
    let pageKey = firstData.pageKey ?? '';

    console.log(JSON.stringify(firstData, null, 2));

    // loop and fetch all pages
    while (loop && pageKey) {
      const data = await alchemy.nft.getNftSales({
        fromBlock: 0,
        toBlock: 'latest',
        limit: 1000,
        pageKey
      });

      pageKey = data.pageKey ?? '';

      console.log(JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.log(error);
  }
};

fetchAllNFTSalesFromAlchemy(false).catch(console.error);
