import { pushLastSalePriceToFs } from './pushLastSalePriceToFirestore';

// eslint-disable-next-line @typescript-eslint/require-await
export async function main(): Promise<void> {
  try {
    pushLastSalePriceToFs();
  } catch (err) {
    console.error(err);
  }
}

void main();
