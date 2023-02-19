/* eslint-disable @typescript-eslint/no-unused-vars */
import { deleteNonSupportedCollLiquidity } from './deleteNonSupportedCollLiquidity';
import { fetchAllEthNFTSalesFromAlchemy } from './fetchNFTSalesFromAlchemy';
import { pushLastSalePriceToFs } from './pushLastSalePriceToFirestore';

// eslint-disable-next-line @typescript-eslint/require-await
export async function main(): Promise<void> {
  try {
    // await deleteNonSupportedCollLiquidity();
    // pushLastSalePriceToFs();
    // await fetchAllEthNFTSalesFromAlchemy(true);
  } catch (err) {
    console.error(err);
  }
}

void main();
