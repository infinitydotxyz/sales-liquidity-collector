import { ChainId } from '@infinityxyz/lib/types/core';
import { firestoreConstants, trimLowerCase } from '@infinityxyz/lib/utils';
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

let pgConnection: any = { max: 20, idleTimeoutMillis: 1000000, connectionTimeoutMillis: 2000000 };
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

export const deleteNonSupportedCollLiquidity = async () => {
  const firestore = firebaseAdmin.firestore();
  const supportedCollsRef = firestore.collection(firestoreConstants.SUPPORTED_COLLECTIONS_COLL);
  const fsQuery = supportedCollsRef.limit(1000);
  const querySnapshot = await fsQuery.get();
  const supportedCollSet = new Set<string>();
  querySnapshot.docs.forEach((doc) => {
    const collAddress = doc.id;
    supportedCollSet.add(collAddress);
  });

  const query = `SELECT id, collection_address FROM eth_nft_orders WHERE status = 'active'`;

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

    stream.on('data', (row) => {
      const collectionAddress = row.collection_address;
      const collId = CHAIN_ID + ':' + trimLowerCase(collectionAddress);
      console.log(collectionAddress);
      if (!supportedCollSet.has(collId)) {
        console.log(collectionAddress, 'is not supported, deleting from db');
        // delete from postgres
        const deleteQuery = `DELETE FROM eth_nft_orders WHERE id = '${row.id}'`;
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        client.query(deleteQuery, (err, res) => {
          if (err) {
            console.error(err);
          }
        });
      }
    });
  });
};
