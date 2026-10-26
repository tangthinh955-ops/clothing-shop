export interface AppConfig {
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
  databaseUrl: string;
  appOrigin: string;
  sessionSecret: string;
  trustProxy: boolean;
  swaggerEnabled: boolean;
  mailMode: 'preview' | 'resend';
  mailPreviewDir: string;
  resendApiKey: string;
  mailFrom: string;
}

export const APP_CONFIG = Symbol('APP_CONFIG');

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
  return { nodeEnv, port, databaseUrl, appOrigin, sessionSecret, trustProxy: bool('TRUST_PROXY'),
    swaggerEnabled, mailMode, mailPreviewDir: env['MAIL_PREVIEW_DIR'] ?? '../../.local/mailbox', resendApiKey, mailFrom };
}
