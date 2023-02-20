import { ChainId, Erc721Token } from '@infinityxyz/lib/types/core';
import { firestoreConstants, trimLowerCase } from '@infinityxyz/lib/utils';
import * as dotenv from 'dotenv';
import firebaseAdmin, { ServiceAccount } from 'firebase-admin';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { Pool } from 'pg';

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

const pool = new Pool(pgConnection);

const CHAIN_ID = ChainId.Mainnet;

export const updateSaleAndOrderImagesInPostgres = async (collectionAddress: string) => {
  const salesQ = `SELECT token_id FROM eth_nft_sales \
       WHERE collection_address = '${collectionAddress}' ORDER BY sale_timestamp DESC LIMIT 3000`;

  const ordersQ = `SELECT token_id FROM eth_nft_orders \
       WHERE collection_address = '${collectionAddress}' ORDER BY start_time_millis DESC LIMIT 3000`;

  const sales = await pool.query(salesQ);
  const salesTokenIds = new Set<string>();
  for (const row of sales.rows) {
    const tokenId = row.token_id;
    if (!tokenId) {
      continue;
    }
    salesTokenIds.add(tokenId);
  }

  const orders = await pool.query(ordersQ);
  const ordersTokenIds = new Set<string>();
  for (const row of orders.rows) {
    const tokenId = row.token_id;
    if (!tokenId) {
      continue;
    }
    ordersTokenIds.add(tokenId);
  }

  // merge sales and orders token ids
  const allTokenIds = new Set<string>();
  salesTokenIds.forEach((tokenId) => {
    allTokenIds.add(tokenId);
  });
  ordersTokenIds.forEach((tokenId) => {
    allTokenIds.add(tokenId);
  });

  console.log(`Found ${allTokenIds.size} token ids to update`);
  // get image url for each token id from firestore
  const tokenRefs = [];
  for (const tokenId of allTokenIds) {
    const collectionId = `${CHAIN_ID}:${trimLowerCase(collectionAddress)}`;
    const tokenRef = firestore
      .collection(firestoreConstants.COLLECTIONS_COLL)
      .doc(collectionId)
      .collection(firestoreConstants.COLLECTION_NFTS_COLL)
      .doc(tokenId);
    tokenRefs.push(tokenRef);
  }

  const tokensSnap = await firestore.getAll(...tokenRefs);
  const imageMap = new Map<string, string>();
  for (const tokenSnap of tokensSnap) {
    const tokenDoc = tokenSnap.data() as Erc721Token;
    const tokenId = tokenDoc.tokenId;

    const imageUrl =
      tokenDoc?.image?.url ||
      tokenDoc?.metadata?.image ||
      tokenDoc?.image?.originalUrl ||
      tokenDoc?.zoraImage?.url ||
      '';

    imageMap.set(tokenId, imageUrl);
  }

  // update image url for each sale and order
  for (const images of imageMap) {
    const tokenId = images[0];
    const imageUrl = images[1];
    console.log(`Updating ${tokenId} in postgres`);
    const updateSalesQ = `UPDATE eth_nft_sales SET token_image = '${imageUrl}' WHERE token_id = '${tokenId}' AND collection_address = '${collectionAddress}'`;
    const updateOrdersQ = `UPDATE eth_nft_orders SET token_image = '${imageUrl}' WHERE token_id = '${tokenId}' AND collection_address = '${collectionAddress}'`;
    await pool.query(updateSalesQ);
    await pool.query(updateOrdersQ);
  }
};
