import { loadConfig } from './config.js';
import { logger } from './logger.js';
import { Bridge } from './bridge.js';

async function main(): Promise<void> {
  const config = loadConfig(process.env.BRIDGE_CONFIG || 'TakaroConfig.txt');
  const bridge = new Bridge(config);

  process.on('SIGINT', async () => {
    logger.info('Received SIGINT, shutting down');
    await bridge.stop();
    process.exit(0);
  });
  process.on('SIGTERM', async () => {
    logger.info('Received SIGTERM, shutting down');
    await bridge.stop();
    process.exit(0);
  });
  process.on('uncaughtException', (err) => {
    logger.error(`Uncaught: ${err.stack || err.message}`);
  });
  process.on('unhandledRejection', (reason) => {
    logger.error(`Unhandled rejection: ${String(reason)}`);
  });

  await bridge.start();
}

main().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
