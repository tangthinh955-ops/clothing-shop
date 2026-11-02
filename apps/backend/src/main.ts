import { createApplication } from './application.js';
import { readEnvironment } from './config/environment.js';
import { OrderNotificationWorker } from './modules/orders/order-notification-worker.service.js';

try {
  const config = readEnvironment(process.env);
  const app = await createApplication(config);
  await app.listen(config.port, config.host);
  app.get(OrderNotificationWorker).start();
  console.log(`Clothing Shop API listening on ${config.host}:${config.port}`);
} catch (error) {
  // Validation messages only name the setting (never its value), so they are safe and tell the operator what to fix.
  // Anything else (e.g. a database error) may carry a URL with credentials, so it stays generic.
  const message = error instanceof Error && error.message.startsWith('Invalid configuration:') ? error.message : null;
  console.error(message ?? 'Startup failed. Check required configuration and database connectivity.');
  process.exitCode = 1;
}
