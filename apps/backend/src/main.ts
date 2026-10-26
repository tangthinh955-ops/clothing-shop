import { createApplication } from './application.js';
import { readEnvironment } from './config/environment.js';

try {
  const config = readEnvironment(process.env);
  const app = await createApplication(config);
  await app.listen(config.port, '127.0.0.1');
  console.log(`Clothing Shop API listening on port ${config.port}`);
} catch {
  // Configuration/connectivity errors must not print credentials or URLs.
  console.error('Startup failed. Check required configuration and database connectivity.');
  process.exitCode = 1;
}
