import { ChainId, OrderSource } from '@infinityxyz/lib/types/core';
import { NftDto } from '@infinityxyz/lib/types/dto';
import { firestoreConstants, getCollectionDocId, trimLowerCase } from '@infinityxyz/lib/utils';
import axios from 'axios';
import * as dotenv from 'dotenv';
import { ethers } from 'ethers';
import firebaseAdmin, { ServiceAccount } from 'firebase-admin';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import pgPromise from 'pg-promise';
import { FlattenedPostgresNFTSale, ReservoirSale } from 'types';
import * as Sdk from '@reservoir0x/sdk';
import { formatUnits } from 'ethers/lib/utils';
dotenv.config();

const serviceAccountFile = resolve(__dirname, `creds/firebase-prod.json`);
const serviceAccount = JSON.parse(readFileSync(serviceAccountFile, 'utf-8'));
firebaseAdmin.initializeApp({
  credential: firebaseAdmin.credential.cert(serviceAccount as ServiceAccount)
});
const firestore = firebaseAdmin.firestore();

let pgConnection: any = { max: 20, idleTimeoutMillis: 10000, connectionTimeoutMillis: 20000 };
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

const CHAIN_ID = ChainId.Goerli;
const salesUrl = 'https://api-goerli.reservoir.tools/sales/v4';

export const fetchNFTSalesFromReservoir = async (collectionAddress: string) => {
  try {
    const params = {
      collection: collectionAddress,
      limit: 1000 // max
    };

    const options = {
      method: 'GET',
      url: salesUrl,
      params,
      headers: { accept: 'application/json' }
    };

    // this first and rest pattern with loop flag is for quick testing purposes
    const result = await axios.request(options);
    const data = result.data;
    const pgData = await getPostgresData(data.sales);
    console.log('pgData', pgData.length);
    await batchSaveToPostgres(pgData);
  } catch (error) {
    console.error(error);
  }
};

const getPostgresData = async (data: ReservoirSale[]): Promise<FlattenedPostgresNFTSale[]> => {
  const pgData: FlattenedPostgresNFTSale[] = [];
  const fsRefs = [];
  for (const sale of data) {
    let collectionDocId;
    try {
      collectionDocId = getCollectionDocId({
        collectionAddress: sale.token.contract,
        chainId: CHAIN_ID
      });
    } catch (error) {
      console.error(error);
      console.error('Error getting collection doc id for sale with contract address', sale.token.contract);
    }

    if (collectionDocId) {
      fsRefs.push(
        firestore
          .collection(firestoreConstants.COLLECTIONS_COLL)
          .doc(collectionDocId)
          .collection(firestoreConstants.COLLECTION_NFTS_COLL)
          .doc(sale.token.tokenId)
      );
    }
  }

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
    const fsTokenData = fsTokenDataMap.get(`${trimLowerCase(sale.token.contract)}:${sale.token.tokenId}`);
    const tokenImage =
      fsTokenData?.image?.url ?? fsTokenData?.alchemyCachedImage ?? fsTokenData?.image?.originalUrl ?? '';
    const collectionName = fsTokenData?.collectionName ?? '';

    const amount = sale.price?.netAmount ?? sale.price?.amount;
    const pgSale: FlattenedPostgresNFTSale = {
      txhash: sale.txHash,
      log_index: sale.logIndex,
      bundle_index: sale.batchIndex,
      block_number: sale.block,
      marketplace: sale.orderKind,
      marketplace_address: getMarketplaceAddress(CHAIN_ID, sale.orderKind as OrderSource),
      seller: sale.from,
      buyer: sale.to,
      quantity: sale.amount,
      collection_address: sale.token?.contract,
      collection_name: collectionName,
      token_id: sale.token?.tokenId,
      token_image: tokenImage,
      sale_timestamp: (sale.timestamp ?? 0) * 1000,
      sale_price: amount?.raw,
      sale_price_eth: parseFloat(formatUnits(amount?.raw ?? '0', sale?.price?.currency?.decimals)),
      sale_currency_address: sale?.price?.currency?.contract ?? ethers.constants.AddressZero,
      sale_currency_decimals: sale?.price?.currency?.decimals,
      sale_currency_symbol: sale?.price?.currency?.symbol
    };

    pgData.push(pgSale);
  }

  return pgData;
};

const getMarketplaceAddress = (chainId: ChainId, orderKind?: OrderSource) => {
  const chainIdInt = parseInt(chainId);
  switch (orderKind) {
    case 'blur':
      return Sdk.Blur.Addresses.Exchange[chainIdInt];
    case 'cryptopunks':
      return Sdk.CryptoPunks.Addresses.Exchange[chainIdInt];
    case 'element-erc1155':
    case 'element-erc721':
      return Sdk.Element.Addresses.Exchange[chainIdInt];

    case 'flow':
      return Sdk.Flow.Addresses.Exchange[chainIdInt];

    case 'forward':
      return Sdk.Forward.Addresses.Exchange[chainIdInt];

    case 'foundation':
      return Sdk.Foundation.Addresses.Exchange[chainIdInt];

    case 'infinity':
      return Sdk.Infinity.Addresses.Exchange[chainIdInt];

    case 'looks-rare':
      return Sdk.LooksRare.Addresses.Exchange[chainIdInt];

    case 'manifold':
      return Sdk.Manifold.Addresses.Exchange[chainIdInt];

    case 'mint':
      return '0x0000000000000000000000000000000000000000';

    case 'nftx':
      return Sdk.Nftx.Addresses.MarketplaceZap[chainIdInt];

    case 'nouns':
      return Sdk.Nouns.Addresses.AuctionHouse[chainIdInt];

    case 'quixotic':
      return Sdk.Quixotic.Addresses.Exchange[chainIdInt];

    case 'rarible':
      return Sdk.Rarible.Addresses.Exchange[chainIdInt];

    case 'seaport':
      return Sdk.Seaport.Addresses.Exchange[chainIdInt];

    case 'seaport-v1.4':
      return Sdk.SeaportV14.Addresses.Exchange[chainIdInt];

    case 'sudoswap':
      return Sdk.Sudoswap.Addresses.PairFactory[chainIdInt];

    case 'universe':
      return Sdk.Universe.Addresses.Exchange[chainIdInt];

    case 'wyvern-v2':
      return Sdk.WyvernV2.Addresses.Exchange[chainIdInt];
    case 'wyvern-v2.3':
      return Sdk.WyvernV23.Addresses.Exchange[chainIdInt];
    case 'x2y2':
      return Sdk.X2Y2.Addresses.Exchange[chainIdInt];
    case 'zeroex-v4-erc1155':
      return Sdk.ZeroExV4.Addresses.Exchange[chainIdInt];
    case 'zeroex-v4-erc721':
      return Sdk.ZeroExV4.Addresses.Exchange[chainIdInt];
    case 'zora-v3':
      return Sdk.Zora.Addresses.Exchange[chainIdInt];

    default:
      console.warn(`Unknown source: ${orderKind}`);
      return '0x0000000000000000000000000000000000000000';
  }
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
