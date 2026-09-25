import http from 'node:http';
import { app } from './app.js';
import { env } from './config/env.js';
import { connectDatabase, registerDatabaseShutdownHook } from './config/database.js';
import { initSocketServer } from './sockets/index.js';
import { logger } from './utils/logger.js';

const httpServer = http.createServer(app);
const io = initSocketServer(httpServer);

async function startServer(): Promise<void> {
  try {
    await connectDatabase();
    registerDatabaseShutdownHook();

    httpServer.listen(env.PORT, () => {
      logger.info(
        { port: env.PORT, nodeEnv: env.NODE_ENV },
        `LeadFlow server listening on port ${env.PORT}`
      );
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to start server');
    process.exit(1);
  }
}

if (process.env.NODE_ENV !== 'test') {
  void startServer();
}

export { app, httpServer, io };

