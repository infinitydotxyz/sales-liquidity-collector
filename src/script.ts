/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  updateSaleAndOrderImagesForCollId,
  updateSaleAndOrderImagesInPostgres
} from './updateSaleAndOrderImagesInPostgres';
import { deleteNonSupportedCollLiquidity } from './deleteNonSupportedCollLiquidity';
import { fetchAllEthNFTSalesFromAlchemy } from './fetchNFTSalesFromAlchemy';
import { pushLastSalePriceToFs } from './pushLastSalePriceToFirestore';
import { fetchNFTSalesFromReservoir } from './fetchNFTSalesFromReservoir';
import { readFileSync } from 'fs';
import path from 'path';

// eslint-disable-next-line @typescript-eslint/require-await
export async function main(): Promise<void> {
  try {
    // await deleteNonSupportedCollLiquidity();
    // pushLastSalePriceToFs();
    // await fetchAllEthNFTSalesFromAlchemy(true);
    // await updateSaleAndOrderImagesInPostgres();

    const filePath = path.join(__dirname, 'supportedColls-ETH-Mainnet.txt');
    const supportedCollsFile = readFileSync(filePath, 'utf-8');
    const supportedColls = supportedCollsFile.split('\n');
    for (const coll of supportedColls) {
      const chainId = '1';
      await updateSaleAndOrderImagesForCollId(chainId, coll);
    }

    // await fetchNFTSalesFromReservoir('0xe29f8038d1a3445ab22ad1373c65ec0a6e1161a4');
  } catch (err) {
    console.error(err);
  }
}

void main();
