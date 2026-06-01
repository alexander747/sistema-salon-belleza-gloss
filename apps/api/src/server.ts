import 'reflect-metadata';
import dotenv from 'dotenv';
import path from 'path';

// Load .env BEFORE any module that reads process.env
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const PORT = parseInt(process.env.PORT ?? '3001', 10);

async function main(): Promise<void> {
  try {
    // Dynamic imports to ensure dotenv ran first (ESM hoists static imports)
    const [{ createApp }, { initializeDatabase }, { default: logger }] = await Promise.all([
      import('./app'),
      import('./shared/database'),
      import('./shared/logger'),
    ]);

    // Initialize database connection
    await initializeDatabase();

    // Create and start Express app
    const app = createApp();

    const server = app.listen(PORT, () => {
      logger.info({ port: PORT }, `🚀 Server listening on port ${PORT}`);
    });

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info({ signal }, 'Shutdown signal received');
      server.close(() => {
        logger.info('HTTP server closed');
        process.exit(0);
      });

      // Force exit after 10s
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10_000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

main();
