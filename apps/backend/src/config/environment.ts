import path from 'node:path';
import { fileURLToPath } from 'node:url';

export interface AppConfig {
  nodeEnv: 'development' | 'test' | 'production';
  host: string;
  port: number;
  databaseUrl: string;
  appOrigin: string;
  sessionSecret: string;
  trustProxyHops: number;
  uploadsDir: string;
  swaggerEnabled: boolean;
  mailMode: 'preview' | 'resend';
  mailPreviewDir: string;
  resendApiKey: string;
  mailFrom: string;
}

export const APP_CONFIG = Symbol('APP_CONFIG');

// Repo root from this file (apps/backend/{src,dist}/config), so local upload folders never depend on the working directory.
const localDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', '.local');

// TRUST_PROXY: false/true or the number of reverse-proxy hops in front of the API (1 = Caddy/nginx on the VPS).
function proxyHops(value: string | undefined): number {
  if (value === undefined || value === 'false') return 0;
  if (value === 'true') return 1;
  if (/^[1-5]$/.test(value)) return Number(value);
  throw new Error('Invalid configuration: TRUST_PROXY must be false, true or a hop count 1-5');
}

export function readEnvironment(env: Record<string, string | undefined>): AppConfig {
  const required = (name: string): string => {
    const value = env[name]?.trim();
    if (!value) throw new Error(`Invalid configuration: ${name} is required`);
    return value;
  };
  const bool = (name: string, fallback = false): boolean => {
    const value = env[name] ?? String(fallback);
    if (value !== 'true' && value !== 'false') throw new Error(`Invalid configuration: ${name}`);
    return value === 'true';
  };
  const nodeEnv = env['NODE_ENV'] ?? 'development';
  if (nodeEnv !== 'development' && nodeEnv !== 'test' && nodeEnv !== 'production') throw new Error('Invalid configuration: NODE_ENV');
  const port = Number(env['PORT'] ?? '3000');
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid configuration: PORT');
  // Loopback by default: on the VPS only the reverse proxy should reach the API port.
  const host = env['HOST']?.trim() || '127.0.0.1';
  if (!/^[A-Za-z0-9.:-]+$/.test(host)) throw new Error('Invalid configuration: HOST');
  const databaseUrl = required('DATABASE_URL');
  try {
    const url = new URL(databaseUrl);
    if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error();
  } catch { throw new Error('Invalid configuration: DATABASE_URL'); }
  const appOrigin = required('APP_ORIGIN');
  try {
    const url = new URL(appOrigin);
    if (!['http:', 'https:'].includes(url.protocol) || url.origin !== appOrigin || url.username || url.password) throw new Error();
    if (nodeEnv === 'production' && url.protocol !== 'https:') throw new Error();
  } catch { throw new Error('Invalid configuration: APP_ORIGIN must be an origin without a path (HTTPS in production)'); }
  const sessionSecret = required('SESSION_SECRET');
  if (sessionSecret.length < 32 || /REPLACE|CHANGE_ME|test-only/i.test(sessionSecret) && nodeEnv === 'production'
    || /REPLACE|CHANGE_ME/.test(sessionSecret)) throw new Error('Invalid configuration: SESSION_SECRET');
  const mailMode = env['MAIL_MODE'] ?? 'preview';
  if (mailMode !== 'preview' && mailMode !== 'resend') throw new Error('Invalid configuration: MAIL_MODE');
  if (nodeEnv === 'production' && mailMode === 'preview') throw new Error('Invalid configuration: MAIL_MODE preview is local only');
  const resendApiKey = mailMode === 'resend' ? required('RESEND_API_KEY') : '';
  const mailFrom = mailMode === 'resend' ? required('MAIL_FROM') : '';
  if (mailMode === 'resend' && (!/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(mailFrom) || /[\r\n]/.test(mailFrom))) {
    throw new Error('Invalid configuration: MAIL_FROM');
  }
  const swaggerEnabled = bool('SWAGGER_ENABLED', nodeEnv === 'development');
  if (nodeEnv === 'production' && swaggerEnabled) throw new Error('Invalid configuration: SWAGGER_ENABLED must be false in production');
  const trustProxyHops = proxyHops(env['TRUST_PROXY']?.trim());
  // HTTPS ends at the reverse proxy; without trusting it the secure session cookie is never sent and every client shares one IP.
  if (nodeEnv === 'production' && trustProxyHops === 0) throw new Error('Invalid configuration: TRUST_PROXY is required in production');
  const configuredUploads = env['UPLOADS_DIR']?.trim();
  if (configuredUploads && !path.isAbsolute(configuredUploads)) throw new Error('Invalid configuration: UPLOADS_DIR must be an absolute path');
  if (nodeEnv === 'production' && !configuredUploads) throw new Error('Invalid configuration: UPLOADS_DIR is required in production');
  const uploadsDir = configuredUploads ? path.resolve(configuredUploads) : path.join(localDir, nodeEnv === 'test' ? 'test-uploads' : 'uploads');
  return { nodeEnv, host, port, databaseUrl, appOrigin, sessionSecret, trustProxyHops, uploadsDir,
    swaggerEnabled, mailMode, mailPreviewDir: env['MAIL_PREVIEW_DIR'] ?? '../../.local/mailbox', resendApiKey, mailFrom };
}
