import { beforeAll, afterEach, afterAll } from 'vitest';
import { setupTestDB, clearTestDB, teardownTestDB } from './helpers/db.helper.js';

beforeAll(async () => {
  await setupTestDB();
}, 180000);

afterEach(async () => {
  await clearTestDB();
});

afterAll(async () => {
  await teardownTestDB();
});
