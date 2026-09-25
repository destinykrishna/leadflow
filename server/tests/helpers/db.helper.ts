import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../../src/config/database.js';

let mongod: MongoMemoryServer | null = null;

/**
 * Spins up an in-memory MongoDB instance and connects Mongoose.
 * Provides isolated, fast test execution without external MongoDB requirements.
 */
export async function setupTestDB(): Promise<void> {
  if (!mongod) {
    mongod = await MongoMemoryServer.create();
  }
  const uri = mongod.getUri();
  await connectDatabase(uri);
}

/**
 * Clears all collections between test cases to ensure test isolation.
 */
export async function clearTestDB(): Promise<void> {
  if (mongoose.connection.readyState === 1 && mongoose.connection.db) {
    const collections = await mongoose.connection.db.collections();
    for (const collection of collections) {
      await collection.deleteMany({});
    }
  }
}

/**
 * Disconnects Mongoose and stops the in-memory MongoDB instance.
 */
export async function teardownTestDB(): Promise<void> {
  await disconnectDatabase();
  if (mongod) {
    await mongod.stop();
    mongod = null;
  }
}
