import { buildApp } from './app.js';
import { loadConfig } from './config.js';

const config = loadConfig();
const app = await buildApp(config);

const shutdown = async () => {
  await app.close();
  process.exitCode = 0;
};

process.on('SIGINT', () => void shutdown());
process.on('SIGTERM', () => void shutdown());

try {
  await app.listen({ host: config.host, port: config.port });
} catch (error) {
  app.log.error({ err: error }, 'API failed to start');
  process.exitCode = 1;
}
