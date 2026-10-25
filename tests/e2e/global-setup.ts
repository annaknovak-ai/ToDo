import { createDevPool, restoreSnapshot, takeSnapshot } from '../helpers/devDb.js';

// Saves the Dev tasks before the run and restores them afterwards (ADR-11).
export default async function globalSetup() {
  const db = createDevPool();
  const snapshot = await takeSnapshot(db);
  await db.end();

  return async () => {
    const restoreDb = createDevPool();
    try {
      await restoreSnapshot(restoreDb, snapshot);
    } finally {
      await restoreDb.end();
    }
  };
}
