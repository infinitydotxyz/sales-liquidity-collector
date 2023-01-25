import { ChainId } from '@infinityxyz/lib/types/core';
import { NftDto } from '@infinityxyz/lib/types/dto';
import { firestoreConstants, getCollectionDocId } from '@infinityxyz/lib/utils';
import axios from 'axios';
import * as dotenv from 'dotenv';
import { ethers } from 'ethers';
import firebaseAdmin, { ServiceAccount } from 'firebase-admin';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import path, { resolve } from 'path';
import pgPromise from 'pg-promise';
import { AlchemyNftSaleResponse, AlchemyNftSalesQueryParams, FlattenedPostgresNFTSale } from 'types';
dotenv.config();

const serviceAccountFile = resolve(__dirname, `creds/firebase-prod.json`);
const serviceAccount = JSON.parse(readFileSync(serviceAccountFile, 'utf-8'));
firebaseAdmin.initializeApp({
  credential: firebaseAdmin.credential.cert(serviceAccount as ServiceAccount)
});
const firestore = firebaseAdmin.firestore();

let pgConnection: any = { max: 20, idleTimeoutMillis: 10000, connectionTimeoutMillis: 2000 };
const connectionString = process.env.DATABASE_URL;
if (connectionString) {
  pgConnection = {
    connectionString,
    ...pgConnection
  };
} else {
  pgConnection = {
    host: process.env.PG_HOST_LOCAL,
    port: Number(process.env.PG_PORT),
    database: process.env.PG_DB_NAME,
    user: process.env.PG_USER,
    password: process.env.PG_PASS,
    ...pgConnection
  };
}

const pgp = pgPromise({
  capSQL: true
});
const pgpDB = pgp(pgConnection);

const BLOCK_30D_AGO = '16266604';
const BLOCK_CURRENT = '16485264';
//const BLOCK_CURRENT = 'latest';

const CHAIN_ID = ChainId.Mainnet;

const CHECK_POINT_FILE = path.join(__dirname, 'checkpoint.txt');

export const fetchAllEthNFTSalesFromAlchemy = async (loop = false) => {
  try {
    let lastBlock = '';
    if (existsSync(CHECK_POINT_FILE)) {
      lastBlock = readFileSync(CHECK_POINT_FILE, 'utf8');
      lastBlock && console.log('Checkpoint found. Resuming from block:', lastBlock);
    }

    const params: AlchemyNftSalesQueryParams = {
      fromBlock: lastBlock || BLOCK_30D_AGO, // ?? doesn't work
      toBlock: BLOCK_CURRENT,
      order: 'asc',
      limit: '10'
    };

    const options = {
      method: 'GET',
      url: `https://eth-mainnet.g.alchemy.com/nft/v2/${process.env.ALCHEMY_API_KEY}/getNFTSales`,
      params,
      headers: { accept: 'application/json' }
    };

    // this first and rest pattern with loop flag is for quick testing purposes
    const firstResult = await axios.request(options);
    const firstData = firstResult.data;
    let pageKey = firstData.pageKey;
    let pgData = await getPostgresData(firstData.nftSales);
    await batchSaveToPostgres(pgData);

    lastBlock = firstData.nftSales[firstData.nftSales.length - 1].blockNumber;
    writeFileSync(CHECK_POINT_FILE, `${lastBlock}`);
    console.log('Saved checkpoint at block:', lastBlock);

    // loop and fetch all pages
    params.limit = '1000'; // max limit is 1000
    while (loop && pageKey) {
      console.log('Fetching page:', pageKey);
      params.pageKey = pageKey;
      options.params = params;
      const result = await axios.request(options);
      const data = result.data;
      pgData = await getPostgresData(data.nftSales);
      await batchSaveToPostgres(pgData);

      pageKey = data.pageKey;

      lastBlock = data.nftSales[data.nftSales.length - 1].blockNumber;
      writeFileSync(CHECK_POINT_FILE, `${lastBlock}`);
      console.log('Saved checkpoint at block:', lastBlock);
    }
  } catch (error) {
    console.error(error);
  }
};

const getPostgresData = async (data: AlchemyNftSaleResponse[]): Promise<FlattenedPostgresNFTSale[]> => {
  const pgData: FlattenedPostgresNFTSale[] = [];

  const first = data[0];
  const last = data[data.length - 1];
  const firstTimestamp = await getUnixTimestamp(first.blockNumber);
  const lastTimestamp = await getUnixTimestamp(last.blockNumber);
  const divisor = last.blockNumber === first.blockNumber ? 1 : last.blockNumber - first.blockNumber;
  const avgBlockTime = (lastTimestamp - firstTimestamp) / divisor;

  const fsRefs = data.map((sale) => {
    const collectionDocId = getCollectionDocId({
      collectionAddress: sale.contractAddress,
      chainId: CHAIN_ID
    });

    return firestore
      .collection(firestoreConstants.COLLECTIONS_COLL)
      .doc(collectionDocId)
      .collection(firestoreConstants.COLLECTION_NFTS_COLL)
      .doc(sale.tokenId);
  });

  const fsData = await firestore.getAll(...fsRefs);

  const fsTokenDataMap = new Map<string, NftDto>();
  fsData.forEach((doc) => {
    const fsTokenData = doc.data() as NftDto;
    // this check is reqd in cases where the collection is not indexed yet
    if (fsTokenData && fsTokenData.collectionAddress && fsTokenData.tokenId) {
      const fsTokenDataKey = `${fsTokenData.collectionAddress}:${fsTokenData.tokenId}`;
      fsTokenDataMap.set(fsTokenDataKey, fsTokenData);
    }
  });

  for (const sale of data) {
    // don't want to read an entire block for every sale just to call block.timestamp on it hence using extrapolated timestamp
    // this method is not 100% accurate but it's close enough for our purposes and exponentially faster
    // we could make the block.timestamp calls in parallel but that feels like overkill and also costs 16 CUs per call

    const extrapolatedTimestamp = getExtrapolatedUnixTimestamp(
      sale.blockNumber,
      first.blockNumber,
      avgBlockTime,
      firstTimestamp
    );

    const fsTokenData = fsTokenDataMap.get(`${sale.contractAddress}:${sale.tokenId}`);
    const tokenImage =
      fsTokenData?.image?.url ?? fsTokenData?.alchemyCachedImage ?? fsTokenData?.image?.originalUrl ?? '';
    const collectionName = fsTokenData?.collectionName ?? '';

    const pgSale: FlattenedPostgresNFTSale = {
      txhash: sale.transactionHash,
      block_number: sale.blockNumber,
      marketplace: sale.marketplace,
      marketplace_address: sale.marketplaceAddress,
      seller: sale.sellerAddress,
      buyer: sale.buyerAddress,
      quantity: sale.quantity,
      collection_address: sale.contractAddress,
      collection_name: collectionName,
      token_id: sale.tokenId,
      token_image: tokenImage,
      sale_timestamp: extrapolatedTimestamp,
      sale_price: sale.sellerFee.amount,
      sale_price_eth: parseFloat(ethers.utils.formatUnits(sale.sellerFee.amount, sale.sellerFee.decimals)),
      sale_currency_address: sale.sellerFee.tokenAddress,
      sale_currency_decimals: sale.sellerFee.decimals,
      sale_currency_symbol: sale.sellerFee.symbol
    };

    pgData.push(pgSale);
  }

  return pgData;
};

const getUnixTimestamp = async (blockNumber: number) => {
  const provider = new ethers.providers.StaticJsonRpcProvider(process.env.alchemyJsonRpcEthMainnet);
  const block = await provider.getBlock(blockNumber);
  const timestamp = block.timestamp * 1000;
  return timestamp;
};

const getExtrapolatedUnixTimestamp = (
  blockNumber: number,
  firstBlockNumber: number,
  avgBlockTime: number,
  firstBlockTimestamp: number
) => {
  const extrapolatedTimestamp = Math.round((blockNumber - firstBlockNumber) * avgBlockTime + firstBlockTimestamp);
  return extrapolatedTimestamp;
};

const batchSaveToPostgres = async (data: FlattenedPostgresNFTSale[]) => {
  try {
    const table = 'eth_nft_sales';
    const columnSet = new pgp.helpers.ColumnSet(Object.keys(data[0]), { table });
    const query = pgp.helpers.insert(data, columnSet) + ' ON CONFLICT DO NOTHING';
    await pgpDB.none(query);
  } catch (err) {
    console.error(err);
  }
};

// run
fetchAllEthNFTSalesFromAlchemy(true).catch(console.error);
