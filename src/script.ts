/* eslint-disable @typescript-eslint/no-unused-vars */
import { updateSaleAndOrderImagesInPostgres } from './updateSaleAndOrderImagesInPostgres';
import { deleteNonSupportedCollLiquidity } from './deleteNonSupportedCollLiquidity';
import { fetchAllEthNFTSalesFromAlchemy } from './fetchNFTSalesFromAlchemy';
import { pushLastSalePriceToFs } from './pushLastSalePriceToFirestore';
import { fetchNFTSalesFromReservoir } from './fetchNFTSalesFromReservoir';

// eslint-disable-next-line @typescript-eslint/require-await
export async function main(): Promise<void> {
  try {
    // await deleteNonSupportedCollLiquidity();
    // pushLastSalePriceToFs();
    // await fetchAllEthNFTSalesFromAlchemy(true);
    // await updateSaleAndOrderImagesInPostgres('0x1cb1a5e65610aeff2551a50f76a87a7d3fb649c6');
    // await fetchNFTSalesFromReservoir('0xe29f8038d1a3445ab22ad1373c65ec0a6e1161a4');
  } catch (err) {
    console.error(err);
  }
}

void main();
