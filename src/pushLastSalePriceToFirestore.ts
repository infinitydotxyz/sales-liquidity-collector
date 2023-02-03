import { ChainId } from '@infinityxyz/lib/types/core';
import { firestoreConstants, getCollectionDocId } from '@infinityxyz/lib/utils';
import * as dotenv from 'dotenv';
import firebaseAdmin, { ServiceAccount } from 'firebase-admin';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { Pool } from 'pg';
import QueryStream from 'pg-query-stream';
import FirestoreBatchHandler from './firestore-batch-handler';

dotenv.config();

const serviceAccountFile = resolve(__dirname, `creds/firebase-prod.json`);
const serviceAccount = JSON.parse(readFileSync(serviceAccountFile, 'utf-8'));
firebaseAdmin.initializeApp({
  credential: firebaseAdmin.credential.cert(serviceAccount as ServiceAccount)
});
const firestore = firebaseAdmin.firestore();
const fsBatchHandler = new FirestoreBatchHandler(firestore);

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

const pool = new Pool(pgConnection);

const CHAIN_ID = ChainId.Mainnet;

export const pushLastSalePriceToFs = () => {
  const query =
    'SELECT collection_address, token_id, sale_price_eth, sale_timestamp, block_number FROM eth_nft_sales \
       WHERE block_number >= 16485264 AND block_number <= 16528000 ORDER BY block_number ASC LIMIT 10000000';

  pool.connect((err, client, done) => {
    if (err) {
      throw err;
    }
    const queryStream = new QueryStream(query, [], {
      batchSize: 500
    });
    const stream = client.query(queryStream);

    stream.on('error', (error) => {
      console.error(error);
      done();
    });

    stream.on('end', () => {
      console.log('stream has ended');
      fsBatchHandler.flush().catch((err) => {
        console.error(err);
      });
      done();
    });

    stream.on('data', async (row) => {
      const collectionAddress = row.collection_address;
      const tokenId = row.token_id;
      const salePriceEth = parseFloat(row.sale_price_eth);
      const saleTimestamp = Number(row.sale_timestamp);

      if (!salePriceEth || !saleTimestamp) {
        return;
      }

      let collectionDocId;
      try {
        collectionDocId = getCollectionDocId({ collectionAddress, chainId: CHAIN_ID });
      } catch (err) {
        console.error(err);
        return;
      }

      const docRef = firestore
        .collection(firestoreConstants.COLLECTIONS_COLL)
        .doc(collectionDocId)
        .collection(firestoreConstants.COLLECTION_NFTS_COLL)
        .doc(tokenId);

      fsBatchHandler.add(
        docRef,
        {
          lastSalePriceEth: salePriceEth,
          lastSaleTimestamp: saleTimestamp
        },
        { merge: true }
      );

      if (fsBatchHandler.size == fsBatchHandler.maxSize) {
        stream.pause();
        console.log(
          `========================================= Flushing batch of size ${fsBatchHandler.size} =========================================`
        );
        await fsBatchHandler.flush();
        console.log(
          '========================================= Last committed block:',
          row.block_number,
          '========================================='
        );
        stream.resume();
      }
    });
  });
};
