import * as dotenv from 'dotenv';
dotenv.config();
import axios from 'axios';
import { FlattenedPostgresNFTSale, AlchemyNftSaleResponse, AlchemyNftSalesQueryParams } from 'types';
import { ethers } from 'ethers';
import { firestoreConstants, getCollectionDocId } from '@infinityxyz/lib/utils';
import firebaseAdmin, { ServiceAccount } from 'firebase-admin';
import { resolve } from 'path';
import { readFileSync } from 'fs';
import { NftDto } from '@infinityxyz/lib/types/dto';
import { Pool } from 'pg';

const serviceAccountFile = resolve(__dirname, `creds/firebase-prod.json`);
const serviceAccount = JSON.parse(readFileSync(serviceAccountFile, 'utf-8'));
firebaseAdmin.initializeApp({
  credential: firebaseAdmin.credential.cert(serviceAccount as ServiceAccount)
});
const firestore = firebaseAdmin.firestore();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // host: process.env.PG_HOST_LOCAL,
  // port: Number(process.env.PG_PORT),
  // database: process.env.PG_DB_NAME,
  // user: process.env.PG_USER,
  // password: process.env.PG_PASS,
  max: 20,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 2000
});

const BLOCK_30D_AGO = '16266604';

export const fetchAllNFTSalesFromAlchemy = async (loop = false) => {
  try {
    const params: AlchemyNftSalesQueryParams = {
      fromBlock: BLOCK_30D_AGO,
      toBlock: 'latest',
      order: 'desc',
      limit: '2'
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
    await saveToPostgres(pgData);

    // loop and fetch all pages
    params.pageKey = pageKey;
    params.limit = '1000'; // max limit is 1000
    options.params = params;
    while (loop && pageKey) {
      const result = await axios.request(options);
      const data = result.data;
      pageKey = data.pageKey;
      pgData = await getPostgresData(data.nftSales);
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

  for (const sale of data) {
    // don't want to read an entire block for every sale just to call block.timestamp on it hence using extrapolated timestamp
    // this method is not 100% accurate but it's close enough for our purposes and exponentially faster
    // we could make the block.timestamp calls in parallel but that feels like overkill and also costs 16 CUs per call

    // const timestamp = await getUnixTimestamp(sale.blockNumber);

    const extrapolatedTimestamp = getExtrapolatedUnixTimestamp(
      sale.blockNumber,
      first.blockNumber,
      avgBlockTime,
      firstTimestamp
    );

    const fsTokenData = await firestoreTokenData(sale.contractAddress, sale.tokenId);
    const tokenImage =
      fsTokenData?.image?.url ?? fsTokenData?.alchemyCachedImage ?? fsTokenData?.image?.originalUrl ?? '';
    const collectionName = fsTokenData?.collectionName ?? '';

    const pgSale: FlattenedPostgresNFTSale = {
      txnHash: sale.transactionHash,
      blockNumber: sale.blockNumber,
      marketplace: sale.marketplace,
      marketplaceAddress: sale.marketplaceAddress,
      seller: sale.sellerAddress,
      buyer: sale.buyerAddress,
      quantity: sale.quantity,
      collectionAddress: sale.contractAddress,
      collectionName,
      tokenId: sale.tokenId,
      tokenImage,
      timestamp: extrapolatedTimestamp,
      salePrice: sale.sellerFee.amount,
      salePriceEth: parseFloat(ethers.utils.formatUnits(sale.sellerFee.amount, sale.sellerFee.decimals)),
      saleCurrencyAddress: sale.sellerFee.tokenAddress,
      saleCurrencyDecimals: sale.sellerFee.decimals,
      saleCurrencySymbol: sale.sellerFee.symbol
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

const firestoreTokenData = async (collectionAddress: string, tokenId: string): Promise<NftDto> => {
  const collectionDocId = getCollectionDocId({
    collectionAddress,
    chainId: '1'
  });
  const data = await firestore
    .collection(firestoreConstants.COLLECTIONS_COLL)
    .doc(collectionDocId)
    .collection(firestoreConstants.COLLECTION_NFTS_COLL)
    .doc(tokenId)
    .get();

  return data.data() as NftDto;
};

const saveToPostgres = async (data: FlattenedPostgresNFTSale[]) => {
  const client = await pool.connect();
  const table = '"eth-nft-sales"';
  try {
    for (const sale of data) {
      const keys = [];
      const values = [];
      for (const [key, value] of Object.entries(sale)) {
        keys.push(key);
        values.push(value);
      }
      const colNames = keys.join(',');
      const colValues = values.join(',');
      // const insert = `INSERT INTO ${table} (${colNames}) VALUES (${colValues}) ON CONFLICT DO NOTHING`;
      const insert = `INSERT INTO ${table} ("txnHash", timestamp) VALUES ($1, $2) ON CONFLICT DO NOTHING`;
      const insertValues = [sale.txnHash, sale.timestamp];
      await client.query(insert, insertValues);
    }

    const res = await client.query(`SELECT * FROM ${table}`);
    console.log(res.rows[0]);
  } catch (err) {
    console.error(err);
  } finally {
    client.release();
  }
};

// run
fetchAllNFTSalesFromAlchemy(false).catch(console.error);
