import { sleep } from '@infinityxyz/lib/utils';
import firebaseAdmin from 'firebase-admin';

const MAX_SIZE = 500;

interface Batch {
  batch: FirebaseFirestore.WriteBatch;
  size: number;
}

export default class FirestoreBatchHandler {
  private currentBatch: Batch;

  constructor(private firebase: firebaseAdmin.firestore.Firestore) {
    this.currentBatch = this.newBatch();
  }

  get size(): number {
    return this.currentBatch.size;
  }

  get maxSize(): number {
    return MAX_SIZE;
  }

  add(
    doc: FirebaseFirestore.DocumentReference,
    object: Partial<FirebaseFirestore.DocumentData>,
    options: FirebaseFirestore.SetOptions
  ): void {
    if (this.currentBatch.size >= MAX_SIZE) {
      this.flush().catch((err) => {
        console.error(err);
        throw err;
      });
    }

    this.currentBatch.batch.set(doc, object, options);
    this.currentBatch.size += 1;
  }

  async flush(): Promise<void> {
    if (this.currentBatch.size > 0) {
      const maxAttempts = 3;
      let attempt = 0;
      const batch = this.currentBatch.batch;
      this.currentBatch = this.newBatch();
      // eslint-disable-next-line no-constant-condition
      while (true) {
        attempt += 1;
        try {
          await batch.commit();
          console.log(`================================== Committed firestore batch ================================`);
          return;
        } catch (err) {
          // logger.error('Failed to commit batch', err);
          if (attempt > maxAttempts) {
            console.error(`Failed to commit batch`);
            throw err;
          }
          await sleep(1000); // firebase has a limit of 1 write per doc per second
        }
      }
    }
  }

  private newBatch(): Batch {
    return {
      batch: this.firebase.batch(),
      size: 0
    };
  }
}
