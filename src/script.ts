/* eslint-disable @typescript-eslint/no-unused-vars */
import { fetchAllEthNFTSalesFromAlchemy } from './fetchNFTSalesFromAlchemy';
import { pushLastSalePriceToFs } from './pushLastSalePriceToFirestore';

// eslint-disable-next-line @typescript-eslint/require-await
export async function main(): Promise<void> {
  try {
    pushLastSalePriceToFs();
    // await fetchAllEthNFTSalesFromAlchemy(true);
  } catch (err) {
    console.error(err);
  }
}

void main();
