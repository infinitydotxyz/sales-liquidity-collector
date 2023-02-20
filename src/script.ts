/* eslint-disable @typescript-eslint/no-unused-vars */
import { updateSaleAndOrderImagesInPostgres } from './updateSaleAndOrderImagesInPostgres';
import { deleteNonSupportedCollLiquidity } from './deleteNonSupportedCollLiquidity';
import { fetchAllEthNFTSalesFromAlchemy } from './fetchNFTSalesFromAlchemy';
import { pushLastSalePriceToFs } from './pushLastSalePriceToFirestore';

// eslint-disable-next-line @typescript-eslint/require-await
export async function main(): Promise<void> {
  try {
    // await deleteNonSupportedCollLiquidity();
    // pushLastSalePriceToFs();
    // await fetchAllEthNFTSalesFromAlchemy(true);
    // await updateSaleAndOrderImagesInPostgres('0x1cb1a5e65610aeff2551a50f76a87a7d3fb649c6');
  } catch (err) {
    console.error(err);
  }
}

void main();
