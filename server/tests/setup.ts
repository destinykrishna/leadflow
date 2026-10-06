import { beforeAll, afterEach, afterAll } from 'vitest';
import { setupTestDB, clearTestDB, teardownTestDB } from './helpers/db.helper.js';

// Ensure mock email service in test runner
process.env.EMAIL_PROVIDER = 'mock';

beforeAll(async () => {
  await setupTestDB();
}, 180000);

afterEach(async () => {
  await clearTestDB();
});

afterAll(async () => {
  await teardownTestDB();
});
